import mongoose from "mongoose";

const gradeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    standard: {
      type: String,
      trim: true,
      default: "ASTM A276"
    },
    nominal_elements: {
      c: { type: String, default: null },
      mn: { type: String, default: null },
      si: { type: String, default: null },
      cr: { type: String, default: null },
      ni: { type: String, default: null },
      mo: { type: String, default: null }
    },
    is_active: {
      type: Boolean,
      default: true,
      index: true
    },
    description: {
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

export const Grade = mongoose.models.Grade || mongoose.model("Grade", gradeSchema);

export const findAllGrades = async (onlyActive = true) => {
  const query = onlyActive ? { is_active: true } : {};
  const grades = await Grade.find(query).sort({ code: 1 });
  return grades.map((g) => g.toJSON());
};

export const findGradeByCode = async (code) => {
  if (!code) return null;
  const grade = await Grade.findOne({ code: code.trim().toUpperCase() });
  return grade ? grade.toJSON() : null;
};

export const createGrade = async (data) => {
  const code = data.code.trim().toUpperCase();
  const existing = await Grade.findOne({ code });
  if (existing) {
    throw new Error(`Grade '${code}' already exists.`);
  }
  const grade = await Grade.create({
    code,
    name: data.name.trim(),
    standard: data.standard || "ASTM A276",
    nominal_elements: data.nominal_elements || {},
    is_active: data.is_active !== undefined ? Boolean(data.is_active) : true,
    description: data.description ? data.description.trim() : null
  });
  return grade.toJSON();
};
