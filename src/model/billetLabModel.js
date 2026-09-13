import mongoose from "mongoose";

const billetLabCheckSchema = new mongoose.Schema(
  {
    heat_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BilletHeat",
      required: true,
      unique: true,
      index: true
    },
    heat_number: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    test_certificate_no: {
      type: String,
      trim: true
    },
    c_percent: { type: Number, default: 0.0 },
    mn_percent: { type: Number, default: 0.0 },
    si_percent: { type: Number, default: 0.0 },
    s_percent: { type: Number, default: 0.0 },
    p_percent: { type: Number, default: 0.0 },
    cr_percent: { type: Number, default: 0.0 },
    ni_percent: { type: Number, default: 0.0 },
    mo_percent: { type: Number, default: 0.0 },
    cu_percent: { type: Number, default: 0.0 },
    other_elements: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    surface_quality: {
      type: String,
      default: "Clean, Sound"
    },
    internal_soundness: {
      type: String,
      default: "Sound"
    },
    verdict: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "ON_HOLD", "CONDITIONAL_PASS"],
      default: "PENDING",
      index: true
    },
    tested_by_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    approved_by_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    tested_at: {
      type: Date,
      default: Date.now
    },
    lab_remarks: {
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

export const BilletLabCheck =
  mongoose.models.BilletLabCheck || mongoose.model("BilletLabCheck", billetLabCheckSchema);

export const createOrUpdateLabCheck = async (heatId, labData, userId) => {
  const { BilletHeat } = await import("./billetHeatModel.js");

  let heat = null;
  if (mongoose.isValidObjectId(heatId)) {
    heat = await BilletHeat.findById(heatId);
  }
  if (!heat) {
    heat = await BilletHeat.findOne({ heat_number: String(heatId).trim().toUpperCase() });
  }

  if (!heat) {
    throw new Error(`Heat with ID ${heatId} does not exist.`);
  }

  const verdict = labData.verdict || "PENDING";
  const validUserId = userId && mongoose.isValidObjectId(userId) ? userId : null;

  let lab = await BilletLabCheck.findOne({ heat_id: heat._id });

  if (lab) {
    if (labData.test_certificate_no !== undefined) lab.test_certificate_no = labData.test_certificate_no;
    if (labData.c_percent !== undefined) lab.c_percent = Number(labData.c_percent);
    if (labData.mn_percent !== undefined) lab.mn_percent = Number(labData.mn_percent);
    if (labData.si_percent !== undefined) lab.si_percent = Number(labData.si_percent);
    if (labData.s_percent !== undefined) lab.s_percent = Number(labData.s_percent);
    if (labData.p_percent !== undefined) lab.p_percent = Number(labData.p_percent);
    if (labData.cr_percent !== undefined) lab.cr_percent = Number(labData.cr_percent);
    if (labData.ni_percent !== undefined) lab.ni_percent = Number(labData.ni_percent);
    if (labData.mo_percent !== undefined) lab.mo_percent = Number(labData.mo_percent);
    if (labData.cu_percent !== undefined) lab.cu_percent = Number(labData.cu_percent);
    if (labData.other_elements !== undefined) lab.other_elements = labData.other_elements;
    if (labData.surface_quality !== undefined) lab.surface_quality = labData.surface_quality;
    if (labData.internal_soundness !== undefined) lab.internal_soundness = labData.internal_soundness;
    if (labData.verdict !== undefined) lab.verdict = verdict;
    if (verdict === "APPROVED" && validUserId) lab.approved_by_id = validUserId;
    if (labData.lab_remarks !== undefined) lab.lab_remarks = labData.lab_remarks;
    await lab.save();
  } else {
    lab = await BilletLabCheck.create({
      heat_id: heat._id,
      heat_number: heat.heat_number,
      test_certificate_no: labData.test_certificate_no || `TC-${heat.heat_number}`,
      c_percent: labData.c_percent !== undefined ? Number(labData.c_percent) : 0,
      mn_percent: labData.mn_percent !== undefined ? Number(labData.mn_percent) : 0,
      si_percent: labData.si_percent !== undefined ? Number(labData.si_percent) : 0,
      s_percent: labData.s_percent !== undefined ? Number(labData.s_percent) : 0,
      p_percent: labData.p_percent !== undefined ? Number(labData.p_percent) : 0,
      cr_percent: labData.cr_percent !== undefined ? Number(labData.cr_percent) : 0,
      ni_percent: labData.ni_percent !== undefined ? Number(labData.ni_percent) : 0,
      mo_percent: labData.mo_percent !== undefined ? Number(labData.mo_percent) : 0,
      cu_percent: labData.cu_percent !== undefined ? Number(labData.cu_percent) : 0,
      other_elements: labData.other_elements || {},
      surface_quality: labData.surface_quality || "Clean, Sound",
      internal_soundness: labData.internal_soundness || "Sound",
      verdict,
      tested_by_id: validUserId,
      approved_by_id: verdict === "APPROVED" ? validUserId : null,
      lab_remarks: labData.lab_remarks || null
    });
  }

  // Sync heat status according to verdict
  let newHeatStatus = "LAB_PENDING";
  if (verdict === "APPROVED") newHeatStatus = "LAB_APPROVED";
  else if (verdict === "REJECTED") newHeatStatus = "LAB_REJECTED";
  else if (verdict === "ON_HOLD") newHeatStatus = "ON_HOLD";

  heat.status = newHeatStatus;
  await heat.save();

  return await findLabCheckById(lab._id);
};

export const findLabCheckById = async (id) => {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  const lab = await BilletLabCheck.findById(id)
    .populate("tested_by_id", "name")
    .populate("approved_by_id", "name");
  if (!lab) return null;

  const json = lab.toJSON();
  json.tested_by_name = lab.tested_by_id ? lab.tested_by_id.name : null;
  json.approved_by_name = lab.approved_by_id ? lab.approved_by_id.name : null;
  return json;
};

export const findLabCheckByHeatId = async (heatId) => {
  if (!heatId) return null;
  const { BilletHeat } = await import("./billetHeatModel.js");

  let query = {};
  if (mongoose.isValidObjectId(heatId)) {
    query = { heat_id: heatId };
  } else {
    const heat = await BilletHeat.findOne({ heat_number: String(heatId).trim().toUpperCase() });
    if (!heat) return null;
    query = { heat_id: heat._id };
  }

  const lab = await BilletLabCheck.findOne(query)
    .populate("tested_by_id", "name")
    .populate("approved_by_id", "name");
  if (!lab) return null;

  const json = lab.toJSON();
  json.tested_by_name = lab.tested_by_id ? lab.tested_by_id.name : null;
  json.approved_by_name = lab.approved_by_id ? lab.approved_by_id.name : null;
  return json;
};

export const updateLabCheck = async (id, labData, userId) => {
  const existing = await findLabCheckById(id);
  if (!existing) return null;
  return await createOrUpdateLabCheck(existing.heat_id, labData, userId);
};

export const deleteLabCheck = async (id) => {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  const lab = await BilletLabCheck.findById(id);
  if (!lab) return null;

  const deleted = lab.toJSON();
  const heatId = lab.heat_id;
  await BilletLabCheck.findByIdAndDelete(id);

  const { BilletHeat } = await import("./billetHeatModel.js");
  const heat = await BilletHeat.findById(heatId);
  if (heat) {
    heat.status = "CAST";
    await heat.save();
  }

  return deleted;
};

export default BilletLabCheck;
