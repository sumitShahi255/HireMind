import mongoose from "mongoose";

const questionSchema = new mongoose.Schema({
  questionId: {
    type: String,
    required: true,
  },
  questionText: {
    type: String,
    required: true,
  },
  topic: {
    type: String,
  },
  subtopic: {
    type: String,
  },
  category: {
    type: String,
  },
  difficulty: {
    type: Number, // 1 to 5
    default: 3,
  },
  answer: {
    type: String,
  },
  evaluation: {
    confidence: { type: Number, default: 0 },
    communication: { type: Number, default: 0 },
    correctness: { type: Number, default: 0 },
    technicalDepth: { type: Number, default: 0 },
    practicalApplication: { type: Number, default: 0 },
    strengths: [String],
    weaknesses: [String],
    missingConcepts: [String],
    summary: String,
  },
  isFollowUp: {
    type: Boolean,
    default: false,
  },
  askedAt: {
    type: Date,
  },
  answeredAt: {
    type: Date,
  },
});

const interviewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    resumeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Resume",
    },
    role: {
      type: String,
      required: true,
    },
    experience: {
      type: String,
      required: true,
    },
    mode: {
      type: String,
      enum: ["HR", "Technical", "TECHNICAL"],
      required: true,
    },
    resumeText: {
      type: String,
    },
    projects: [String],
    skills: [String],
    interviewConfig: {
      minQuestions: { type: Number, default: 5 },
      maxQuestions: { type: Number, default: 5 },
    },
    questions: [questionSchema],
    finalScore: {
      type: Number,
      default: 0,
    },
    strengths: [String],
    weaknesses: [String],
    status: {
      type: String,
      enum: ["Incompleted", "Completed"],
      default: "Incompleted",
    },
    recordings: {
      videoChunks: [
        {
          url: { type: String },
          sequenceNumber: { type: Number },
          timestamp: { type: Date, default: Date.now },
        },
      ],
      snapshots: [
        {
          url: { type: String },
          sequenceNumber: { type: Number },
          timestamp: { type: Date, default: Date.now },
        },
      ],
    },
    totalDetections: {
      type: Number,
      default: 0,
    },
    proctoringLogs: [
      {
        event: { type: String },
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

const Interview = mongoose.model("DynamicInterview", interviewSchema);

export default Interview;
