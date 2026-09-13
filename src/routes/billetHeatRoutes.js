import express from "express";
import {
  createHeat,
  getHeats,
  getHeat,
  editHeat,
  removeHeat,
  addLength,
  getLength,
  editLength,
  removeLength
} from "../controller/billetHeatController.js";
import { verifyAuth } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { validateBody, schemas } from "../middleware/validationMiddleware.js";

const router = express.Router();

// ===================================
// Billet Heats Routes
// ===================================
router.post(
  "/heats",
  verifyAuth,
  authorizeRoles("ADMIN", "PLANT_MANAGER", "STORE_MANAGER", "OPERATOR"),
  validateBody(schemas.createHeat),
  createHeat
);

router.get("/heats", verifyAuth, getHeats);
router.get("/heats/:id", verifyAuth, getHeat);

router.put(
  "/heats/:id",
  verifyAuth,
  authorizeRoles("ADMIN", "PLANT_MANAGER", "STORE_MANAGER"),
  validateBody(schemas.updateHeat),
  editHeat
);

router.delete(
  "/heats/:id",
  verifyAuth,
  authorizeRoles("ADMIN"),
  removeHeat
);

// ===================================
// Billet Lengths Routes ("length add different different")
// ===================================
router.post(
  "/lengths",
  verifyAuth,
  authorizeRoles("ADMIN", "PLANT_MANAGER", "STORE_MANAGER", "OPERATOR"),
  validateBody(schemas.addLength),
  addLength
);

router.get("/lengths/:id", verifyAuth, getLength);

router.put(
  "/lengths/:id",
  verifyAuth,
  authorizeRoles("ADMIN", "PLANT_MANAGER", "STORE_MANAGER"),
  validateBody(schemas.updateLength),
  editLength
);

router.delete(
  "/lengths/:id",
  verifyAuth,
  authorizeRoles("ADMIN", "PLANT_MANAGER", "STORE_MANAGER"),
  removeLength
);

export default router;
