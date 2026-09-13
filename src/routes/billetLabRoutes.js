import express from "express";
import {
  submitLabCheck,
  getLabByHeat,
  getLabById,
  editLab,
  removeLab
} from "../controller/billetLabController.js";
import { verifyAuth } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { validateBody, schemas } from "../middleware/validationMiddleware.js";

const router = express.Router();

router.post(
  "/check",
  verifyAuth,
  authorizeRoles("ADMIN", "LAB_CHEMIST"),
  validateBody(schemas.labCheck),
  submitLabCheck
);

router.get("/heat/:heatIdOrNumber", verifyAuth, getLabByHeat);
router.get("/:id", verifyAuth, getLabById);

router.put(
  "/:id",
  verifyAuth,
  authorizeRoles("ADMIN", "LAB_CHEMIST"),
  validateBody(schemas.labCheck),
  editLab
);

router.delete(
  "/:id",
  verifyAuth,
  authorizeRoles("ADMIN", "LAB_CHEMIST"),
  removeLab
);

export default router;
