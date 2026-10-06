import mongoose from "mongoose";

const testCaseSchema = new mongoose.Schema({
  input: { type: String, default: "" },
  expectedOutput: { type: String, default: "" },
  isHidden: { type: Boolean, default: false },
  passed: { type: Boolean, default: false }
});

const exampleSchema = new mongoose.Schema({
  input: { type: String },
  output: { type: String },
  explanation: { type: String }
});

const questionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  problemStatement: { type: String, required: true },
  constraints: { type: String },
  examples: [exampleSchema],
  expectedComplexity: { type: String },
  codeTemplate: { type: String },
  codeTemplates: { type: mongoose.Schema.Types.Mixed },
  checker: {
    enabled: { type: Boolean, default: false },
    language: { type: String, default: "javascript" },
    version: { type: Number, default: 1 },
    code: { type: String, default: "" }
  },
  testCases: [testCaseSchema],
  visibleTestCases: [testCaseSchema],
  hiddenTestCases: [testCaseSchema],
  topic: { type: String, default: "" },
  subtopic: { type: String, default: "" },
  pattern: { type: String, default: "" },
  hash: { type: String, default: "" },
  companyOrigin: { type: String, default: "" },
  coreAlgorithm: { type: String, default: "" },
  qualityScore: { type: Number, default: 100 },
  leetcodeEquivalent: {
    difficulty: { type: String, default: "" },
    pattern: { type: String, default: "" }
  },
  roundType: { type: String, default: "General" },
  version: { type: Number, default: 1 },
  userCode: { type: String, default: "" },
  status: { type: String, enum: ["Pending", "Passed", "Failed", "Unattempted"], default: "Pending" },
  codeHash: { type: String, default: "" },
  runResult: {
    stdout: { type: String, default: "" },
    stderr: { type: String, default: "" },
    runTime: { type: Number, default: 0 },
    memory: { type: Number, default: 0 },
    passed: { type: Boolean, default: false }
  },
  aiEvaluation: {
    timeComplexity: { type: String, default: "" },
    spaceComplexity: { type: String, default: "" },
    qualityScore: { type: Number, default: 0 },
    optimizations: { type: String, default: "" },
    edgeCases: { type: String, default: "" }
  },
  followUpAnswers: {
    whyApproach: { type: String, default: "" },
    canOptimize: { type: String, default: "" },
    timeComplexity: { type: String, default: "" }
  }
});

const codingInterviewSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  company: {
    type: String,
    required: true
  },
  language: {
    type: String,
    required: true
  },
  difficulty: {
    type: String,
    required: true
  },
  questions: [questionSchema],
  score: {
    type: Number,
    default: 0
  },
  totalDetections: {
    type: Number,
    default: 0
  },
  proctoringLogs: [
    {
      event: { type: String },
      timestamp: { type: Date, default: Date.now }
    }
  ],
  recordings: {
    videoChunks: [
      {
        url: { type: String },
        sequenceNumber: { type: Number },
        timestamp: { type: Date, default: Date.now }
      }
    ],
    snapshots: [
      {
        url: { type: String },
        sequenceNumber: { type: Number },
        timestamp: { type: Date, default: Date.now }
      }
    ]
  },
  status: {
    type: String,
    enum: ["Incompleted", "completed"],
    default: "Incompleted"
  },
  completedAt: {
    type: Date
  },
  followUpQuestions: [
    {
      questionId: { type: Number },
      question: { type: String },
      category: { type: String, default: "" },
      difficulty: { type: String, default: "" },
      expectedConcepts: [{ type: String }],
      correctnessScore: { type: Number, default: 0 },
      depthScore: { type: Number, default: 0 },
      communicationScore: { type: Number, default: 0 },
      optimizationScore: { type: Number, default: 0 },
      confidence: { type: String, default: "" },
      feedback: { type: String, default: "" }
    }
  ],
  followUpAnswers: [
    {
      questionId: { type: Number },
      answer: { type: String }
    }
  ],
  interviewerPersonality: {
    type: String,
    default: ""
  },
  finalEvaluation: {
    communicationScore: { type: Number, default: 0 },
    problemSolvingScore: { type: Number, default: 0 },
    optimizationScore: { type: Number, default: 0 },
    dsaKnowledge: { type: Number, default: 0 },
    overallRecommendation: { type: String, default: "" },
    isEvaluated: { type: Boolean, default: false },
    clarity: { type: Number, default: 0 },
    confidence: { type: Number, default: 0 },
    correctness: { type: Number, default: 0 },
    technicalDepth: { type: Number, default: 0 },
    optimizationUnderstanding: { type: Number, default: 0 }
  }
}, { timestamps: true });

const CodingInterview = mongoose.model("CodingInterview", codingInterviewSchema);
export default CodingInterview;
