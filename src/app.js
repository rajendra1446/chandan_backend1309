import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

// Middlewares
import requestLogger from "./middleware/loggerMiddleware.js";
import { notFoundHandler, errorHandler } from "./middleware/errorMiddleware.js";

// Routes
import authRoutes from "./routes/authRoutes.js";
import billetHeatRoutes from "./routes/billetHeatRoutes.js";
import billetLabRoutes from "./routes/billetLabRoutes.js";
import dispatchRoutes from "./routes/dispatchRoutes.js";
import finishedProductRoutes from "./routes/finishedProductRoutes.js";
import rejectionRoutes from "./routes/rejectionRoutes.js";
import plantReturnRoutes from "./routes/plantReturnRoutes.js";
import traceabilityRoutes from "./routes/traceabilityRoutes.js";
import plantUnitRoutes from "./routes/plantUnitRoutes.js";
import gradeRoutes from "./routes/gradeRoutes.js";

const app = express();

// Security headers
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Request parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use(requestLogger);

// Health / Welcome Route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Chandan Steel Billet End-to-End Traceability API is running",
    version: "2.0.0",
    modules: {
      auth: "/api/auth",
      billet_heats_and_lengths: "/api/billets",
      lab_quality_checks: "/api/lab",
      plant_dispatches: "/api/dispatches",
      finished_products: "/api/finished-products",
      rejections_and_scrap: "/api/rejections",
      plant_returns: "/api/returns",
      plants_and_units: "/api/plants",
      steel_grades: "/api/grades",
      end_to_end_traceability: "/api/traceability"
    }
  });
});

// API Routes Mounting
app.use("/api/auth", authRoutes);
app.use("/api/billets", billetHeatRoutes);
app.use("/api/lab", billetLabRoutes);
app.use("/api/dispatches", dispatchRoutes);
app.use("/api/finished-products", finishedProductRoutes);
app.use("/api/rejections", rejectionRoutes);
app.use("/api/returns", plantReturnRoutes);
app.use("/api/plants", plantUnitRoutes);
app.use("/api/grades", gradeRoutes);
app.use("/api/traceability", traceabilityRoutes);

// 404 Handler
app.use(notFoundHandler);

// Global Centralized Error Handler
app.use(errorHandler);

export default app;