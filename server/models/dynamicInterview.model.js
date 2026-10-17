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
    followUpOpportunity: { type: Boolean, default: false },
    suggestedFollowUpAngle: { type: String, default: "" },
    summary: String,
  },
  isFollowUp: {
    type: Boolean,
    default: false,
  },
  // Topic the backend assigned (ground truth for rotation enforcement)
  assignedTopic: {
    type: String,
  },
  askedAt: {
    type: Date,
  },
  answeredAt: {
    type: Date,
  },
});

// One entry per planned topic in the current interview session
const topicPlanEntrySchema = new mongoose.Schema({
  topic: { type: String, required: true },
  subtopicsTested: [String],   // subtopics already asked for this topic
  timesAsked: { type: Number, default: 0 },
  isWeak: { type: Boolean, default: false },
  category: { type: String, default: "general" },
  context: { type: String, default: "" },
}, { _id: false });

const interviewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    candidateName: {
      type: String,
      default: ""
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
      maxQuestions: { type: Number, default: 10 },
    },
    // Persistent topic plan — built once at interview start, never regenerated
    topicPlan: [topicPlanEntrySchema],
    // Pointer to the next main (non-follow-up) topic in topicPlan
    topicPlanIndex: { type: Number, default: 0 },
    // How many consecutive follow-ups have been issued for the current topic
    consecutiveFollowUps: { type: Number, default: 0 },
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
