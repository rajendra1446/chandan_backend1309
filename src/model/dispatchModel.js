import mongoose from "mongoose";
import { BilletLength } from "./billetLengthModel.js";

const billetPlantDispatchSchema = new mongoose.Schema(
  {
    dispatch_number: {
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
    target_plant: {
      type: String,
      required: true,
      trim: true
    },
    dispatched_pieces: {
      type: Number,
      required: true
    },
    dispatched_weight_mt: {
      type: Number,
      required: true
    },
    lengths_breakdown: {
      type: [mongoose.Schema.Types.Mixed],
      default: []
    },
    vehicle_number: {
      type: String,
      trim: true,
      default: null
    },
    status: {
      type: String,
      default: "DISPATCHED"
    },
    dispatched_by_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    received_by_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    dispatch_date: {
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

export const BilletPlantDispatch =
  mongoose.models.BilletPlantDispatch || mongoose.model("BilletPlantDispatch", billetPlantDispatchSchema);

export const createPlantDispatch = async (dispatchData, userId) => {
  const { BilletHeat, recalculateHeatTotals } = await import("./billetHeatModel.js");
  const { BilletLabCheck } = await import("./billetLabModel.js");

  const heatNumber = dispatchData.heat_number.trim().toUpperCase();
  const heat = await BilletHeat.findOne({ heat_number: heatNumber });
  if (!heat) {
    throw new Error(`Billet heat '${dispatchData.heat_number}' does not exist.`);
  }

  // Check lab check verdict
  const lab = await BilletLabCheck.findOne({ heat_id: heat._id });
  const labVerdict = lab ? lab.verdict : "PENDING";

  if (labVerdict !== "APPROVED" && !dispatchData.override_lab_check) {
    throw new Error(
      `Cannot dispatch billets for heat '${heat.heat_number}': Lab check verdict is '${labVerdict}'. Approval is mandatory before sending to plant.`
    );
  }

  const dispatchedPieces = Number(dispatchData.dispatched_pieces);
  const dispatchedWeightMt = Number(dispatchData.dispatched_weight_mt);

  if (dispatchedPieces <= 0 || dispatchedWeightMt <= 0) {
    throw new Error("Dispatched quantity and weight must be greater than zero.");
  }

  if (heat.available_pieces < dispatchedPieces) {
    throw new Error(
      `Insufficient billet pieces: Requested ${dispatchedPieces} pcs, but only ${heat.available_pieces} pcs available in yard.`
    );
  }
  if (Number(heat.available_weight_mt) < dispatchedWeightMt) {
    throw new Error(
      `Insufficient billet weight: Requested ${dispatchedWeightMt} MT, but only ${heat.available_weight_mt} MT available in yard.`
    );
  }

  const targetPlant = (dispatchData.target_plant || "").trim();
  if (!targetPlant) {
    throw new Error("Target plant is mandatory for dispatch.");
  }

  const lengthsBreakdown = Array.isArray(dispatchData.lengths_breakdown) ? [...dispatchData.lengths_breakdown] : [];

  if (lengthsBreakdown.length > 0) {
    // Step 1: Pre-validate all cut lengths before mutating any database state
    const resolvedDocs = [];
    let sumBreakdownPcs = 0;
    let sumBreakdownWt = 0;

    for (const item of lengthsBreakdown) {
      let lenDoc = null;
      if (item.length_id && mongoose.isValidObjectId(item.length_id)) {
        lenDoc = await BilletLength.findById(item.length_id);
      } else if (item.length_meters) {
        lenDoc = await BilletLength.findOne({
          heat_id: heat._id,
          length_meters: Number(item.length_meters)
        });
      }

      if (!lenDoc) {
        throw new Error(`Cut length variant ${item.length_meters || item.length_id}m not found for heat '${heat.heat_number}'.`);
      }

      const pcs = Number(item.pieces);
      const wt = item.weight_mt !== undefined
        ? Number(item.weight_mt)
        : Number(((pcs * lenDoc.weight_per_piece_kg) / 1000).toFixed(3));

      if (pcs <= 0 || wt <= 0) {
        throw new Error(`Dispatched pieces and weight for cut length ${lenDoc.length_meters}m must be greater than zero.`);
      }

      if (pcs > lenDoc.remaining_pieces) {
        throw new Error(
          `Insufficient pieces for cut length ${lenDoc.length_meters}m: Requested ${pcs} pcs, but only ${lenDoc.remaining_pieces} pcs available in yard.`
        );
      }

      if (wt > lenDoc.remaining_weight_mt + 0.005) {
        throw new Error(
          `Insufficient weight for cut length ${lenDoc.length_meters}m: Requested ${wt} MT, but only ${lenDoc.remaining_weight_mt} MT available in yard.`
        );
      }

      sumBreakdownPcs += pcs;
      sumBreakdownWt += wt;
      resolvedDocs.push({ lenDoc, pcs, wt, item });
    }

    // Step 2: Deduct atomically from validated cut lengths
    for (const { lenDoc, pcs, wt, item } of resolvedDocs) {
      lenDoc.dispatched_pieces += pcs;
      lenDoc.dispatched_weight_mt = Number((lenDoc.dispatched_weight_mt + wt).toFixed(3));
      lenDoc.remaining_pieces = Math.max(0, lenDoc.remaining_pieces - pcs);
      lenDoc.remaining_weight_mt = Number(Math.max(0, lenDoc.remaining_weight_mt - wt).toFixed(3));
      await lenDoc.save();

      item.length_id = lenDoc._id.toString();
      item.weight_mt = wt;
    }
  } else {
    // Auto-deduct sequentially from available lengths
    let remainingToDeductPieces = dispatchedPieces;
    let remainingToDeductWeight = dispatchedWeightMt;

    const lengthsList = await BilletLength.find({
      heat_id: heat._id,
      remaining_pieces: { $gt: 0 }
    }).sort({ length_meters: -1 });

    for (const row of lengthsList) {
      if (remainingToDeductPieces <= 0) break;
      const pcs = Math.min(row.remaining_pieces, remainingToDeductPieces);
      const ratio = pcs / row.piece_count;
      const wt = Math.min(row.remaining_weight_mt, Number((row.total_weight_mt * ratio).toFixed(3)));

      row.dispatched_pieces += pcs;
      row.dispatched_weight_mt = Number((row.dispatched_weight_mt + wt).toFixed(3));
      row.remaining_pieces = Math.max(0, row.remaining_pieces - pcs);
      row.remaining_weight_mt = Number(Math.max(0, row.remaining_weight_mt - wt).toFixed(3));
      await row.save();

      remainingToDeductPieces -= pcs;
      remainingToDeductWeight -= wt;

      lengthsBreakdown.push({
        length_id: row._id.toString(),
        length_meters: row.length_meters,
        pieces: pcs,
        weight_mt: wt
      });
    }
  }

  const dispatchNumber = dispatchData.dispatch_number || `DSP-${Date.now().toString().slice(-6)}`;
  const validUserId = userId && mongoose.isValidObjectId(userId) ? userId : null;

  const dispatch = await BilletPlantDispatch.create({
    dispatch_number: dispatchNumber,
    heat_id: heat._id,
    heat_number: heat.heat_number,
    target_plant: dispatchData.target_plant.trim(),
    dispatched_pieces: dispatchedPieces,
    dispatched_weight_mt: dispatchedWeightMt,
    lengths_breakdown: lengthsBreakdown,
    vehicle_number: dispatchData.vehicle_number || null,
    status: dispatchData.status || "DISPATCHED",
    dispatched_by_id: validUserId,
    remarks: dispatchData.remarks || null
  });

  await recalculateHeatTotals(heat._id);

  const updatedHeat = await BilletHeat.findById(heat._id);
  if (updatedHeat) {
    updatedHeat.status = updatedHeat.available_pieces <= 0 ? "DISPATCHED_TO_PLANT" : "IN_DISPATCH";
    await updatedHeat.save();
  }

  return await findDispatchById(dispatch._id);
};

export const findAllDispatches = async ({ heat_number, target_plant, status, search, limit = 50, offset = 0 }) => {
  const filter = {};
  if (heat_number) filter.heat_number = { $regex: heat_number, $options: "i" };
  if (target_plant) filter.target_plant = { $regex: target_plant, $options: "i" };
  if (status) filter.status = status;
  if (search) {
    filter.$or = [
      { heat_number: { $regex: search, $options: "i" } },
      { target_plant: { $regex: search, $options: "i" } },
      { vehicle_number: { $regex: search, $options: "i" } },
      { remarks: { $regex: search, $options: "i" } }
    ];
  }

  const [items, total] = await Promise.all([
    BilletPlantDispatch.find(filter)
      .sort({ created_at: -1 })
      .skip(offset)
      .limit(limit)
      .populate("dispatched_by_id", "name"),
    BilletPlantDispatch.countDocuments(filter)
  ]);

  const enrichedItems = items.map((item) => {
    const json = item.toJSON();
    json.dispatched_by_name = item.dispatched_by_id ? item.dispatched_by_id.name : null;
    return json;
  });

  return {
    items: enrichedItems,
    total,
    limit,
    offset
  };
};

export const findDispatchById = async (id) => {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  const dispatch = await BilletPlantDispatch.findById(id)
    .populate("dispatched_by_id", "name")
    .populate("heat_id", "grade section");
  if (!dispatch) return null;

  const json = dispatch.toJSON();
  json.dispatched_by_name = dispatch.dispatched_by_id ? dispatch.dispatched_by_id.name : null;
  json.grade = dispatch.heat_id ? dispatch.heat_id.grade : null;
  json.section = dispatch.heat_id ? dispatch.heat_id.section : null;
  return json;
};

export const updateDispatch = async (id, updateData) => {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  const dispatch = await BilletPlantDispatch.findById(id);
  if (!dispatch) return null;

  const allowed = ["target_plant", "vehicle_number", "status", "remarks"];
  for (const field of allowed) {
    if (updateData[field] !== undefined) {
      dispatch[field] = updateData[field];
    }
  }

  await dispatch.save();
  return await findDispatchById(id);
};

export const deleteDispatch = async (id) => {
  if (!id || !mongoose.isValidObjectId(id)) throw new Error(`Dispatch #${id} not found.`);
  const dispatch = await BilletPlantDispatch.findById(id);
  if (!dispatch) {
    throw new Error(`Dispatch #${id} not found.`);
  }

  const breakdown = dispatch.lengths_breakdown || [];
  for (const item of breakdown) {
    if (item.length_id && mongoose.isValidObjectId(item.length_id)) {
      const len = await BilletLength.findById(item.length_id);
      if (len) {
        len.dispatched_pieces = Math.max(0, len.dispatched_pieces - Number(item.pieces));
        len.dispatched_weight_mt = Number(Math.max(0, len.dispatched_weight_mt - Number(item.weight_mt)).toFixed(3));
        len.remaining_pieces += Number(item.pieces);
        len.remaining_weight_mt = Number((len.remaining_weight_mt + Number(item.weight_mt)).toFixed(3));
        await len.save();
      }
    }
  }

  const deleted = dispatch.toJSON();
  const heatId = dispatch.heat_id;
  await BilletPlantDispatch.findByIdAndDelete(id);

  const { recalculateHeatTotals } = await import("./billetHeatModel.js");
  await recalculateHeatTotals(heatId);

  return deleted;
};

export default BilletPlantDispatch;
