import fs from "fs";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { askAi } from "../services/groq.service.js";
import Interview from "../models/dynamicInterview.model.js";
import User from "../models/user.model.js";
import Resume from "../models/resume.model.js";
import crypto from "crypto";
import { generateNextQuestion } from "../services/interview/questionGenerator.service.js";
import { evaluateAnswer } from "../services/evaluation/answerEvaluator.service.js";
import { updateResumeMastery, selectTopic } from "../services/interview/interviewPlanner.service.js";
import { hrTopicSelector } from "../services/interview/hrTopicSelector.service.js";

const getStage = (questionNumber) => {
  if (questionNumber <= 2) return "Foundation";
  if (questionNumber <= 5) return "Practical Application";
  if (questionNumber <= 8) return "Deep Dive";
  return "Challenge";
};

const getAdaptiveDifficulty = (topicMastery, stage) => {
  if (!topicMastery || topicMastery.attempts === 0) {
    if (stage === "Foundation") return 1;
    if (stage === "Practical Application") return 2;
    if (stage === "Deep Dive") return 3;
    return 4;
  }
  // Use the database's progressively tracked currentLevel (1 to 5) instead of jumping based on averageScore alone.
  // This ensures a gradual step-by-step increase (1 -> 2 -> 3) over multiple attempts.
  let baseDiff = topicMastery.currentLevel || 1;

  let diff = baseDiff;
  if (stage === "Challenge") diff = Math.min(5, baseDiff + 1);
  if (stage === "Foundation") diff = Math.max(1, baseDiff - 1);
  
  return diff;
};

const getCompactHistory = async (userId, resumeId, mode) => {
  const pastInterviews = await Interview.find({ userId, resumeId, mode, status: "Completed" })
    .sort({ createdAt: -1 })
    .limit(2);
  
  if (!pastInterviews || pastInterviews.length === 0) return "";

  let compactHistory = "";
  pastInterviews.forEach((interview, index) => {
    compactHistory += `\n--- Past Interview ${index + 1} ---\n`;
    compactHistory += `Strengths: ${interview.strengths?.join(", ") || "None"}\n`;
    compactHistory += `Weaknesses: ${interview.weaknesses?.join(", ") || "None"}\n`;
    compactHistory += `Questions Asked:\n`;
    interview.questions.forEach(q => {
      compactHistory += `- [Diff: ${q.difficulty}, Topic: ${q.topic}] ${q.questionText}\n`;
    });
  });
  return compactHistory;
};

export const startDynamicInterview = async (req, res) => {
  try {
    let { role, experience, mode, resumeText, projects, skills, userName } = req.body;

    role = role?.trim();
    experience = experience?.trim();
    mode = mode?.trim();

    if (!role || !experience || !mode) {
      return res.status(400).json({ message: "Role, Experience and mode are required." });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.credits < 50) {
      return res.status(403).json({ message: "Not enough credits. Minimum 50 required." });
    }

    // 1. Resume Hash and Identity
    const safeResume = resumeText?.trim() || "None";
    const resumeHash = crypto.createHash("sha256").update(safeResume).digest("hex");

    let resume = await Resume.findOne({ userId: req.userId, resumeHash });
    if (!resume) {
      resume = await Resume.create({
        userId: req.userId,
        resumeHash,
        resumeText: safeResume,
        skills: skills || [],
        projects: projects || []
      });
    }

    // 2. Fetch Compact History
    const compactHistory = await getCompactHistory(req.userId, resume._id, mode);
    
    // 3. Determine Q1 Stage and Difficulty
    const stage = "Foundation";
    
    const masteryMap = (mode === "TECHNICAL" || mode === "Technical") ? resume.technicalMastery : resume.hrMastery;
    const q1Topic = selectTopic(resume, masteryMap, stage, [], mode);
    
    let targetDifficulty = 1;
    if (q1Topic && masteryMap) {
       const safeTopic = q1Topic.replace(/\./g, '_');
       const topicMastery = masteryMap.get(safeTopic);
       targetDifficulty = getAdaptiveDifficulty(topicMastery, stage);
    }

    // Generate Q1
    const nextQuestionObj = await generateNextQuestion({
      role,
      experience,
      mode,
      resumeText: safeResume,
      projects,
      skills,
      stage,
      targetDifficulty,
      targetTopicFocus: q1Topic,
      resumeFocusArea: "Focus specifically on testing this exact topic.",
      compactHistory,
      previousQuestions: [],
    });

    const q1Id = Math.random().toString(36).substring(7);
    const newQuestion = {
      questionId: q1Id,
      questionText: nextQuestionObj.questionText,
      topic: nextQuestionObj.topic,
      subtopic: nextQuestionObj.subtopic,
      category: nextQuestionObj.category,
      difficulty: nextQuestionObj.difficulty,
      askedAt: new Date(),
    };

    // Deduct credits
    user.credits -= 50;
    await user.save();

    // Create Interview
    const interview = await Interview.create({
      userId: user._id,
      candidateName: userName || user?.name || "Candidate",
      resumeId: resume._id,
      role,
      experience,
      mode,
      resumeText: safeResume,
      projects: projects || [],
      skills: skills || [],
      questions: [newQuestion],
    });

    res.json({
      interviewId: interview._id,
      creditsLeft: user.credits,
      userName: userName || user.name,
      firstQuestion: newQuestion,
    });
  } catch (error) {
    console.error("Start dynamic interview error:", error);
    return res.status(500).json({ message: `failed to start dynamic interview ${error}` });
  }
};

