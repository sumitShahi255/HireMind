import express from "express";
import isAuth from "../middlewares/isAuth.js";
import { upload } from "../middlewares/multer.js";
import { uploadProctoringChunk } from "../controllers/proctoring.controller.js";

const router = express.Router();

router.post("/upload-chunk", isAuth, upload.single("chunk"), uploadProctoringChunk);

export default router;
