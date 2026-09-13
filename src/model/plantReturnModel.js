import mongoose from "mongoose";

const plantReturnSchema = new mongoose.Schema(
  {
    return_voucher_no: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true
    },
    heat_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BilletHeat",
      required: true,
      index: true
    },
    heat_number: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    dispatch_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BilletPlantDispatch",
      default: null
    },
    returned_from: {
      type: String,
      required: true,
      trim: true
    },
    returned_to: {
      type: String,
      required: true,
      trim: true
    },
    return_type: {
      type: String,
      required: true,
      trim: true
    },
    returned_pieces: {
      type: Number,
      required: true
    },
    returned_weight_mt: {
      type: Number,
      required: true
    },
    return_reason: {
      type: String,
      required: true,
      trim: true
    },
    stock_restored: {
      type: Boolean,
      default: true
    },
    authorized_by_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    received_by_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    return_date: {
      type: Date,
      default: Date.now
    },
    remarks: {
      type: String,
      trim: true,
      default: null
    }
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret.__v;
        return ret;
      }
    },
    toObject: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret.__v;
        return ret;
      }
    }
  }
);

export const PlantReturn = mongoose.models.PlantReturn || mongoose.model("PlantReturn", plantReturnSchema);

export const recordPlantReturn = async (returnData, userId) => {
  const { BilletHeat } = await import("./billetHeatModel.js");

  const heatNumber = returnData.heat_number.trim().toUpperCase();
  const heat = await BilletHeat.findOne({ heat_number: heatNumber });
  if (!heat) {
    throw new Error(`Billet heat '${returnData.heat_number}' not found.`);
  }

  const voucherNo = returnData.return_voucher_no || `RET-${Date.now().toString().slice(-6)}`;
  const pieces = Number(returnData.returned_pieces);
  const weightMt = Number(returnData.returned_weight_mt);
  const restoreStock = returnData.stock_restored !== undefined ? Boolean(returnData.stock_restored) : true;
  const validUserId = userId && mongoose.isValidObjectId(userId) ? userId : null;
  const validDispatchId = returnData.dispatch_id && mongoose.isValidObjectId(returnData.dispatch_id)
    ? returnData.dispatch_id
    : null;

  if (pieces <= 0 || weightMt <= 0) {
    throw new Error("Returned quantity and weight must be greater than zero.");
  }

  const returnedFrom = (returnData.returned_from || returnData.source_plant || "").trim();
  const returnedTo = (returnData.returned_to || returnData.destination_plant || "").trim();

  if (!returnedFrom || !returnedTo) {
    throw new Error("Both source plant (returned_from) and destination plant (returned_to) are required.");
  }

  if (returnedFrom.toUpperCase() === returnedTo.toUpperCase()) {
    throw new Error("Source plant and destination plant cannot be identical.");
  }

  const { BilletPlantDispatch } = await import("./dispatchModel.js");
  const allDispatches = await BilletPlantDispatch.find({ heat_number: heat.heat_number });

  if (!allDispatches || allDispatches.length === 0) {
    throw new Error(
      `Cannot process return: Heat '${heat.heat_number}' has never been dispatched to any plant.`
    );
  }

  if (validDispatchId) {
    const dispatch = await BilletPlantDispatch.findById(validDispatchId);
    if (!dispatch) {
      throw new Error(`Referenced dispatch #${validDispatchId} not found.`);
    }

    if (dispatch.target_plant.trim().toUpperCase() !== returnedFrom.toUpperCase()) {
      throw new Error(
        `Invalid return plant: Material in dispatch #${dispatch.dispatch_number} was dispatched to '${dispatch.target_plant}', so it cannot be returned from '${returnedFrom}'.`
      );
    }

    const { FinishedProduct } = await import("./finishedProductModel.js");
    const { BilletRejection } = await import("./rejectionModel.js");

    const finishedProducts = await FinishedProduct.find({ dispatch_id: validDispatchId });
    const usedInputWeight = finishedProducts.reduce((s, p) => s + (Number(p.input_billet_weight_mt) || 0), 0);

    const existingRejections = await BilletRejection.find({ dispatch_id: validDispatchId });
    const rejectedWeight = existingRejections.reduce((s, r) => s + (Number(r.rejected_weight_mt) || 0), 0);

    const prevReturns = await PlantReturn.find({ dispatch_id: validDispatchId });
    const prevReturnedPcs = prevReturns.reduce((s, r) => s + (Number(r.returned_pieces) || 0), 0);
    const prevReturnedWt = prevReturns.reduce((s, r) => s + (Number(r.returned_weight_mt) || 0), 0);

    const maxWt = Number(
      Math.max(0, dispatch.dispatched_weight_mt - usedInputWeight - rejectedWeight - prevReturnedWt).toFixed(3)
    );
    const maxPcs = Math.max(0, dispatch.dispatched_pieces - prevReturnedPcs);

    if (maxWt <= 0) {
      throw new Error(
        `Impossible to return material: All dispatched material (${dispatch.dispatched_weight_mt} MT) has already been consumed by finished products (${usedInputWeight} MT), scrap/cobbles (${rejectedWeight} MT), or prior returns (${prevReturnedWt} MT).`
      );
    }

    if (pieces > maxPcs) {
      throw new Error(
        `Returned pieces (${pieces} pcs) exceeds returnable quantity (${maxPcs} pcs) from dispatch #${dispatch.dispatch_number}.`
      );
    }
    if (weightMt > maxWt + 0.005) {
      throw new Error(
        `Returned weight (${weightMt} MT) exceeds available unconsumed dispatch balance (${maxWt} MT) from dispatch #${dispatch.dispatch_number}. (Dispatched: ${dispatch.dispatched_weight_mt} MT, Finished products: ${usedInputWeight} MT, Scrap: ${rejectedWeight} MT, Prior returns: ${prevReturnedWt} MT).`
      );
    }
  } else {
    // Validate returned_from exists in any dispatch for this heat
    const matching = allDispatches.filter(
      (d) => d.target_plant.trim().toUpperCase() === returnedFrom.toUpperCase()
    );

    if (matching.length === 0) {
      const validPlants = Array.from(new Set(allDispatches.map((d) => d.target_plant))).join(", ");
      throw new Error(
        `Invalid return plant: Heat '${heat.heat_number}' was only dispatched to [${validPlants}]. It cannot be returned from '${returnedFrom}'.`
      );
    }

    const { FinishedProduct } = await import("./finishedProductModel.js");
    const { BilletRejection } = await import("./rejectionModel.js");

    const totalDispatchedPcs = matching.reduce((s, d) => s + d.dispatched_pieces, 0);
    const totalDispatchedWt = matching.reduce((s, d) => s + d.dispatched_weight_mt, 0);

    const allFinished = await FinishedProduct.find({ heat_number: heat.heat_number });
    const totalFinishedWt = allFinished.reduce((s, p) => s + (Number(p.input_billet_weight_mt) || 0), 0);

    const allRejections = await BilletRejection.find({
      heat_number: heat.heat_number,
      stage: { $in: ["ROLLING_MILL", "FINISHING"] }
    });
    const totalRejectedWt = allRejections.reduce((s, r) => s + (Number(r.rejected_weight_mt) || 0), 0);

    const prevReturns = await PlantReturn.find({
      heat_number: heat.heat_number,
      returned_from: { $regex: `^${returnedFrom}$`, $options: "i" }
    });
    const prevPcs = prevReturns.reduce((s, r) => s + (Number(r.returned_pieces) || 0), 0);
    const prevWt = prevReturns.reduce((s, r) => s + (Number(r.returned_weight_mt) || 0), 0);

    const maxWt = Number(
      Math.max(0, totalDispatchedWt - totalFinishedWt - totalRejectedWt - prevWt).toFixed(3)
    );
    const maxPcs = Math.max(0, totalDispatchedPcs - prevPcs);

    if (maxWt <= 0) {
      throw new Error(
        `Impossible to return material: All dispatched material (${totalDispatchedWt} MT) for heat '${heat.heat_number}' at '${returnedFrom}' has already been consumed by finished products (${totalFinishedWt} MT), scrap (${totalRejectedWt} MT), or prior returns (${prevWt} MT).`
      );
    }

    if (pieces > maxPcs) {
      throw new Error(
        `Returned pieces (${pieces} pcs) exceeds unreturned pieces (${maxPcs} pcs) from plant '${returnedFrom}'.`
      );
    }
    if (weightMt > maxWt + 0.005) {
      throw new Error(
        `Returned weight (${weightMt} MT) exceeds unreturned weight (${maxWt} MT) from plant '${returnedFrom}'. (Dispatched: ${totalDispatchedWt} MT, Finished products: ${totalFinishedWt} MT, Scrap: ${totalRejectedWt} MT, Prior returns: ${prevWt} MT).`
      );
    }
  }

  const doc = await PlantReturn.create({
    return_voucher_no: voucherNo,
    heat_id: heat._id,
    heat_number: heat.heat_number,
    dispatch_id: validDispatchId,
    returned_from: returnedFrom,
    returned_to: returnedTo,
    return_type: (returnData.return_type || "UNUSED_BILLET_RETURN").trim(),
    returned_pieces: pieces,
    returned_weight_mt: weightMt,
    return_reason: returnData.return_reason.trim(),
    stock_restored: restoreStock,
    authorized_by_id: validUserId,
    received_by_id: validUserId,
    remarks: returnData.remarks || null
  });

  // If restored to yard stock, increment available pieces & weight
  if (restoreStock && (returnedTo.toLowerCase().includes("stock") || returnedTo.toLowerCase().includes("yard"))) {
    heat.available_pieces = Math.min(heat.total_pieces, heat.available_pieces + pieces);
    heat.available_weight_mt = Number(Math.min(heat.total_weight_mt, heat.available_weight_mt + weightMt).toFixed(3));
    if (heat.status === "DISPATCHED_TO_PLANT") {
      heat.status = "IN_PRODUCTION";
    }
    await heat.save();

    // Also restore cut length pieces and weight if dispatch has breakdown
    if (validDispatchId) {
      const { BilletLength } = await import("./billetLengthModel.js");
      const dispatch = await BilletPlantDispatch.findById(validDispatchId);
      if (dispatch && Array.isArray(dispatch.lengths_breakdown) && dispatch.lengths_breakdown.length > 0) {
        const firstBreakdown = dispatch.lengths_breakdown[0];
        const lenDoc = await BilletLength.findOne({
          heat_id: heat._id,
          length_meters: firstBreakdown.length_meters
        });
        if (lenDoc) {
          lenDoc.remaining_pieces = Math.min(lenDoc.piece_count, lenDoc.remaining_pieces + pieces);
          lenDoc.remaining_weight_mt = Number(
            Math.min(lenDoc.total_weight_mt, lenDoc.remaining_weight_mt + weightMt).toFixed(3)
          );
          await lenDoc.save();
        }
      }
    }
  }

  return await findReturnById(doc._id);
};

