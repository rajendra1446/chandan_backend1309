import express from "express";
import {
  createDispatch,
  getDispatches,
  getDispatch,
  editDispatch,
  removeDispatch
} from "../controller/dispatchController.js";
import { verifyAuth } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { validateBody, schemas } from "../middleware/validationMiddleware.js";

const router = express.Router();

router.post(
  "/",
  verifyAuth,
  authorizeRoles("ADMIN", "PLANT_MANAGER", "STORE_MANAGER"),
  validateBody(schemas.createDispatch),
  createDispatch
);

router.get("/", verifyAuth, getDispatches);
router.get("/:id", verifyAuth, getDispatch);

router.put(
  "/:id",
  verifyAuth,
  authorizeRoles("ADMIN", "PLANT_MANAGER", "STORE_MANAGER"),
  validateBody(schemas.updateDispatch),
  editDispatch
);

router.delete(
  "/:id",
  verifyAuth,
  authorizeRoles("ADMIN", "PLANT_MANAGER"),
  removeDispatch
);

export default router;