export const submitDynamicAnswer = async (req, res) => {
  try {
    const { interviewId, questionId, answer, timeTaken, totalDetections, proctoringLogs } = req.body;

    const interview = await Interview.findById(interviewId);
    if (!interview) return res.status(404).json({ message: "Interview not found" });

    const questionIndex = interview.questions.findIndex((q) => q.questionId === questionId);
    if (questionIndex === -1) return res.status(404).json({ message: "Question not found" });

    const question = interview.questions[questionIndex];
    question.answer = answer || "";
    question.answeredAt = new Date();

    if (proctoringLogs !== undefined) interview.proctoringLogs = proctoringLogs;
    if (totalDetections !== undefined) interview.totalDetections = totalDetections;

    let evaluationResult = {
      confidence: 0,
      communication: 0,
      correctness: 0,
      technicalDepth: 0,
      practicalApplication: 0,
      strengths: [],
      weaknesses: [],
      missingConcepts: [],
      summary: "No answer provided.",
    };

    const resume = await Resume.findById(interview.resumeId);

    // 1. Evaluate answer using existing Groq
    if (answer) {
      evaluationResult = await evaluateAnswer(question.questionText, answer, interview.mode);
      
      // 3. Update topic-specific mastery
      await updateResumeMastery(resume, interview.mode, question.topic, evaluationResult);
    }
    question.evaluation = evaluationResult;

    // 4. Check 10 questions limit
    const questionsCount = interview.questions.length;
    let isFinished = false;

    if (questionsCount >= 10) {
      isFinished = true;
    }

    let nextQuestion = null;

    if (!isFinished) {
      // 5. Determine next stage
      const nextStage = getStage(questionsCount + 1);

      // 6. Determine Topic Focus using the AI/controller logic
      const isHR = interview.mode === "HR" || interview.mode === "Hr";
      const masteryMap = !isHR ? resume.technicalMastery : resume.hrMastery;
      
      let topicFocus = "";
      let isFollowUp = false;
      let followUpAngle = null;

      if (isHR) {
        const hrSelection = hrTopicSelector(resume, questionsCount + 1, interview.questions, evaluationResult);
        topicFocus = hrSelection.topic;
        isFollowUp = hrSelection.isFollowUp;
        followUpAngle = hrSelection.followUpAngle;
      } else {
        topicFocus = selectTopic(resume, masteryMap, nextStage, interview.questions, interview.mode);

        // WEAK TOPIC KNOWLEDGE VERIFICATION RULE (Rule 2)
        if (evaluationResult) {
           const currentAnswerScore = (evaluationResult.confidence + evaluationResult.communication + evaluationResult.correctness) / 3;
           if (currentAnswerScore <= 4.0) {
              const timesAskedThisTopic = interview.questions.filter(q => q.topic === question.topic).length;
              if (timesAskedThisTopic < 3) {
                  topicFocus = question.topic;
                  isFollowUp = true;
                  followUpAngle = "The candidate struggled heavily with the previous question. Ask a slightly simpler, foundational question on this EXACT SAME topic to verify if they have basic beginner knowledge.";
              }
           }
        }
      }

      // 7. Determine difficulty (Topic-specific)
      let targetTopicMastery = null;
      let targetDifficulty = 1;

      if (topicFocus) {
         const safeTopic = topicFocus.replace(/\./g, '_');
         const topicMastery = masteryMap.get(safeTopic);
         
         if (topicMastery) {
            targetTopicMastery = {
                demonstrated: topicMastery.demonstrated || [],
                weakAreas: topicMastery.weakAreas || [],
            };
         }
         
         targetDifficulty = getAdaptiveDifficulty(topicMastery, nextStage);
      } else {
         targetDifficulty = getAdaptiveDifficulty(null, nextStage);
      }

      // 7.5 Determine Resume Focus Area based on what selectTopic picked
      let resumeFocusArea = "Focus specifically on testing this exact topic.";

      const compactHistory = await getCompactHistory(req.userId, interview.resumeId, interview.mode);

      // 8. Generate ONE new question through Groq
      const nextQuestionObj = await generateNextQuestion({
        role: interview.role,
        experience: interview.experience,
        mode: interview.mode,
        resumeText: interview.resumeText,
        projects: interview.projects,
        skills: interview.skills,
        stage: nextStage,
        targetDifficulty,
        targetTopicFocus: topicFocus,
        targetTopicMastery,
        resumeFocusArea,
        compactHistory,
        previousQuestions: interview.questions,
        latestAnswer: answer,
        latestEvaluation: evaluationResult,
        isFollowUp,
        followUpAngle
      });

      const nextQId = Math.random().toString(36).substring(7);
      nextQuestion = {
        questionId: nextQId,
        questionText: nextQuestionObj.questionText,
        topic: nextQuestionObj.topic,
        subtopic: nextQuestionObj.subtopic,
        category: nextQuestionObj.category,
        difficulty: nextQuestionObj.difficulty,
        isFollowUp: nextQuestionObj.category === "FOLLOW_UP",
        askedAt: new Date(),
      };

      interview.questions.push(nextQuestion);
    } else {
      interview.status = "Completed";
      
      let currentTotalScore = 0;
      let allStrengths = [];
      let allWeaknesses = [];

      interview.questions.forEach((q) => {
        const avgScore = ((q.evaluation?.confidence || 0) + (q.evaluation?.communication || 0) + (q.evaluation?.correctness || 0)) / 3;
        currentTotalScore += avgScore;

        if (q.evaluation?.strengths) {
          q.evaluation.strengths.forEach(s => {
            if (!allStrengths.includes(s)) allStrengths.push(s);
          });
        }
        if (q.evaluation?.weaknesses) {
          q.evaluation.weaknesses.forEach(w => {
            if (!allWeaknesses.includes(w)) allWeaknesses.push(w);
          });
        }
      });
      
      interview.finalScore = Math.round(currentTotalScore / interview.questions.length);
      interview.strengths = allStrengths;
      interview.weaknesses = allWeaknesses;

      resume.interviewCount = (resume.interviewCount || 0) + 1;
      await resume.save();
    }

    interview.markModified("questions");
    await interview.save();

    res.json({
      evaluation: evaluationResult,
      nextQuestion,
      isFinished,
    });
  } catch (error) {
    console.error("Submit dynamic answer error:", error);
    return res.status(500).json({ message: `failed to submit answer ${error}` });
  }
};

