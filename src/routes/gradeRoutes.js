import express from "express";
import { findAllGrades, createGrade } from "../model/gradeModel.js";
import { verifyAuth } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.get("/", verifyAuth, async (req, res, next) => {
  try {
    const onlyActive = req.query.all !== "true";
    const grades = await findAllGrades(onlyActive);
    res.json({
      success: true,
      data: grades
    });
  } catch (error) {
    next(error);
  }
});

router.post("/", verifyAuth, authorizeRoles("ADMIN"), async (req, res, next) => {
  try {
    const grade = await createGrade(req.body);
    res.status(201).json({
      success: true,
      message: `Grade '${grade.code}' created successfully.`,
      data: grade
    });
  } catch (error) {
    next(error);
  }
});

export default router;
