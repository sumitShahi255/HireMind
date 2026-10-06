import CodingInterview from "../models/codingInterview.model.js";
import DynamicInterview from "../models/dynamicInterview.model.js";
import { generateExplainableScore } from "../services/evaluation/explainableEvaluator.service.js";
import { generateSkillGapAnalysis } from "../services/evaluation/skillGap.service.js";
import { generateCandidateRoadmap } from "../services/evaluation/roadmap.service.js";
import { generateAssessmentReport } from "../services/evaluation/assessmentReport.service.js";

// In-memory cache to prevent React Strict Mode or page refreshes from wasting API tokens
// We store Promises so that concurrent requests wait for the same AI execution.
const reportCache = {
  explainable: {},
  skillGap: {},
  roadmap: {}
};

export const getExplainableEvaluation = async (req, res) => {
  try {
    const { interviewId } = req.params;

    if (!interviewId) {
      return res.status(400).json({ message: "Interview ID is required" });
    }

    let interview = await CodingInterview.findById(interviewId);
    let isCoding = true;
    
    if (!interview) {
      interview = await DynamicInterview.findById(interviewId);
      isCoding = false;
    }

    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    if (reportCache.explainable[interviewId]) {
      try {
        const explanation = await reportCache.explainable[interviewId];
        return res.json({
          message: "Explainable evaluation fetched from cache",
          explanation
        });
      } catch (err) {
        // If the cached promise failed, we'll let it retry below
        delete reportCache.explainable[interviewId];
      }
    }

    // Ensure interview is completed
    if (interview.status.toLowerCase() !== "completed") {
      return res.status(400).json({ message: "Interview is not completed yet" });
    }

    // Format interview data for the AI
    let interviewData;
    if (isCoding) {
      interviewData = {
        type: "Coding",
        language: interview.language,
        company: interview.company,
        difficulty: interview.difficulty,
        questions: interview.questions.map(q => ({
          title: q.title,
          problemStatement: q.problemStatement,
          status: q.status,
          runResult: q.runResult,
          aiEvaluation: q.aiEvaluation
        })),
        followUpQuestions: interview.followUpQuestions,
        followUpAnswers: interview.followUpAnswers,
        finalEvaluationMetrics: interview.finalEvaluation
      };
    } else {
      interviewData = {
        type: `Dynamic Mock Interview (${interview.mode})`,
        role: interview.role,
        experience: interview.experience,
        mode: interview.mode,
        questions: interview.questions.map(q => ({
          questionText: q.questionText,
          evaluation: q.evaluation
        })),
        finalScore: interview.finalScore
      };
    }

    const proctoringLogs = interview.proctoringLogs;

    // Generate explainable score and cache the PROMISE
    const explanationPromise = generateExplainableScore(interviewData, proctoringLogs);
    reportCache.explainable[interviewId] = explanationPromise;

    const explanation = await explanationPromise;

    res.json({
      message: "Explainable evaluation generated successfully",
      explanation
    });

  } catch (error) {
    console.error("Error generating explainable evaluation:", error);
    res.status(500).json({ message: "Failed to generate explainable evaluation" });
  }
};

