import express from "express";
import isAuth from "../middlewares/isAuth.js";
import { 
  startDynamicInterview, 
  submitDynamicAnswer, 
  finishDynamicInterview,
  getDynamicInterviewReport,
  analyzeResume,
  getMyInterviews
} from "../controllers/dynamicInterview.controller.js";
import { upload } from "../middlewares/multer.js";

const router = express.Router();

router.post("/resume", isAuth, upload.single("resume"), analyzeResume);
router.post("/start", isAuth, startDynamicInterview);
router.post("/submit-answer", isAuth, submitDynamicAnswer);
router.post("/finish", isAuth, finishDynamicInterview);
router.get("/report/:id", isAuth, getDynamicInterviewReport);
router.get("/get-interview", isAuth, getMyInterviews);

export default router;
