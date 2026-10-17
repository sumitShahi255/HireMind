import dotenv from "dotenv"
dotenv.config()
import express from "express"
import connectDB from "./config/connectDB.js";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRouter from "./routes/auth.route.js";
import userRouter from "./routes/user.route.js";

import paymentRouter from "./routes/payment.route.js";
import codingInterviewRouter from "./routes/codingInterview.route.js";
import proctoringRouter from "./routes/proctoring.route.js";
import dynamicInterviewRouter from "./routes/dynamicInterview.route.js";
import evaluationRouter from "./routes/evaluation.route.js";


import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors({
  origin: ["https://hire-mind-teal.vercel.app", "http://localhost:5173"],
  credentials: true
}))

app.use(express.json());
app.use(cookieParser());
app.use("/public", express.static(path.join(__dirname, "public")));

app.use("/api/auth", authRouter);
app.use("/api/user", userRouter);

app.use("/api/payment", paymentRouter);
app.use("/api/coding-interview", codingInterviewRouter);
app.use("/api/proctoring", proctoringRouter);
app.use("/api/dynamic-interview", dynamicInterviewRouter);
app.use("/api/evaluation", evaluationRouter);



const PORT = process.env.PORT || 6000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});