import CodingInterview from "../../models/codingInterview.model.js";
import DynamicInterview from "../../models/dynamicInterview.model.js";

export const generateAssessmentReport = async () => {
  try {
    const [codingInterviews, dynamicInterviews] = await Promise.all([
      CodingInterview.find({ status: { $regex: /completed/i } }).populate("userId", "name").lean(),
      DynamicInterview.find({ status: { $regex: /completed/i } }).populate("userId", "name").lean()
    ]);

    let allInterviews = [...codingInterviews, ...dynamicInterviews];
    allInterviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    let totalScore = 0;
    let validScoresCount = 0;
    let zeroScoresCount = 0;
    
    let typeStats = {
      Coding: { attempts: 0, completedCount: 0, totalScore: 0, distribution: { "0-20": 0, "21-40": 0, "41-60": 0, "61-80": 0, "81-100": 0 } },
      Technical: { attempts: 0, completedCount: 0, totalScore: 0, distribution: { "0-20": 0, "21-40": 0, "41-60": 0, "61-80": 0, "81-100": 0 } },
      HR: { attempts: 0, completedCount: 0, totalScore: 0, distribution: { "0-20": 0, "21-40": 0, "41-60": 0, "61-80": 0, "81-100": 0 } },
      Mock: { attempts: 0, completedCount: 0, totalScore: 0, distribution: { "0-20": 0, "21-40": 0, "41-60": 0, "61-80": 0, "81-100": 0 } }
    };

    const candidates = allInterviews.map((inv, idx) => {
      const isCoding = inv.questions && inv.questions.some(q => q.aiEvaluation !== undefined);
      const fe = inv.finalEvaluation || {};
      
      let typeLabel = isCoding ? "Coding" : (inv.mode ? inv.mode : "Mock");
      if (typeLabel.toLowerCase() === "technical") typeLabel = "Technical";
      else if (typeLabel.toLowerCase() === "hr") typeLabel = "HR";
      else if (!isCoding) typeLabel = "Mock";

      const overallScoreRaw = inv.score || inv.finalScore || 0;
      const overallScore = isCoding ? overallScoreRaw : overallScoreRaw * 10;
      const isComplete = overallScore > 0;

      let evaluatedQuestions = 0;
      const multiplier = isCoding ? 1 : 10;
      let totalQ = inv.questions ? inv.questions.length : 0;

      // Type-specific metrics extraction
      let metrics = {};

      if (isCoding) {
        let passed = 0;
        let totalTestCases = 0;
        let qualitySum = 0;
        let qCount = 0;

        if (inv.questions) {
            inv.questions.forEach(q => {
                if (q.testCases) {
                    q.testCases.forEach(tc => {
                        totalTestCases++;
                        if (tc.passed) passed++;
                    });
                }
                if (q.aiEvaluation && q.aiEvaluation.qualityScore) {
                    qualitySum += q.aiEvaluation.qualityScore;
                    qCount++;
                    evaluatedQuestions++;
                }
            });
        }
        
        metrics = {
            testCasesPassed: passed,
            testCasesTotal: totalTestCases,
            codeQuality: qCount > 0 ? (qualitySum / qCount).toFixed(1) : (fe.dsaKnowledge || 0),
            efficiency: fe.optimizationScore || 0,
            correctness: fe.correctness || 0
        };
      } else {
        let commSum = 0, confSum = 0, probSum = 0, pracSum = 0, corrSum = 0, depthSum = 0;
        let qCount = 0;

        if (inv.questions) {
            inv.questions.forEach(q => {
                if (q.evaluation) {
                    commSum += q.evaluation.communication || 0;
                    confSum += q.evaluation.confidence || 0;
                    probSum += q.evaluation.technicalDepth || q.evaluation.practicalApplication || 0; // fallback if needed
                    pracSum += q.evaluation.practicalApplication || 0;
                    corrSum += q.evaluation.correctness || 0;
                    depthSum += q.evaluation.technicalDepth || 0;
                    qCount++;
                    evaluatedQuestions++;
                }
            });
        }

        metrics = {
            communication: qCount > 0 ? ((commSum / qCount) * multiplier).toFixed(1) : 0,
            confidence: qCount > 0 ? ((confSum / qCount) * multiplier).toFixed(1) : 0,
            problemSolving: qCount > 0 ? ((probSum / qCount) * multiplier).toFixed(1) : 0,
            practicalApplication: qCount > 0 ? ((pracSum / qCount) * multiplier).toFixed(1) : 0,
            correctness: qCount > 0 ? ((corrSum / qCount) * multiplier).toFixed(1) : 0,
            technicalDepth: qCount > 0 ? ((depthSum / qCount) * multiplier).toFixed(1) : 0
        };
      }

      // Analytics collection
      if (!isComplete) {
        zeroScoresCount++;
      } else {
        validScoresCount++;
        totalScore += overallScore;
      }

      if (!typeStats[typeLabel]) typeStats[typeLabel] = { attempts: 0, completedCount: 0, totalScore: 0, distribution: { "0-20": 0, "21-40": 0, "41-60": 0, "61-80": 0, "81-100": 0 } };
      typeStats[typeLabel].attempts++;
      
      if (isComplete) {
          typeStats[typeLabel].completedCount++;
          typeStats[typeLabel].totalScore += overallScore;
          
          if (overallScore <= 20) typeStats[typeLabel].distribution["0-20"]++;
          else if (overallScore <= 40) typeStats[typeLabel].distribution["21-40"]++;
          else if (overallScore <= 60) typeStats[typeLabel].distribution["41-60"]++;
          else if (overallScore <= 80) typeStats[typeLabel].distribution["61-80"]++;
          else typeStats[typeLabel].distribution["81-100"]++;
      }

      return {
        id: inv._id,
        attemptId: inv._id.toString().slice(-6).toUpperCase(),
        name: inv.candidateName || (inv.userId && inv.userId.name ? inv.userId.name : `Candidate ${idx + 1}`),
        typeLabel: typeLabel,
        date: inv.createdAt,
        overallScore: overallScore,
        detections: inv.totalDetections || 0,
        totalQuestions: totalQ,
        evaluatedQuestions: evaluatedQuestions,
        metrics: metrics
      };
    });

    const datasetSize = candidates.length;
    const avgScore = validScoresCount > 0 ? (totalScore / validScoresCount).toFixed(1) : 0;
    
    // Process Type Stats
    const processedTypeStats = Object.keys(typeStats).map(key => ({
        type: key,
        attempts: typeStats[key].attempts,
        completedCount: typeStats[key].completedCount,
        avg: typeStats[key].completedCount > 0 ? (typeStats[key].totalScore / typeStats[key].completedCount).toFixed(1) : 0,
        distribution: typeStats[key].distribution
    })).filter(t => t.attempts > 0);

    return {
      timestamp: new Date().toISOString(),
      datasetSize: datasetSize,
      analytics: {
        avgScore,
        zeroScoresCount,
        validScoresCount,
        typeStats: processedTypeStats,
        fullyEvaluatedRatio: datasetSize > 0 ? Math.round((validScoresCount / datasetSize) * 100) : 0
      },
      candidates: candidates
    };
  } catch (error) {
    console.error("Consistency Audit failed:", error);
    throw new Error("Failed to generate consistency audit.");
  }
};
