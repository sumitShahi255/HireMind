import mongoose from "mongoose";

const questionUsageSchema = new mongoose.Schema({
   userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
   },
   questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QuestionBank"
   },
   questionHash: String,
   questionTitle: String,
   company: String,
   difficulty: String,
   usedAt: {
      type: Date,
      default: Date.now
   }
}, {
   timestamps: true
});

questionUsageSchema.index({
   userId: 1,
   questionId: 1
});

export default mongoose.model("QuestionUsage", questionUsageSchema);