export const findAllReturns = async ({ heat_number, return_type, search, limit = 50, offset = 0 }) => {
  const filter = {};
  if (heat_number) filter.heat_number = { $regex: heat_number, $options: "i" };
  if (return_type) filter.return_type = return_type;
  if (search) {
    filter.$or = [
      { heat_number: { $regex: search, $options: "i" } },
      { return_number: { $regex: search, $options: "i" } },
      { source_plant: { $regex: search, $options: "i" } },
      { returned_to: { $regex: search, $options: "i" } },
      { return_reason: { $regex: search, $options: "i" } }
    ];
  }

  const [items, total] = await Promise.all([
    PlantReturn.find(filter)
      .sort({ created_at: -1 })
      .skip(offset)
      .limit(limit)
      .populate("authorized_by_id", "name")
      .populate("heat_id", "grade section"),
    PlantReturn.countDocuments(filter)
  ]);

  const enrichedItems = items.map((item) => {
    const json = item.toJSON();
    json.authorized_by_name = item.authorized_by_id ? item.authorized_by_id.name : null;
    json.grade = item.heat_id ? item.heat_id.grade : null;
    json.section = item.heat_id ? item.heat_id.section : null;
    return json;
  });

  return {
    items: enrichedItems,
    total,
    limit,
    offset
  };
};

