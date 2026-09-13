import express from "express";
import { AUTHORIZED_PLANTS } from "../config/plants.js";
import { findAllPlantUnits, createPlantUnit } from "../model/plantUnitModel.js";
import { verifyAuth } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.get("/", verifyAuth, async (req, res, next) => {
  try {
    // Deliver strictly the 7 authorized operational plants
    res.json({
      success: true,
      data: AUTHORIZED_PLANTS
    });
  } catch (error) {
    next(error);
  }
});

router.post("/", verifyAuth, authorizeRoles("ADMIN"), async (req, res, next) => {
  try {
    const plant = await createPlantUnit(req.body);
    res.status(201).json({
      success: true,
      message: `Plant unit '${plant.name}' (${plant.code}) created successfully.`,
      data: plant
    });
  } catch (error) {
    next(error);
  }
});

export default router;
