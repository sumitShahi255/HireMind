import mongoose from "mongoose";

const questionBankSchema = new mongoose.Schema({
   title: String,
   topic: String,
   subtopic: String,
   difficulty: String,
   pattern: String,
   coreAlgorithm: String,
   companyTags: [String],
   companies: [String],
   qualityScore: Number,
   frequencyScore: {
      type: Number,
      default: 1
   },
   problemStatement: String,
   constraints: String,
   examples: Array,
   expectedComplexity: String,
   codeTemplates: {
      python: String,
      javascript: String,
      java: String,
      cpp: String,
      c: String
   },
   functionSignature: { 
      python: String,
      javascript: String,
      java: String,
      cpp: String,
      c: String
   },
   testCases: Array,
   checker: {
      enabled: { type: Boolean, default: false },
      language: { type: String, default: "javascript" },
      version: { type: Number, default: 1 },
      code: { type: String, default: "" }
   },
   usageCount: {
      type: Number,
      default: 0
   },
   active: {
      type: Boolean,
      default: true
   },
   hash: String,
   questionHash: {
      type: String,
      index: true
   },
   familyHash: {
      type: String,
      index: true
   },
   version: {
      type: Number,
      default: 1
   },
   isVerified: {
      type: Boolean,
      default: false
   }
}, {
   timestamps: true
});

questionBankSchema.index({
   topic: 1,
   difficulty: 1,
   active: 1
});

export default mongoose.model("QuestionBank", questionBankSchema);
