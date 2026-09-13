import express from "express";
import {
  recordProduct,
  getProducts,
  getProduct,
  editProduct,
  removeProduct
} from "../controller/finishedProductController.js";
import { verifyAuth } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { validateBody, schemas } from "../middleware/validationMiddleware.js";

const router = express.Router();

router.post(
  "/",
  verifyAuth,
  authorizeRoles("ADMIN", "PLANT_MANAGER", "OPERATOR"),
  validateBody(schemas.createFinishedProduct),
  recordProduct
);

router.get("/", verifyAuth, getProducts);
router.get("/:id", verifyAuth, getProduct);

router.put(
  "/:id",
  verifyAuth,
  authorizeRoles("ADMIN", "PLANT_MANAGER"),
  validateBody(schemas.updateFinishedProduct),
  editProduct
);

router.delete(
  "/:id",
  verifyAuth,
  authorizeRoles("ADMIN"),
  removeProduct
);

export default router;