export const getSkillGapAnalysis = async (req, res) => {
  try {
    const { interviewId } = req.params;

    if (!interviewId) {
      return res.status(400).json({ message: "Interview ID is required" });
    }

    let interview = await CodingInterview.findById(interviewId);
    let isCoding = true;
    
    if (!interview) {
      interview = await DynamicInterview.findById(interviewId);
      isCoding = false;
    }

    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    if (reportCache.skillGap[interviewId]) {
      try {
        const gapAnalysis = await reportCache.skillGap[interviewId];
        return res.json({
          message: "Skill gap analysis fetched from cache",
          gapAnalysis
        });
      } catch (err) {
        delete reportCache.skillGap[interviewId];
      }
    }

    if (interview.status.toLowerCase() !== "completed") {
      return res.status(400).json({ message: "Interview is not completed yet" });
    }

    let interviewData;
    if (isCoding) {
      interviewData = {
        type: "Coding",
        language: interview.language,
        company: interview.company,
        difficulty: interview.difficulty,
        questions: interview.questions.map(q => ({
          title: q.title,
          status: q.status,
          aiEvaluation: q.aiEvaluation
        })),
        finalEvaluationMetrics: interview.finalEvaluation
      };
    } else {
       interviewData = {
        type: `Dynamic Mock Interview (${interview.mode})`,
        role: interview.role,
        experience: interview.experience,
        mode: interview.mode,
        questions: interview.questions.map(q => ({
          questionText: q.questionText,
          evaluation: q.evaluation
        })),
        finalScore: interview.finalScore
      };
    }

    const gapAnalysisPromise = generateSkillGapAnalysis(interviewData);
    reportCache.skillGap[interviewId] = gapAnalysisPromise;
    
    const gapAnalysis = await gapAnalysisPromise;

    res.json({
      message: "Skill gap analysis generated successfully",
      gapAnalysis
    });

  } catch (error) {
    console.error("Error generating skill gap analysis:", error);
    res.status(500).json({ message: "Failed to generate skill gap analysis" });
  }
};

export const getCandidateRoadmap = async (req, res) => {
  try {
    const { interviewId } = req.params;

    if (!interviewId) {
      return res.status(400).json({ message: "Interview ID is required" });
    }

    let interview = await CodingInterview.findById(interviewId);
    let isCoding = true;
    
    if (!interview) {
      interview = await DynamicInterview.findById(interviewId);
      isCoding = false;
    }

    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    if (reportCache.roadmap[interviewId]) {
      try {
        const roadmap = await reportCache.roadmap[interviewId];
        return res.json({
          message: "Candidate roadmap fetched from cache",
          roadmap
        });
      } catch (err) {
        delete reportCache.roadmap[interviewId];
      }
    }

    if (interview.status.toLowerCase() !== "completed") {
      return res.status(400).json({ message: "Interview is not completed yet" });
    }

    let interviewData;
    let candidateContext;
    if (isCoding) {
      interviewData = {
        type: "Coding",
        language: interview.language,
        company: interview.company,
        difficulty: interview.difficulty,
        questions: interview.questions.map(q => ({
          title: q.title,
          status: q.status,
          aiEvaluation: q.aiEvaluation
        })),
        finalEvaluationMetrics: interview.finalEvaluation
      };
      candidateContext = {
        difficulty: interview.difficulty,
        company: interview.company
      };
    } else {
       interviewData = {
        type: `Dynamic Mock Interview (${interview.mode})`,
        role: interview.role,
        experience: interview.experience,
        mode: interview.mode,
        questions: interview.questions.map(q => ({
          questionText: q.questionText,
          evaluation: q.evaluation
        })),
        finalScore: interview.finalScore
      };
      candidateContext = {
        difficulty: interview.experience,
        company: interview.role
      };
    }

    const gapAnalysisPromise = reportCache.skillGap[interviewId] 
      ? reportCache.skillGap[interviewId] 
      : generateSkillGapAnalysis(interviewData);
      
    reportCache.skillGap[interviewId] = gapAnalysisPromise;
    const gapAnalysis = await gapAnalysisPromise;

    const roadmapPromise = generateCandidateRoadmap(gapAnalysis, candidateContext);
    reportCache.roadmap[interviewId] = roadmapPromise;
    
    const roadmap = await roadmapPromise;

    res.json({
      message: "Candidate roadmap generated successfully",
      roadmap
    });

  } catch (error) {
    console.error("Error generating candidate roadmap:", error);
    res.status(500).json({ message: "Failed to generate candidate roadmap" });
  }
};

export const getAssessmentReport = async (req, res) => {
  try {
    const auditReport = await generateAssessmentReport();
    res.json({
      message: "Assessment report generated successfully",
      audit: auditReport
    });
  } catch (error) {
    console.error("Error generating assessment report:", error);
    res.status(500).json({ message: "Failed to generate assessment report" });
  }
};