export const finishDynamicInterview = async (req, res) => {
  try {
    const { interviewId, totalDetections, proctoringLogs } = req.body;
    const interview = await Interview.findById(interviewId);

    if (!interview) return res.status(404).json({ message: "Interview not found" });

    if (totalDetections !== undefined) interview.totalDetections = totalDetections;
    if (proctoringLogs !== undefined) interview.proctoringLogs = proctoringLogs;

    interview.status = "Completed";
    
    let currentTotalScore = 0;
    let allStrengths = [];
    let allWeaknesses = [];

    interview.questions.forEach((q) => {
      const avgScore = ((q.evaluation?.confidence || 0) + (q.evaluation?.communication || 0) + (q.evaluation?.correctness || 0)) / 3;
      currentTotalScore += avgScore;

      if (q.evaluation?.strengths) {
        q.evaluation.strengths.forEach(s => {
          if (!allStrengths.includes(s)) allStrengths.push(s);
        });
      }
      if (q.evaluation?.weaknesses) {
        q.evaluation.weaknesses.forEach(w => {
          if (!allWeaknesses.includes(w)) allWeaknesses.push(w);
        });
      }
    });
    
    if(interview.questions.length > 0) {
      interview.finalScore = Math.round(currentTotalScore / interview.questions.length);
    } else {
      interview.finalScore = 0;
    }
    interview.strengths = allStrengths;
    interview.weaknesses = allWeaknesses;

    await interview.save();

    // Optionally increment resume interviewCount here as well
    const resume = await Resume.findById(interview.resumeId);
    if (resume) {
      resume.interviewCount = (resume.interviewCount || 0) + 1;
      await resume.save();
    }

    res.json({ 
      _id: interview._id,
      finalScore: interview.finalScore,
      totalDetections: interview.totalDetections || 0,
      proctoringLogs: interview.proctoringLogs || [],
      questions: interview.questions,
      strengths: interview.strengths || [],
      weaknesses: interview.weaknesses || [],
      recordings: interview.recordings || {}
    });
  } catch (error) {
    console.error("Finish dynamic interview error:", error);
    return res.status(500).json({ message: `failed to finish interview ${error}` });
  }
};

