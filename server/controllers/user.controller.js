import User from "../models/user.model.js";
import Interview from "../models/dynamicInterview.model.js";
import CodingInterview from "../models/codingInterview.model.js";

export const getCurrentUser = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.status(200).json(user);
  } catch (error) {
    return res.status(500).json({ message: `Failed to get currentUser: ${error.message}` });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const userId = req.userId;
    const {
      name,
      headline,
      bio,
      phone,
      location,
      targetRole,
      experienceLevel,
      skills,
      githubUrl,
      linkedinUrl,
      portfolioUrl,
      avatarUrl
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Name is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.name = name.trim();
    if (headline !== undefined) user.headline = headline.trim();
    if (bio !== undefined) user.bio = bio.trim();
    if (phone !== undefined) user.phone = phone.trim();
    if (location !== undefined) user.location = location.trim();
    if (targetRole !== undefined) user.targetRole = targetRole.trim();
    if (experienceLevel !== undefined) user.experienceLevel = experienceLevel.trim();
    if (githubUrl !== undefined) user.githubUrl = githubUrl.trim();
    if (linkedinUrl !== undefined) user.linkedinUrl = linkedinUrl.trim();
    if (portfolioUrl !== undefined) user.portfolioUrl = portfolioUrl.trim();
    if (avatarUrl !== undefined) user.avatarUrl = avatarUrl.trim();

    if (skills !== undefined) {
      if (Array.isArray(skills)) {
        user.skills = skills.map(s => String(s).trim()).filter(Boolean);
      } else if (typeof skills === "string") {
        user.skills = skills.split(",").map(s => s.trim()).filter(Boolean);
      }
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user
    });
  } catch (error) {
    return res.status(500).json({ message: `Failed to update profile: ${error.message}` });
  }
};

export const getUserStats = async (req, res) => {
  try {
    const userId = req.userId;
    const [mockCount, codingCount, user] = await Promise.all([
      Interview.countDocuments({ userId }),
      CodingInterview.countDocuments({ userId }),
      User.findById(userId).select("credits createdAt name email")
    ]);

    return res.status(200).json({
      mockInterviewsCount: mockCount || 0,
      codingInterviewsCount: codingCount || 0,
      credits: user?.credits || 0,
      memberSince: user?.createdAt
    });
  } catch (error) {
    return res.status(500).json({ message: `Failed to get user stats: ${error.message}` });
  }
};

export const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }

    const userId = req.userId;
    const baseUrl = process.env.NODE_ENV === "production"
      ? "https://hiremind-0acr.onrender.com"
      : `http://localhost:${process.env.PORT || 8000}`;
    const avatarUrl = `${baseUrl}/public/avatars/${req.file.filename}`;

    const user = await User.findByIdAndUpdate(
      userId,
      { avatarUrl },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Avatar uploaded successfully",
      avatarUrl,
      user
    });
  } catch (error) {
    return res.status(500).json({ message: `Avatar upload failed: ${error.message}` });
  }
};