export const findReturnById = async (id) => {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  const doc = await PlantReturn.findById(id)
    .populate("authorized_by_id", "name")
    .populate("heat_id", "grade section");
  if (!doc) return null;

  const json = doc.toJSON();
  json.authorized_by_name = doc.authorized_by_id ? doc.authorized_by_id.name : null;
  json.grade = doc.heat_id ? doc.heat_id.grade : null;
  json.section = doc.heat_id ? doc.heat_id.section : null;
  return json;
};

export const updatePlantReturn = async (id, updateData) => {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  const current = await PlantReturn.findById(id);
  if (!current) return null;

  const { BilletHeat } = await import("./billetHeatModel.js");
  const heat = await BilletHeat.findById(current.heat_id);

  // 1. Resolve source and destination plants
  const newReturnedFrom = (updateData.returned_from || updateData.source_plant || current.returned_from || "").trim();
  const newReturnedTo = (updateData.returned_to || updateData.destination_plant || current.returned_to || "").trim();

  if (!newReturnedFrom || !newReturnedTo) {
    throw new Error("Both source plant (returned_from) and destination plant (returned_to) are required.");
  }

  if (newReturnedFrom.toUpperCase() === newReturnedTo.toUpperCase()) {
    throw new Error("Source plant and destination plant cannot be identical.");
  }

  // 2. Validate source plant against dispatches for this heat
  const { BilletPlantDispatch } = await import("./dispatchModel.js");
  const allDispatches = await BilletPlantDispatch.find({ heat_number: current.heat_number });
  if (allDispatches.length > 0) {
    const validPlants = Array.from(new Set(allDispatches.map((d) => d.target_plant)));
    const matchesAny = validPlants.some(
      (p) => p.toLowerCase() === newReturnedFrom.toLowerCase()
    );
    if (!matchesAny) {
      throw new Error(
        `Invalid return plant '${newReturnedFrom}'. Heat '${current.heat_number}' was only dispatched to: [${validPlants.join(", ")}].`
      );
    }
  }

  // 3. Resolve pieces and weight
  const newPieces = updateData.returned_pieces !== undefined ? Number(updateData.returned_pieces) : current.returned_pieces;
  const newWeight = updateData.returned_weight_mt !== undefined ? Number(updateData.returned_weight_mt) : current.returned_weight_mt;

  if (newPieces <= 0 || newWeight <= 0) {
    throw new Error("Returned quantity and weight must be greater than zero.");
  }

  // 4. Validate remaining dispatch balance (excluding current return itself)
  if (current.dispatch_id) {
    const dispatch = await BilletPlantDispatch.findById(current.dispatch_id);
    if (dispatch) {
      const { FinishedProduct } = await import("./finishedProductModel.js");
      const { BilletRejection } = await import("./rejectionModel.js");

      const allFinished = await FinishedProduct.find({ dispatch_id: dispatch._id });
      const totalFinishedWt = allFinished.reduce((s, p) => s + (Number(p.input_billet_weight_mt) || 0), 0);

      const allRejections = await BilletRejection.find({ dispatch_id: dispatch._id });
      const totalRejectedWt = allRejections.reduce((s, r) => s + (Number(r.rejected_weight_mt) || 0), 0);

      const otherReturns = await PlantReturn.find({
        dispatch_id: dispatch._id,
        _id: { $ne: current._id }
      });
      const otherReturnsWt = otherReturns.reduce((s, r) => s + (Number(r.returned_weight_mt) || 0), 0);
      const otherReturnsPcs = otherReturns.reduce((s, r) => s + (Number(r.returned_pieces) || 0), 0);

      const maxAvailableWt = Number(
        Math.max(0, dispatch.dispatched_weight_mt - totalFinishedWt - totalRejectedWt - otherReturnsWt).toFixed(3)
      );
      const maxAvailablePcs = Math.max(0, dispatch.dispatched_pieces - otherReturnsPcs);

      if (newWeight > maxAvailableWt + 0.005) {
        throw new Error(
          `Updated return weight (${newWeight} MT) exceeds available unconsumed dispatch balance (${maxAvailableWt} MT) from dispatch #${dispatch.dispatch_number}. (Dispatched: ${dispatch.dispatched_weight_mt} MT, Finished products: ${totalFinishedWt} MT, Scrap: ${totalRejectedWt} MT, Other returns: ${otherReturnsWt} MT).`
        );
      }
      if (newPieces > maxAvailablePcs) {
        throw new Error(
          `Updated return pieces (${newPieces} pcs) exceeds unreturned pieces (${maxAvailablePcs} pcs) from dispatch #${dispatch.dispatch_number}.`
        );
      }
    }
  }

  // 5. Reconcile yard stock if stock_restored
  const oldIsRestored = Boolean(
    current.stock_restored &&
    (current.returned_to.toLowerCase().includes("stock") || current.returned_to.toLowerCase().includes("yard"))
  );
  const newStockRestored = updateData.stock_restored !== undefined ? Boolean(updateData.stock_restored) : current.stock_restored;
  const newIsRestored = Boolean(
    newStockRestored &&
    (newReturnedTo.toLowerCase().includes("stock") || newReturnedTo.toLowerCase().includes("yard"))
  );

  if (heat) {
    if (oldIsRestored && newIsRestored) {
      const deltaWt = Number((newWeight - current.returned_weight_mt).toFixed(3));
      const deltaPcs = newPieces - current.returned_pieces;
      heat.available_weight_mt = Number(
        Math.min(heat.total_weight_mt, Math.max(0, heat.available_weight_mt + deltaWt)).toFixed(3)
      );
      heat.available_pieces = Math.min(heat.total_pieces, Math.max(0, heat.available_pieces + deltaPcs));
      await heat.save();

      if (current.dispatch_id) {
        const { BilletLength } = await import("./billetLengthModel.js");
        const dispatch = await BilletPlantDispatch.findById(current.dispatch_id);
        if (dispatch && Array.isArray(dispatch.lengths_breakdown) && dispatch.lengths_breakdown.length > 0) {
          const firstL = dispatch.lengths_breakdown[0];
          const lenDoc = await BilletLength.findOne({
            heat_id: heat._id,
            length_meters: firstL.length_meters
          });
          if (lenDoc) {
            lenDoc.remaining_pieces = Math.min(lenDoc.piece_count, Math.max(0, lenDoc.remaining_pieces + deltaPcs));
            lenDoc.remaining_weight_mt = Number(
              Math.min(lenDoc.total_weight_mt, Math.max(0, lenDoc.remaining_weight_mt + deltaWt)).toFixed(3)
            );
            await lenDoc.save();
          }
        }
      }
    } else if (!oldIsRestored && newIsRestored) {
      heat.available_weight_mt = Number(
        Math.min(heat.total_weight_mt, heat.available_weight_mt + newWeight).toFixed(3)
      );
      heat.available_pieces = Math.min(heat.total_pieces, heat.available_pieces + newPieces);
      await heat.save();
    } else if (oldIsRestored && !newIsRestored) {
      heat.available_weight_mt = Number(
        Math.max(0, heat.available_weight_mt - current.returned_weight_mt).toFixed(3)
      );
      heat.available_pieces = Math.max(0, heat.available_pieces - current.returned_pieces);
      await heat.save();
    }
  }

  // 6. Update fields
  current.returned_from = newReturnedFrom;
  current.returned_to = newReturnedTo;
  current.returned_pieces = newPieces;
  current.returned_weight_mt = newWeight;
  current.stock_restored = newStockRestored;

  if (updateData.return_type !== undefined) {
    current.return_type = (updateData.return_type || "UNUSED_BILLET_RETURN").trim();
  }
  if (updateData.return_reason !== undefined) {
    current.return_reason = updateData.return_reason.trim();
  }
  if (updateData.remarks !== undefined) {
    current.remarks = updateData.remarks ? updateData.remarks.trim() : null;
  }

  await current.save();
  return await findReturnById(id);
};

export const deletePlantReturn = async (id) => {
  if (!id || !mongoose.isValidObjectId(id)) throw new Error(`Plant return #${id} not found.`);
  const current = await PlantReturn.findById(id);
  if (!current) {
    throw new Error(`Plant return #${id} not found.`);
  }

  // Reverse stock restored if applicable
  if (current.stock_restored && current.returned_to.toLowerCase().includes("stock")) {
    const { BilletHeat } = await import("./billetHeatModel.js");
    const heat = await BilletHeat.findById(current.heat_id);
    if (heat) {
      heat.available_pieces = Math.max(0, heat.available_pieces - current.returned_pieces);
      heat.available_weight_mt = Number(Math.max(0, heat.available_weight_mt - current.returned_weight_mt).toFixed(3));
      await heat.save();
    }
  }

  const deleted = current.toJSON();
  await PlantReturn.findByIdAndDelete(id);
  return deleted;
};

export default PlantReturn;