export const getDynamicInterviewReport = async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id);

    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    return res.json({
      _id: interview._id,
      finalScore: interview.finalScore,
      totalDetections: interview.totalDetections || 0,
      proctoringLogs: interview.proctoringLogs || [],
      questions: interview.questions,
      strengths: interview.strengths || [],
      weaknesses: interview.weaknesses || [],
      recordings: interview.recordings || {}
    });

  } catch (error) {
    return res.status(500).json({ message: `failed to find Interview report ${error}` })
  }
};

export const analyzeResume = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Resume Required" });
    }

    const filepath = req.file.path;

    const fileBuffer = await fs.promises.readFile(filepath);
    const uint8Array = new Uint8Array(fileBuffer);

    const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise;

    let resumeText = "";

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();

      const pageText = content.items.map((item) => item.str).join(" ");
      resumeText += pageText + "\n";
    }

    resumeText = resumeText.replace(/\s+/g, " ").trim();

    const messages = [
      {
        role: "system",
        content: `
You are a resume parser.

Rules:
- Return ONLY valid JSON
- No explanation or extra text
- Do NOT guess missing info
- If missing → use "" or []

Output format:
{
  "name": "string",
  "education": "string",
  "role": "string",
  "experience": "string",
  "projects": ["project1", "project2"],
  "skills": ["skill1", "skill2"]
}
`,
      },
      {
        role: "user",
        content: resumeText,
      },
    ];

    const aiResponse = await askAi(messages);

    let parsed;

    try {
      parsed = JSON.parse(aiResponse);
    } catch (err) {
      console.error("Invalid JSON:", aiResponse);

      return res.status(500).json({
        message: "AI returned invalid JSON",
        raw: aiResponse,
      });
    }

    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }

    return res.json({
      name: parsed.name || "",
      education: parsed.education || "",
      role: parsed.role || "",
      experience: parsed.experience || "",
      projects: parsed.projects || [],
      skills: parsed.skills || [],
      resumeText,
    });
  } catch (error) {
    console.log(error);

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return res.status(500).json({ message: error.message });
  }
};

export const getMyInterviews = async (req, res) => {
  try {
    const Interview = (await import("../models/dynamicInterview.model.js")).default;
    const dynamicInterviews = await Interview.find({ userId: req.userId })
      .select("role experience mode finalScore status createdAt")
      .lean();

    const allInterviews = dynamicInterviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.status(200).json(allInterviews);
  } catch (error) {
    return res.status(500).json({ message: 'failed to find currentUser Interview ' + error })
  }
}
