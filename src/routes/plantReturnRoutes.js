import express from "express";
import {
  addReturn,
  getReturns,
  getReturn,
  editReturn,
  removeReturn
} from "../controller/plantReturnController.js";
import { verifyAuth } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { validateBody, schemas } from "../middleware/validationMiddleware.js";

const router = express.Router();

router.post(
  "/",
  verifyAuth,
  authorizeRoles("ADMIN", "PLANT_MANAGER", "STORE_MANAGER"),
  validateBody(schemas.createReturn),
  addReturn
);

router.get("/", verifyAuth, getReturns);
router.get("/:id", verifyAuth, getReturn);

router.put(
  "/:id",
  verifyAuth,
  authorizeRoles("ADMIN", "PLANT_MANAGER"),
  validateBody(schemas.updateReturn),
  editReturn
);

router.delete(
  "/:id",
  verifyAuth,
  authorizeRoles("ADMIN"),
  removeReturn
);

export default router;
