import mongoose from "mongoose";

const billetRejectionSchema = new mongoose.Schema(
  {
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
    production_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FinishedProduct",
      default: null
    },
    stage: {
      type: String,
      required: true,
      trim: true
    },
    rejection_type: {
      type: String,
      required: true,
      trim: true
    },
    rejected_pieces: {
      type: Number,
      default: 0
    },
    rejected_weight_mt: {
      type: Number,
      required: true
    },
    disposition: {
      type: String,
      default: "SCRAP_REMELT"
    },
    rejection_reason: {
      type: String,
      required: true,
      trim: true
    },
    reported_by_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    recorded_at: {
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

export const BilletRejection =
  mongoose.models.BilletRejection || mongoose.model("BilletRejection", billetRejectionSchema);

export const recordRejection = async (data, userId) => {
  const { BilletHeat } = await import("./billetHeatModel.js");

  const heatNumber = data.heat_number.trim().toUpperCase();
  const heat = await BilletHeat.findOne({ heat_number: heatNumber });
  if (!heat) {
    throw new Error(`Billet heat '${data.heat_number}' does not exist.`);
  }

  const validUserId = userId && mongoose.isValidObjectId(userId) ? userId : null;
  let validDispatchId = data.dispatch_id && mongoose.isValidObjectId(data.dispatch_id) ? data.dispatch_id : null;
  const validProductionId = data.production_id && mongoose.isValidObjectId(data.production_id) ? data.production_id : null;

  const rejectedPieces = Number(data.rejected_pieces) || 0;
  const rejectedWeightMt = Number(data.rejected_weight_mt);

  if (rejectedWeightMt <= 0) {
    throw new Error("Rejected scrap weight must be greater than zero.");
  }
  if (rejectedPieces < 0) {
    throw new Error("Rejected pieces cannot be negative.");
  }

  // If production_id is provided, validate against that production batch
  if (validProductionId) {
    const { FinishedProduct } = await import("./finishedProductModel.js");
    const production = await FinishedProduct.findById(validProductionId);
    if (!production) {
      throw new Error(`Referenced production batch #${validProductionId} not found.`);
    }
    // Auto-link dispatch if not explicitly provided
    if (!validDispatchId && production.dispatch_id) {
      validDispatchId = production.dispatch_id;
    }
    if (production.heat_number && production.heat_number !== heatNumber) {
      throw new Error(`Referenced production batch belongs to heat '${production.heat_number}', not '${heatNumber}'.`);
    }
    // For finishing stage defect checks against finished products
    if (data.stage === "FINISHING" && rejectedPieces > 0 && production.finished_pieces > 0 && rejectedPieces > production.finished_pieces) {
      throw new Error(
        `Rejected pieces (${rejectedPieces} pcs) cannot exceed produced batch pieces (${production.finished_pieces} pcs).`
      );
    }
  }

  // If dispatch_id is provided, validate against that dispatch and finished product usage
  if (validDispatchId) {
    const { BilletPlantDispatch } = await import("./dispatchModel.js");
    const { FinishedProduct } = await import("./finishedProductModel.js");
    const dispatch = await BilletPlantDispatch.findById(validDispatchId);
    if (!dispatch) {
      throw new Error(`Referenced dispatch #${validDispatchId} not found.`);
    }

    // Calculate finished products already built from this dispatch material
    const finishedProducts = await FinishedProduct.find({ dispatch_id: validDispatchId });
    const totalFinishedInputWeight = finishedProducts.reduce(
      (sum, p) => sum + (Number(p.input_billet_weight_mt) || 0),
      0
    );

    const { PlantReturn } = await import("./plantReturnModel.js");
    const existingReturns = await PlantReturn.find({ dispatch_id: validDispatchId });
    const alreadyReturnedWeight = existingReturns.reduce(
      (sum, ret) => sum + (Number(ret.returned_weight_mt) || 0),
      0
    );

    // Rule: If finished products and returns have already accounted for the full dispatch material, rejection is IMPOSSIBLE
    if (totalFinishedInputWeight + alreadyReturnedWeight >= dispatch.dispatched_weight_mt - 0.001) {
      throw new Error(
        `Impossible to add rejection: All dispatched material (${dispatch.dispatched_weight_mt} MT) has already been consumed by finished products (${totalFinishedInputWeight} MT) or returned to yard stock (${alreadyReturnedWeight} MT). Rejection is only possible if unconsumed material remains at the plant.`
      );
    }

    // If finished product built is less than dispatch material, rejection is possible up to the remaining unconsumed balance
    const existingRejections = await BilletRejection.find({ dispatch_id: validDispatchId });
    const alreadyRejectedWeight = existingRejections.reduce(
      (sum, r) => sum + (Number(r.rejected_weight_mt) || 0),
      0
    );
    const remainingBalance = Number(
      Math.max(
        0,
        dispatch.dispatched_weight_mt - totalFinishedInputWeight - alreadyRejectedWeight - alreadyReturnedWeight
      ).toFixed(3)
    );

    if (remainingBalance <= 0) {
      throw new Error(
        `Impossible to add rejection: No unconsumed balance remains for dispatch #${dispatch.dispatch_number}. (Dispatched: ${dispatch.dispatched_weight_mt} MT, Finished Products: ${totalFinishedInputWeight} MT, Existing Rejections: ${alreadyRejectedWeight} MT, Prior Returns: ${alreadyReturnedWeight} MT).`
      );
    }

    if (rejectedWeightMt > remainingBalance + 0.005) {
      throw new Error(
        `Rejection weight (${rejectedWeightMt} MT) exceeds remaining unconsumed dispatch balance (${remainingBalance} MT). Dispatched: ${dispatch.dispatched_weight_mt} MT, Finished products built: ${totalFinishedInputWeight} MT, Existing rejections: ${alreadyRejectedWeight} MT, Prior returns: ${alreadyReturnedWeight} MT.`
      );
    }

    if (rejectedPieces > 0 && rejectedPieces > dispatch.dispatched_pieces) {
      throw new Error(
        `Rejected pieces (${rejectedPieces} pcs) cannot exceed dispatched pieces (${dispatch.dispatched_pieces} pcs).`
      );
    }
  } else {
    // If dispatch_id is not explicitly provided, check if heat has dispatches and finished products in plant stage
    const { BilletPlantDispatch } = await import("./dispatchModel.js");
    const { FinishedProduct } = await import("./finishedProductModel.js");
    const { PlantReturn } = await import("./plantReturnModel.js");
    const dispatches = await BilletPlantDispatch.find({ heat_number: heat.heat_number });
    const totalDispatched = dispatches.reduce((sum, d) => sum + (Number(d.dispatched_weight_mt) || 0), 0);

    if (totalDispatched > 0 && (data.stage === "ROLLING_MILL" || data.stage === "FINISHING")) {
      const finishedProducts = await FinishedProduct.find({ heat_number: heat.heat_number });
      const totalFinishedInput = finishedProducts.reduce(
        (sum, p) => sum + (Number(p.input_billet_weight_mt) || 0),
        0
      );

      const existingReturns = await PlantReturn.find({ heat_number: heat.heat_number });
      const alreadyReturned = existingReturns.reduce((sum, r) => sum + (Number(r.returned_weight_mt) || 0), 0);

      if (totalFinishedInput + alreadyReturned >= totalDispatched - 0.001) {
        throw new Error(
          `Impossible to add rejection: All dispatched material (${totalDispatched} MT) for heat '${heat.heat_number}' has already been consumed by finished products (${totalFinishedInput} MT) or returned to yard stock (${alreadyReturned} MT). Rejection is only possible if unconsumed material remains at the plant.`
        );
      }

      const existingRejections = await BilletRejection.find({
        heat_number: heat.heat_number,
        stage: { $in: ["ROLLING_MILL", "FINISHING"] }
      });
      const alreadyRejected = existingRejections.reduce(
        (sum, r) => sum + (Number(r.rejected_weight_mt) || 0),
        0
      );
      const remainingHeatBalance = Number(
        Math.max(0, totalDispatched - totalFinishedInput - alreadyRejected - alreadyReturned).toFixed(3)
      );

      if (rejectedWeightMt > remainingHeatBalance + 0.005) {
        throw new Error(
          `Rejection weight (${rejectedWeightMt} MT) exceeds available plant material balance (${remainingHeatBalance} MT) for heat '${heat.heat_number}'. Dispatched: ${totalDispatched} MT, Finished Products: ${totalFinishedInput} MT, Existing Rejections: ${alreadyRejected} MT, Prior Returns: ${alreadyReturned} MT.`
        );
      }
    }
  }

  // Overall check against Heat's total cast weight
  if (rejectedWeightMt > heat.total_weight_mt + 0.001) {
    throw new Error(
      `Rejection weight (${rejectedWeightMt} MT) cannot exceed total cast weight of heat '${heat.heat_number}' (${heat.total_weight_mt} MT).`
    );
  }

  const doc = await BilletRejection.create({
    heat_id: heat._id,
    heat_number: heat.heat_number,
    dispatch_id: validDispatchId,
    production_id: validProductionId,
    stage: data.stage.trim(),
    rejection_type: data.rejection_type.trim(),
    rejected_pieces: rejectedPieces,
    rejected_weight_mt: rejectedWeightMt,
    disposition: data.disposition || "SCRAP_REMELT",
    rejection_reason: data.rejection_reason.trim(),
    reported_by_id: validUserId,
    remarks: data.remarks || null
  });

  return await findRejectionById(doc._id);
};

export const findAllRejections = async ({ heat_number, stage, rejection_type, search, limit = 50, offset = 0 }) => {
  const filter = {};
  if (heat_number) filter.heat_number = { $regex: heat_number, $options: "i" };
  if (stage) filter.stage = stage;
  if (rejection_type) filter.rejection_type = rejection_type;
  if (search) {
    filter.$or = [
      { heat_number: { $regex: search, $options: "i" } },
      { rejection_number: { $regex: search, $options: "i" } },
      { stage: { $regex: search, $options: "i" } },
      { rejection_type: { $regex: search, $options: "i" } },
      { rejection_reason: { $regex: search, $options: "i" } }
    ];
  }

  const [items, total] = await Promise.all([
    BilletRejection.find(filter)
      .sort({ created_at: -1 })
      .skip(offset)
      .limit(limit)
      .populate("reported_by_id", "name")
      .populate("heat_id", "grade section"),
    BilletRejection.countDocuments(filter)
  ]);

  const enrichedItems = items.map((item) => {
    const json = item.toJSON();
    json.reported_by_name = item.reported_by_id ? item.reported_by_id.name : null;
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

export const findRejectionById = async (id) => {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  const doc = await BilletRejection.findById(id)
    .populate("reported_by_id", "name")
    .populate("heat_id", "grade section");
  if (!doc) return null;

  const json = doc.toJSON();
  json.reported_by_name = doc.reported_by_id ? doc.reported_by_id.name : null;
  json.grade = doc.heat_id ? doc.heat_id.grade : null;
  json.section = doc.heat_id ? doc.heat_id.section : null;
  return json;
};

export const updateRejection = async (id, updateData) => {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  const current = await BilletRejection.findById(id);
  if (!current) return null;

  if (updateData.rejected_weight_mt !== undefined) {
    const wt = Number(updateData.rejected_weight_mt);
    if (isNaN(wt) || wt <= 0) {
      throw new Error("Rejected scrap weight must be strictly greater than zero.");
    }
  }
  if (updateData.rejected_pieces !== undefined) {
    const pcs = Number(updateData.rejected_pieces);
    if (isNaN(pcs) || pcs < 0) {
      throw new Error("Rejected pieces cannot be negative.");
    }
  }

  const allowed = [
    "stage",
    "rejection_type",
    "rejected_pieces",
    "rejected_weight_mt",
    "disposition",
    "rejection_reason",
    "remarks"
  ];
  for (const field of allowed) {
    if (updateData[field] !== undefined) {
      if (field === "rejected_pieces" || field === "rejected_weight_mt") {
        current[field] = Number(updateData[field]);
      } else {
        current[field] = updateData[field];
      }
    }
  }

  await current.save();
  return await findRejectionById(id);
};

export const deleteRejection = async (id) => {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  const deleted = await BilletRejection.findByIdAndDelete(id);
  return deleted ? deleted.toJSON() : null;
};

export default BilletRejection;
