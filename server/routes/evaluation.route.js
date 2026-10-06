import express from "express";
import { getExplainableEvaluation, getSkillGapAnalysis, getCandidateRoadmap, getAssessmentReport } from "../controllers/evaluation.controller.js";
import isAuth from "../middlewares/isAuth.js";

const router = express.Router();

router.get("/explainable/:interviewId", isAuth, getExplainableEvaluation);
router.get("/skill-gap/:interviewId", isAuth, getSkillGapAnalysis);
router.get("/roadmap/:interviewId", isAuth, getCandidateRoadmap);
router.get("/assessment-report", isAuth, getAssessmentReport);

export default router;
