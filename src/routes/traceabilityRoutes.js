import express from "express";
import {
  getHeatTraceability,
  getDashboardMetrics,
  searchGlobal
} from "../controller/traceabilityController.js";
import { verifyAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

// 360-degree heat traceability timeline and material balance ledger
router.get("/heat/:heatNumber", verifyAuth, getHeatTraceability);

// Executive KPI summary metrics
router.get("/summary", verifyAuth, getDashboardMetrics);

// Global search across heats, dispatches, batches, lab test certs
router.get("/search", verifyAuth, searchGlobal);

export default router;
