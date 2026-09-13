import express from "express";
import { register, login, getMe, getUsers, editUser, removeUser } from "../controller/authController.js";
import { verifyAuth } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { validateBody, schemas } from "../middleware/validationMiddleware.js";

const router = express.Router();

// Public routes
router.post("/register", validateBody(schemas.register), register);
router.post("/login", validateBody(schemas.login), login);

// Authenticated routes
router.get("/me", verifyAuth, getMe);
router.get("/users", verifyAuth, authorizeRoles("ADMIN"), getUsers);
router.put("/users/:id", verifyAuth, authorizeRoles("ADMIN"), validateBody(schemas.updateUser), editUser);
router.delete("/users/:id", verifyAuth, authorizeRoles("ADMIN"), removeUser);

export default router;
