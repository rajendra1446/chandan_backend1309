import express from "express";
import {
  addRejection,
  getRejections,
  getRejection,
  editRejection,
  removeRejection
} from "../controller/rejectionController.js";
import { verifyAuth } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { validateBody, schemas } from "../middleware/validationMiddleware.js";

const router = express.Router();

router.post(
  "/",
  verifyAuth,
  authorizeRoles("ADMIN", "PLANT_MANAGER", "OPERATOR"),
  validateBody(schemas.createRejection),
  addRejection
);

router.get("/", verifyAuth, getRejections);
router.get("/:id", verifyAuth, getRejection);

router.put(
  "/:id",
  verifyAuth,
  authorizeRoles("ADMIN", "PLANT_MANAGER"),
  validateBody(schemas.updateRejection),
  editRejection
);

router.delete(
  "/:id",
  verifyAuth,
  authorizeRoles("ADMIN"),
  removeRejection
);

export default router;
