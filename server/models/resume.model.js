import mongoose from "mongoose";

const masterySchema = new mongoose.Schema(
  {
    currentLevel: {
      type: Number, // 1 to 5
      default: 1,
    },
    averageScore: {
      type: Number,
      default: 0,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    trend: {
      type: String, // "improving", "needs_practice", "stable"
      default: "stable",
    },
    demonstrated: [String],
    weakAreas: [String],
    lastTested: Date,
  },
  { _id: false }
);

const resumeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    resumeHash: {
      type: String,
      required: true,
    },
    resumeText: {
      type: String,
    },
    skills: [String],
    projects: [String],
    technicalMastery: {
      type: Map,
      of: masterySchema,
      default: {},
    },
    hrMastery: {
      type: Map,
      of: masterySchema,
      default: {},
    },
    interviewCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Compound unique index to prevent duplicate identical resumes per user
resumeSchema.index({ userId: 1, resumeHash: 1 }, { unique: true });

const Resume = mongoose.model("Resume", resumeSchema);

export default Resume;
