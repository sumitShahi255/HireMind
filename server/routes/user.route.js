import express from "express";
import isAuth from "../middlewares/isAuth.js";
import { getCurrentUser, updateProfile, getUserStats, uploadAvatar } from "../controllers/user.controller.js";
import { avatarUpload } from "../middlewares/multer.js";

const userRouter = express.Router();

userRouter.get("/current-user", isAuth, getCurrentUser);
userRouter.put("/update-profile", isAuth, updateProfile);
userRouter.get("/stats", isAuth, getUserStats);
userRouter.post("/upload-avatar", isAuth, avatarUpload.single("avatar"), uploadAvatar);

export default userRouter;