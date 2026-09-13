import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    password_hash: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ["ADMIN", "PLANT_MANAGER", "LAB_CHEMIST", "STORE_MANAGER", "OPERATOR"],
      default: "OPERATOR"
    },
    department: {
      type: String,
      trim: true,
      default: null
    },
    is_active: {
      type: Boolean,
      default: true
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

export const User = mongoose.models.User || mongoose.model("User", userSchema);

export const createUser = async ({ name, email, password_hash, role = "OPERATOR", department }) => {
  const user = await User.create({
    name,
    email,
    password_hash,
    role,
    department
  });
  return user.toJSON();
};

export const findUserByEmail = async (email) => {
  if (!email) return null;
  const user = await User.findOne({ email: email.trim().toLowerCase() });
  return user ? user.toJSON() : null;
};

export const findUserById = async (id) => {
  if (!id) return null;
  if (!mongoose.isValidObjectId(id)) return null;
  const user = await User.findById(id);
  return user ? user.toJSON() : null;
};

export const getAllUsers = async () => {
  const users = await User.find().sort({ created_at: 1 });
  return users.map((u) => u.toJSON());
};

export const updateUser = async (id, { name, role, department, is_active }) => {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  const updates = {};
  if (name !== undefined) updates.name = name;
  if (role !== undefined) updates.role = role;
  if (department !== undefined) updates.department = department;
  if (is_active !== undefined) updates.is_active = is_active;

  const updated = await User.findByIdAndUpdate(id, updates, { returnDocument: "after" });
  return updated ? updated.toJSON() : null;
};

export const deleteUser = async (id) => {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  const deleted = await User.findByIdAndDelete(id);
  return deleted ? deleted.toJSON() : null;
};

export default User;
