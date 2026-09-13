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

  const returnedFrom = (returnData.returned_from || "").trim();
  const returnedTo = (returnData.returned_to || "").trim();

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

    const prevReturns = await PlantReturn.find({ dispatch_id: validDispatchId });
    const prevReturnedPcs = prevReturns.reduce((s, r) => s + (Number(r.returned_pieces) || 0), 0);
    const prevReturnedWt = prevReturns.reduce((s, r) => s + (Number(r.returned_weight_mt) || 0), 0);
    const maxPcs = dispatch.dispatched_pieces - prevReturnedPcs;
    const maxWt = Number(Math.max(0, dispatch.dispatched_weight_mt - prevReturnedWt).toFixed(3));

    if (pieces > maxPcs) {
      throw new Error(
        `Returned pieces (${pieces} pcs) exceeds returnable quantity (${maxPcs} pcs) from dispatch #${dispatch.dispatch_number}.`
      );
    }
    if (weightMt > maxWt + 0.005) {
      throw new Error(
        `Returned weight (${weightMt} MT) exceeds returnable weight (${maxWt} MT) from dispatch #${dispatch.dispatch_number}.`
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

    const totalDispatchedPcs = matching.reduce((s, d) => s + d.dispatched_pieces, 0);
    const totalDispatchedWt = matching.reduce((s, d) => s + d.dispatched_weight_mt, 0);

    const prevReturns = await PlantReturn.find({
      heat_number: heat.heat_number,
      returned_from: { $regex: `^${returnedFrom}$`, $options: "i" }
    });
    const prevPcs = prevReturns.reduce((s, r) => s + (Number(r.returned_pieces) || 0), 0);
    const prevWt = prevReturns.reduce((s, r) => s + (Number(r.returned_weight_mt) || 0), 0);

    const maxPcs = totalDispatchedPcs - prevPcs;
    const maxWt = Number(Math.max(0, totalDispatchedWt - prevWt).toFixed(3));

    if (pieces > maxPcs) {
      throw new Error(
        `Returned pieces (${pieces} pcs) exceeds unreturned pieces (${maxPcs} pcs) from plant '${returnedFrom}'.`
      );
    }
    if (weightMt > maxWt + 0.005) {
      throw new Error(
        `Returned weight (${weightMt} MT) exceeds unreturned weight (${maxWt} MT) from plant '${returnedFrom}'.`
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
    return_type: returnData.return_type.trim(),
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

  const allowed = ["returned_from", "returned_to", "return_type", "return_reason", "remarks"];
  for (const field of allowed) {
    if (updateData[field] !== undefined) {
      current[field] = updateData[field];
    }
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
