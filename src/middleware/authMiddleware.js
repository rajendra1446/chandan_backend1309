import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { User } from "../model/userModel.js";

export const verifyAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please provide a valid Bearer token in the Authorization header."
      });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Malformed token. Bearer token is missing."
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "chandan_steel_secret_0909");

    if (!decoded.id || !mongoose.isValidObjectId(decoded.id)) {
      return res.status(401).json({
        success: false,
        message: "Malformed token: invalid user identifier."
      });
    }

    // Fetch user from DB to confirm user is active and has up-to-date role
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User associated with this token no longer exists."
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: "User account has been deactivated. Please contact the administrator."
      });
    }

    req.user = user.toJSON();
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token has expired. Please log in again."
      });
    }
    return res.status(401).json({
      success: false,
      message: "Invalid authentication token: " + error.message
    });
  }
};

export default verifyAuth;
