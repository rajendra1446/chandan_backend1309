import mongoose from "mongoose";

const plantUnitSchema = new mongoose.Schema(
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
    unit_type: {
      type: String,
      enum: ["ROLLING_MILL", "BRIGHT_BAR", "WIRE_ROD", "FORGING", "YARD", "SMS", "OTHER"],
      default: "ROLLING_MILL"
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

export const PlantUnit =
  mongoose.models.PlantUnit || mongoose.model("PlantUnit", plantUnitSchema);

export const findAllPlantUnits = async (onlyActive = true) => {
  const query = onlyActive ? { is_active: true } : {};
  const units = await PlantUnit.find(query).sort({ code: 1 });
  return units.map((u) => u.toJSON());
};

export const findPlantUnitByCode = async (code) => {
  if (!code) return null;
  const unit = await PlantUnit.findOne({ code: code.trim().toUpperCase() });
  return unit ? unit.toJSON() : null;
};

export const createPlantUnit = async (data) => {
  const code = data.code.trim().toUpperCase();
  const existing = await PlantUnit.findOne({ code });
  if (existing) {
    throw new Error(`Plant Unit with code '${code}' already exists.`);
  }
  const unit = await PlantUnit.create({
    code,
    name: data.name.trim(),
    unit_type: data.unit_type || "ROLLING_MILL",
    is_active: data.is_active !== undefined ? Boolean(data.is_active) : true,
    description: data.description ? data.description.trim() : null
  });
  return unit.toJSON();
};
