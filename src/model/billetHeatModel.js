import mongoose from "mongoose";
import { BilletLength } from "./billetLengthModel.js";

const billetHeatSchema = new mongoose.Schema(
  {
    heat_number: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true
    },
    grade: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    section: {
      type: String,
      required: true,
      trim: true
    },
    casting_date: {
      type: Date,
      default: Date.now
    },
    total_pieces: {
      type: Number,
      default: 0
    },
    total_weight_mt: {
      type: Number,
      default: 0.0
    },
    available_pieces: {
      type: Number,
      default: 0
    },
    available_weight_mt: {
      type: Number,
      default: 0.0
    },
    status: {
      type: String,
      enum: [
        "CAST",
        "LAB_PENDING",
        "LAB_APPROVED",
        "LAB_REJECTED",
        "ON_HOLD",
        "IN_PRODUCTION",
        "IN_DISPATCH",
        "DISPATCHED_TO_PLANT"
      ],
      default: "CAST",
      index: true
    },
    remarks: {
      type: String,
      trim: true,
      default: null
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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

export const BilletHeat = mongoose.models.BilletHeat || mongoose.model("BilletHeat", billetHeatSchema);

// Helper to calculate theoretical piece weight in kg from billet section (e.g. 120x120 mm) and length in meters
export const calculateBilletPieceWeight = (sectionStr, lengthMeters) => {
  let weightPerMeterKg = 113.04; // default density for 120x120 mm square billet (~7850 kg/m³)
  if (sectionStr) {
    const match = String(sectionStr).match(/(\d+(?:\.\d+)?)\s*[xX*]\s*(\d+(?:\.\d+)?)/);
    if (match) {
      const w_m = Number(match[1]) / 1000;
      const h_m = Number(match[2]) / 1000;
      weightPerMeterKg = Number((w_m * h_m * 7850).toFixed(2));
    }
  }
  return Number((weightPerMeterKg * Number(lengthMeters)).toFixed(2));
};

// Recalculates total initial pieces, initial weight MT, available pieces, and available weight MT from billet_lengths
export const recalculateHeatTotals = async (heatId) => {
  if (!heatId) return null;
  const objectId = mongoose.isValidObjectId(heatId) ? new mongoose.Types.ObjectId(heatId) : null;
  if (!objectId) return null;

  const agg = await BilletLength.aggregate([
    { $match: { heat_id: objectId } },
    {
      $group: {
        _id: "$heat_id",
        total_pieces: { $sum: "$piece_count" },
        total_weight_mt: { $sum: "$total_weight_mt" },
        available_pieces: { $sum: "$remaining_pieces" },
        available_weight_mt: { $sum: "$remaining_weight_mt" }
      }
    }
  ]);

  const stats = agg.length > 0 ? agg[0] : {
    total_pieces: 0,
    total_weight_mt: 0,
    available_pieces: 0,
    available_weight_mt: 0
  };

  const updatedHeat = await BilletHeat.findByIdAndUpdate(
    heatId,
    {
      total_pieces: stats.total_pieces,
      total_weight_mt: Number(stats.total_weight_mt.toFixed(3)),
      available_pieces: stats.available_pieces,
      available_weight_mt: Number(stats.available_weight_mt.toFixed(3))
    },
    { returnDocument: "after" }
  );

  return updatedHeat ? updatedHeat.toJSON() : null;
};

// Cast a heat with multiple lengths (e.g. 7.4m, 5.0m, 5.4m with multiple pieces each)
export const createHeatWithLengths = async (heatData, lengthsArray = [], userId = null) => {
  const heatNumber = heatData.heat_number.trim().toUpperCase();

  const heat = await BilletHeat.create({
    heat_number: heatNumber,
    grade: heatData.grade.trim(),
    section: heatData.section.trim(),
    status: heatData.status || "CAST",
    remarks: heatData.remarks || null,
    created_by: userId && mongoose.isValidObjectId(userId) ? userId : null
  });

  // If initial lengths are specified during casting (e.g., 7.4m x 10 pcs, 5.0m x 8 pcs, 5.4m x 6 pcs)
  if (Array.isArray(lengthsArray) && lengthsArray.length > 0) {
    const lengthsToInsert = lengthsArray.map((item) => {
      const lengthMeters = Number(item.length_meters);
      const pieceCount = Number(item.piece_count);

      let weightPerPieceKg = item.weight_per_piece_kg ? Number(item.weight_per_piece_kg) : null;
      let totalWeightMt = item.total_weight_mt ? Number(item.total_weight_mt) : null;

      if (!weightPerPieceKg && totalWeightMt) {
        weightPerPieceKg = Number(((totalWeightMt * 1000) / pieceCount).toFixed(2));
      } else if (weightPerPieceKg && !totalWeightMt) {
        totalWeightMt = Number(((weightPerPieceKg * pieceCount) / 1000).toFixed(3));
      } else if (!weightPerPieceKg && !totalWeightMt) {
        weightPerPieceKg = calculateBilletPieceWeight(heat.section, lengthMeters);
        totalWeightMt = Number(((weightPerPieceKg * pieceCount) / 1000).toFixed(3));
      }

      return {
        heat_id: heat._id,
        heat_number: heat.heat_number,
        length_meters: lengthMeters,
        piece_count: pieceCount,
        weight_per_piece_kg: weightPerPieceKg,
        total_weight_mt: totalWeightMt,
        dispatched_pieces: 0,
        dispatched_weight_mt: 0.0,
        remaining_pieces: pieceCount,
        remaining_weight_mt: totalWeightMt,
        bundle_code: item.bundle_code || null,
        remarks: item.remarks || null
      };
    });

    await BilletLength.insertMany(lengthsToInsert);
    await recalculateHeatTotals(heat._id);
  }

  return await findHeatById(heat._id);
};

export const findAllHeats = async ({ grade, status, search, limit = 50, offset = 0 }) => {
  const filter = {};

  if (grade) {
    filter.grade = { $regex: grade, $options: "i" };
  }
  if (status) {
    filter.status = status;
  }
  if (search) {
    filter.$or = [
      { heat_number: { $regex: search, $options: "i" } },
      { grade: { $regex: search, $options: "i" } },
      { section: { $regex: search, $options: "i" } }
    ];
  }

  const [items, total] = await Promise.all([
    BilletHeat.find(filter)
      .sort({ created_at: -1 })
      .skip(offset)
      .limit(limit)
      .populate("created_by", "name"),
    BilletHeat.countDocuments(filter)
  ]);

  const { BilletLabCheck } = await import("./billetLabModel.js");

  // Enrich with lab verdict
  const heatIds = items.map((h) => h._id);
  const labChecks = await BilletLabCheck.find({ heat_id: { $in: heatIds } });
  const labMap = new Map();
  labChecks.forEach((l) => {
    labMap.set(l.heat_id.toString(), l);
  });

  const enrichedItems = items.map((item) => {
    const json = item.toJSON();
    const lab = labMap.get(item._id.toString());
    json.created_by_name = item.created_by ? item.created_by.name : null;
    json.lab_verdict = lab ? lab.verdict : null;
    json.lab_certificate_no = lab ? lab.test_certificate_no : null;
    json.lab_id = lab ? lab._id.toString() : null;
    json.lab_tested_at = lab ? lab.tested_at : null;
    json.c_percent = lab ? lab.c_percent : null;
    json.mn_percent = lab ? lab.mn_percent : null;
    json.si_percent = lab ? lab.si_percent : null;
    json.s_percent = lab ? lab.s_percent : null;
    json.p_percent = lab ? lab.p_percent : null;
    json.cr_percent = lab ? lab.cr_percent : null;
    json.ni_percent = lab ? lab.ni_percent : null;
    json.mo_percent = lab ? lab.mo_percent : null;
    json.cu_percent = lab ? lab.cu_percent : null;
    json.surface_quality = lab ? lab.surface_quality : null;
    json.internal_soundness = lab ? lab.internal_soundness : null;
    json.other_elements = lab ? (lab.other_elements || {}) : {};
    json.lab_remarks = lab ? lab.lab_remarks : null;
    json.chemical_analysis = lab
      ? {
          c_percent: lab.c_percent,
          mn_percent: lab.mn_percent,
          si_percent: lab.si_percent,
          s_percent: lab.s_percent,
          p_percent: lab.p_percent,
          cr_percent: lab.cr_percent,
          ni_percent: lab.ni_percent,
          mo_percent: lab.mo_percent,
          cu_percent: lab.cu_percent,
          other_elements: lab.other_elements || {},
          surface_quality: lab.surface_quality,
          internal_soundness: lab.internal_soundness,
          verdict: lab.verdict,
          test_certificate_no: lab.test_certificate_no,
          tested_at: lab.tested_at,
          lab_remarks: lab.lab_remarks
        }
      : null;
    return json;
  });

  return {
    items: enrichedItems,
    total,
    limit,
    offset
  };
};

export const findHeatById = async (id) => {
  if (!id) return null;
  let heat = null;

  if (mongoose.isValidObjectId(id)) {
    heat = await BilletHeat.findById(id).populate("created_by", "name");
  }
  if (!heat) {
    heat = await BilletHeat.findOne({ heat_number: String(id).trim().toUpperCase() }).populate("created_by", "name");
  }
  if (!heat) return null;

  const result = heat.toJSON();
  result.created_by_name = heat.created_by ? heat.created_by.name : null;

  // Fetch lengths
  const lengths = await BilletLength.find({ heat_id: heat._id }).sort({ length_meters: -1, created_at: 1 });
  result.lengths = lengths.map((l) => l.toJSON());

  // Fetch lab check
  const { BilletLabCheck } = await import("./billetLabModel.js");
  const lab = await BilletLabCheck.findOne({ heat_id: heat._id });
  if (lab) {
    result.lab_check_id = lab._id.toString();
    result.lab_verdict = lab.verdict;
    result.test_certificate_no = lab.test_certificate_no;
    result.lab_tested_at = lab.tested_at;
    result.c_percent = lab.c_percent;
    result.mn_percent = lab.mn_percent;
    result.si_percent = lab.si_percent;
    result.s_percent = lab.s_percent;
    result.p_percent = lab.p_percent;
    result.cr_percent = lab.cr_percent;
    result.ni_percent = lab.ni_percent;
    result.mo_percent = lab.mo_percent;
    result.cu_percent = lab.cu_percent;
    result.other_elements = lab.other_elements || {};
    result.surface_quality = lab.surface_quality;
    result.internal_soundness = lab.internal_soundness;
    result.lab_remarks = lab.lab_remarks;
  } else {
    result.lab_check_id = null;
    result.lab_verdict = null;
    result.test_certificate_no = null;
    result.lab_tested_at = null;
    result.other_elements = {};
  }

  return result;
};

export const findHeatByNumber = async (heatNumber) => {
  if (!heatNumber) return null;
  const clean = String(heatNumber).trim().toUpperCase();
  const heat = await BilletHeat.findOne({ heat_number: clean });
  if (!heat) return null;
  return await findHeatById(heat._id);
};

export const updateHeat = async (id, updateData) => {
  let heat = null;
  if (mongoose.isValidObjectId(id)) {
    heat = await BilletHeat.findById(id);
  }
  if (!heat) {
    heat = await BilletHeat.findOne({ heat_number: String(id).trim().toUpperCase() });
  }
  if (!heat) return null;

  const allowedFields = ["grade", "section", "status", "remarks"];
  for (const field of allowedFields) {
    if (updateData[field] !== undefined) {
      heat[field] = updateData[field];
    }
  }

  await heat.save();
  return await findHeatById(heat._id);
};

export const deleteHeat = async (id) => {
  let heat = null;
  if (mongoose.isValidObjectId(id)) {
    heat = await BilletHeat.findById(id);
  }
  if (!heat) {
    heat = await BilletHeat.findOne({ heat_number: String(id).trim().toUpperCase() });
  }
  if (!heat) return null;

  const deletedHeat = heat.toJSON();
  await BilletHeat.findByIdAndDelete(heat._id);
  await BilletLength.deleteMany({ heat_id: heat._id });

  const { BilletLabCheck } = await import("./billetLabModel.js");
  await BilletLabCheck.deleteMany({ heat_id: heat._id });

  return deletedHeat;
};

export default BilletHeat;
