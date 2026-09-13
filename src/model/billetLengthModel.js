import mongoose from "mongoose";

const billetLengthSchema = new mongoose.Schema(
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
    length_meters: {
      type: Number,
      required: true
    },
    piece_count: {
      type: Number,
      required: true
    },
    weight_per_piece_kg: {
      type: Number,
      required: true
    },
    total_weight_mt: {
      type: Number,
      required: true
    },
    dispatched_pieces: {
      type: Number,
      default: 0
    },
    dispatched_weight_mt: {
      type: Number,
      default: 0.0
    },
    remaining_pieces: {
      type: Number,
      required: true
    },
    remaining_weight_mt: {
      type: Number,
      required: true
    },
    bundle_code: {
      type: String,
      trim: true,
      default: null
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

export const BilletLength = mongoose.models.BilletLength || mongoose.model("BilletLength", billetLengthSchema);

export const addLengthToHeat = async (heatId, lengthData) => {
  const { BilletHeat, recalculateHeatTotals, calculateBilletPieceWeight } = await import("./billetHeatModel.js");

  let heat = null;
  if (mongoose.isValidObjectId(heatId)) {
    heat = await BilletHeat.findById(heatId);
  }
  if (!heat) {
    heat = await BilletHeat.findOne({ heat_number: String(heatId).trim().toUpperCase() });
  }

  if (!heat) {
    throw new Error(`Billet heat with ID ${heatId} does not exist.`);
  }

  const lengthMeters = Number(lengthData.length_meters);
  const pieceCount = Number(lengthData.piece_count);
  let weightPerPieceKg = lengthData.weight_per_piece_kg ? Number(lengthData.weight_per_piece_kg) : null;
  let totalWeightMt = lengthData.total_weight_mt ? Number(lengthData.total_weight_mt) : null;

  if (!weightPerPieceKg && totalWeightMt) {
    weightPerPieceKg = Number(((totalWeightMt * 1000) / pieceCount).toFixed(2));
  } else if (weightPerPieceKg && !totalWeightMt) {
    totalWeightMt = Number(((weightPerPieceKg * pieceCount) / 1000).toFixed(3));
  } else if (!weightPerPieceKg && !totalWeightMt) {
    weightPerPieceKg = calculateBilletPieceWeight(heat.section, lengthMeters);
    totalWeightMt = Number(((weightPerPieceKg * pieceCount) / 1000).toFixed(3));
  }

  const newLength = await BilletLength.create({
    heat_id: heat._id,
    heat_number: heat.heat_number,
    length_meters: lengthMeters,
    piece_count: pieceCount,
    weight_per_piece_kg: weightPerPieceKg,
    total_weight_mt: totalWeightMt,
    remaining_pieces: pieceCount,
    remaining_weight_mt: totalWeightMt,
    bundle_code: lengthData.bundle_code || null,
    remarks: lengthData.remarks || null
  });

  await recalculateHeatTotals(heat._id);
  return newLength.toJSON();
};

export const findLengthById = async (id) => {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  const doc = await BilletLength.findById(id);
  return doc ? doc.toJSON() : null;
};

export const findLengthsByHeatId = async (heatId) => {
  if (!heatId) return [];
  const query = mongoose.isValidObjectId(heatId)
    ? { heat_id: heatId }
    : { heat_number: String(heatId).trim().toUpperCase() };
  const docs = await BilletLength.find(query).sort({ length_meters: -1, created_at: 1 });
  return docs.map((d) => d.toJSON());
};

export const updateLength = async (id, updateData) => {
  if (!id || !mongoose.isValidObjectId(id)) throw new Error(`Billet length record ${id} not found.`);
  const current = await BilletLength.findById(id);
  if (!current) {
    throw new Error(`Billet length record ${id} not found.`);
  }

  const lengthMeters = updateData.length_meters !== undefined ? Number(updateData.length_meters) : current.length_meters;
  const pieceCount = updateData.piece_count !== undefined ? Number(updateData.piece_count) : current.piece_count;
  let weightPerPiece = updateData.weight_per_piece_kg !== undefined ? Number(updateData.weight_per_piece_kg) : current.weight_per_piece_kg;
  let totalWeightMt = updateData.total_weight_mt !== undefined ? Number(updateData.total_weight_mt) : (pieceCount * weightPerPiece) / 1000;

  const dispatchedPieces = current.dispatched_pieces || 0;
  const remainingPieces = Math.max(0, pieceCount - dispatchedPieces);
  const remainingWeightMt = Number(((remainingPieces * weightPerPiece) / 1000).toFixed(3));

  current.length_meters = lengthMeters;
  current.piece_count = pieceCount;
  current.weight_per_piece_kg = weightPerPiece;
  current.total_weight_mt = totalWeightMt;
  current.remaining_pieces = remainingPieces;
  current.remaining_weight_mt = remainingWeightMt;
  if (updateData.bundle_code !== undefined) current.bundle_code = updateData.bundle_code;
  if (updateData.remarks !== undefined) current.remarks = updateData.remarks;

  await current.save();

  const { recalculateHeatTotals } = await import("./billetHeatModel.js");
  await recalculateHeatTotals(current.heat_id);

  return current.toJSON();
};

export const deleteLength = async (id) => {
  if (!id || !mongoose.isValidObjectId(id)) throw new Error(`Billet length record ${id} not found.`);
  const current = await BilletLength.findById(id);
  if (!current) {
    throw new Error(`Billet length record ${id} not found.`);
  }

  if (current.dispatched_pieces > 0) {
    throw new Error(`Cannot delete length record #${id} because ${current.dispatched_pieces} pieces have already been dispatched.`);
  }

  const heatId = current.heat_id;
  await BilletLength.findByIdAndDelete(id);

  const { recalculateHeatTotals } = await import("./billetHeatModel.js");
  await recalculateHeatTotals(heatId);

  return current.toJSON();
};

export default BilletLength;
