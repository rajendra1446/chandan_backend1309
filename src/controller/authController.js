import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import {
  createUser,
  findUserByEmail,
  findUserById,
  getAllUsers,
  updateUser,
  deleteUser
} from "../model/userModel.js";

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET || "chandan_steel_secret_0909",
    { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
  );
};

export const register = async (req, res, next) => {
  try {
    const { name, email, password, role, department } = req.body;

    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "A user with this email already exists."
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await createUser({
      name,
      email,
      password_hash: hashedPassword,
      role: role || "OPERATOR",
      department
    });

    const token = generateToken(newUser);

    res.status(201).json({
      success: true,
      message: "User registered successfully.",
      data: {
        user: newUser,
        token
      }
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: "Your account is deactivated. Contact administrator."
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    const token = generateToken(user);

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      is_active: user.is_active
    };

    res.json({
      success: true,
      message: "Login successful.",
      data: {
        user: safeUser,
        token
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: req.user
    });
  } catch (error) {
    next(error);
  }
};

export const getUsers = async (req, res, next) => {
  try {
    const users = await getAllUsers();
    res.json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    next(error);
  }
};

export const editUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, role, department, is_active } = req.body;

    const updated = await updateUser(id, { name, role, department, is_active });
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: `User #${id} not found.`
      });
    }

    res.json({
      success: true,
      message: "User updated successfully.",
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

export const removeUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (String(id) === String(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own active admin account."
      });
    }

    const deleted = await deleteUser(id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: `User #${id} not found.`
      });
    }

    res.json({
      success: true,
      message: "User deleted successfully.",
      data: deleted
    });
  } catch (error) {
    next(error);
  }
};
