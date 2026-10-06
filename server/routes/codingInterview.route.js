import express from "express";
import isAuth from "../middlewares/isAuth.js";
import {
  startCodingInterview,
  runCode,
  submitCodingInterview,
  submitFinalEvaluation,
  getCodingInterviewReport,
  getCodingInterviews,
  checkJudge0Health,
  submitQuestion
} from "../controllers/codingInterview.controller.js";

const router = express.Router();

router.post("/start", isAuth, startCodingInterview);
router.post("/run", isAuth, runCode);
router.post("/submit-question", isAuth, submitQuestion);
router.post("/submit", isAuth, submitCodingInterview);
router.post("/submit-final-evaluation", isAuth, submitFinalEvaluation);
router.get("/report/:id", isAuth, getCodingInterviewReport);
router.get("/history", isAuth, getCodingInterviews);
router.get("/judge0/health", isAuth, checkJudge0Health);

export default router;
