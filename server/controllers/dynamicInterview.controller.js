/**
 * dynamicInterview.controller.js
 *
 * Central controller for the dynamic AI interview system.
 *
 * FLOW OVERVIEW:
 *  startDynamicInterview  — builds topic plan, generates Q1, persists interview
 *  submitDynamicAnswer    — evaluates answer, selects next topic via plan, generates Qn+1
 *  finishDynamicInterview — marks interview complete, computes final score
 *
 * TOPIC SELECTION PRINCIPLES:
 *  - Topic plan is built ONCE at interview start and persisted in the DB.
 *  - The plan uses cross-interview history to prefer under-tested topics.
 *  - Weak answers record weaknesses but do NOT repeat the same topic immediately.
 *  - At most ONE consecutive follow-up per topic is allowed.
 *  - The AI receives the assigned topic and must return it in the "topic" field.
 *  - Response is validated; one retry is attempted on mismatch before fallback.
 */

import fs from "fs";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { askAi } from "../services/groq.service.js";
import Interview from "../models/dynamicInterview.model.js";
import User from "../models/user.model.js";
import Resume from "../models/resume.model.js";
import crypto from "crypto";

import { generateNextQuestion } from "../services/interview/questionGenerator.service.js";
import { evaluateAnswer } from "../services/evaluation/answerEvaluator.service.js";
import {
  buildTopicPlan,
  selectNextTopic,
  decideFollowUp,
  updateResumeMastery,
  buildCompactHistory,
  getStage,
  getAdaptiveDifficulty,
  normalizeTopic,
} from "../services/interview/interviewPlanner.service.js";
import { hrTopicSelector } from "../services/interview/hrTopicSelector.service.js";

const MAX_QUESTIONS = 10;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Fetch the two most recent completed interviews for this resume+mode.
 * Used both for compact history (prompt context) and for building the topic plan.
 */
const getPreviousInterviews = async (userId, resumeId, mode, excludeInterviewId = null) => {
  const query = { userId, resumeId, mode, status: "Completed" };
  if (excludeInterviewId) query._id = { $ne: excludeInterviewId };

  return Interview.find(query)
    .sort({ createdAt: -1 })
    .limit(2)
    .lean();
};

/**
 * Compute the final score and aggregate strengths/weaknesses from all questions.
 */
const computeFinalStats = (questions) => {
  let totalScore = 0;
  const allStrengths = [];
  const allWeaknesses = [];

  questions.forEach((q) => {
    const avg =
      ((q.evaluation?.confidence || 0) +
        (q.evaluation?.communication || 0) +
        (q.evaluation?.correctness || 0)) / 3;
    totalScore += avg;
    (q.evaluation?.strengths || []).forEach((s) => {
      if (!allStrengths.includes(s)) allStrengths.push(s);
    });
    (q.evaluation?.weaknesses || []).forEach((w) => {
      if (!allWeaknesses.includes(w)) allWeaknesses.push(w);
    });
  });

  return {
    finalScore: questions.length > 0 ? Math.round(totalScore / questions.length) : 0,
    strengths: allStrengths,
    weaknesses: allWeaknesses,
  };
};

// ─── startDynamicInterview ────────────────────────────────────────────────────

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
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.credits < 50) {
      return res.status(403).json({ message: "Not enough credits. Minimum 50 required." });
    }

    // 1. Resume identity
    const safeResume = resumeText?.trim() || "None";
    const resumeHash = crypto.createHash("sha256").update(safeResume).digest("hex");

    let resume = await Resume.findOne({ userId: req.userId, resumeHash });
    if (!resume) {
      resume = await Resume.create({
        userId: req.userId,
        resumeHash,
        resumeText: safeResume,
        skills: skills || [],
        projects: projects || [],
      });
    }

    // 2. Fetch previous interview history (for plan rotation + compact history)
    const previousInterviews = await getPreviousInterviews(req.userId, resume._id, mode);
    const compactHistory = buildCompactHistory(previousInterviews);

    // 3. Build the topic plan ONCE — persisted with the interview document
    const topicPlan = buildTopicPlan(resume, mode, previousInterviews);

    if (topicPlan.length === 0) {
      console.warn("[startDynamicInterview] Topic plan is empty — resume may have no skills/projects");
    }

    console.log(`[startDynamicInterview] Topic plan for mode=${mode}: ${topicPlan.map((e) => e.topic).join(" → ")}`);

    // 4. First question — always the first planned topic
    const firstPlanEntry = topicPlan[0];
    const assignedTopic = firstPlanEntry?.topic || "General Technical Concepts";
    const assignedContext = firstPlanEntry?.context || "";
    const assignedCategory = firstPlanEntry?.category || "general";
    const stage = getStage(1);

    const masteryMap = (mode === "TECHNICAL" || mode === "Technical")
      ? resume.technicalMastery
      : resume.hrMastery;

    const safeTopic = normalizeTopic(assignedTopic).replace(/\//g, "_");
    const topicMastery = masteryMap?.get(safeTopic);
    const targetDifficulty = getAdaptiveDifficulty(topicMastery, stage);

    console.log(`[startDynamicInterview] Q1 — assignedTopic: "${assignedTopic}", difficulty: ${targetDifficulty}, stage: ${stage}`);

    const nextQuestionObj = await generateNextQuestion({
      role,
      experience,
      mode,
      resumeText: safeResume,
      projects,
      skills,
      stage,
      targetDifficulty,
      assignedTopic,
      assignedContext,
      assignedCategory,
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
      assignedTopic,
      askedAt: new Date(),
    };

    // 5. Deduct credits
    user.credits -= 50;
    await user.save();

    // 6. Create the interview with the persistent topic plan
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
      topicPlan,
      topicPlanIndex: 1, // Q1 consumed index 0, next main question starts at 1
      consecutiveFollowUps: 0,
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

// ─── submitDynamicAnswer ──────────────────────────────────────────────────────

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

    // Default evaluation for blank/skipped answers
    let evaluationResult = {
      confidence: 0,
      communication: 0,
      correctness: 0,
      technicalDepth: 0,
      practicalApplication: 0,
      strengths: [],
      weaknesses: [],
      missingConcepts: [],
      followUpOpportunity: false,
      suggestedFollowUpAngle: "",
      summary: "No answer provided.",
    };

    const resume = await Resume.findById(interview.resumeId);

    // 1. Evaluate answer
    if (answer) {
      evaluationResult = await evaluateAnswer(question.questionText, answer, interview.mode);

      // 2. Update mastery — note subtopic is also passed now
      await updateResumeMastery(
        resume,
        interview.mode,
        question.assignedTopic || question.topic,
        question.subtopic,
        evaluationResult,
        interview
      );
    }
    question.evaluation = evaluationResult;

    // ─ Check question budget ─
    const questionsCount = interview.questions.length;
    let isFinished = questionsCount >= MAX_QUESTIONS;
    let nextQuestion = null;

    if (!isFinished) {
      const isHR = interview.mode === "HR" || interview.mode === "Hr";
      const masteryMap = !isHR ? resume.technicalMastery : resume.hrMastery;

      // ─ Follow-up decision (enforces max-1-consecutive rule) ─
      const { isFollowUp, followUpAngle } = decideFollowUp(interview, evaluationResult, answer);

      let assignedTopic;
      let assignedContext = "";
      let assignedCategory = "general";
      let newPlanIndex = interview.topicPlanIndex;
      let bannedSubtopics = [];

      if (isFollowUp) {
        // Follow-up: stay on the same topic
        assignedTopic = question.assignedTopic || question.topic;
        interview.consecutiveFollowUps = (interview.consecutiveFollowUps || 0) + 1;

        // Suggest a different subtopic for the follow-up
        const planEntry = interview.topicPlan.find(
          (e) => normalizeTopic(e.topic) === normalizeTopic(assignedTopic)
        );
        bannedSubtopics = planEntry?.subtopicsTested || [];
        assignedContext = planEntry?.context || "";
        assignedCategory = planEntry?.category || "general";

        console.log(`[submitDynamicAnswer] FollowUp on "${assignedTopic}" (consecutive #${interview.consecutiveFollowUps}) | bannedSubtopics: [${bannedSubtopics.join(", ")}]`);
      } else {
        // Main question — advance plan
        interview.consecutiveFollowUps = 0;

        if (isHR) {
          const hrResult = hrTopicSelector(interview, interview.questions);
          assignedTopic = hrResult.topic;
          assignedCategory = "hr";
          if (hrResult.planIndex >= 0) newPlanIndex = hrResult.planIndex + 1;
        } else {
          const planResult = selectNextTopic(interview, masteryMap);
          assignedTopic = planResult.topic;
          assignedContext = planResult.context || "";
          assignedCategory = planResult.category || "general";
          newPlanIndex = planResult.planIndex + 1;
        }

        // Collect banned subtopics for the newly selected topic
        const planEntry = interview.topicPlan.find(
          (e) => normalizeTopic(e.topic) === normalizeTopic(assignedTopic)
        );
        bannedSubtopics = planEntry?.subtopicsTested || [];
        if (!assignedContext && planEntry?.context) assignedContext = planEntry.context;
        if (!assignedCategory && planEntry?.category) assignedCategory = planEntry.category;

        console.log(`[submitDynamicAnswer] Main Q — assignedTopic: "${assignedTopic}" | planIndex: ${newPlanIndex} | bannedSubtopics: [${bannedSubtopics.join(", ")}]`);
      }

      interview.topicPlanIndex = newPlanIndex;

      // ─ Determine stage and difficulty ─
      const nextStage = getStage(questionsCount + 1);
      const safeTopic = normalizeTopic(assignedTopic).replace(/\//g, "_");
      const topicMastery = masteryMap?.get(safeTopic);

      const targetTopicMastery = topicMastery
        ? { demonstrated: topicMastery.demonstrated || [], weakAreas: topicMastery.weakAreas || [] }
        : null;
      const targetDifficulty = getAdaptiveDifficulty(topicMastery, nextStage);

      // ─ Fetch compact history (previous interviews only; NOT current interview) ─
      const previousInterviews = await getPreviousInterviews(
        req.userId,
        interview.resumeId,
        interview.mode,
        interview._id
      );
      const compactHistory = buildCompactHistory(previousInterviews);

      // ─ Generate next question ─
      const nextQuestionObj = await generateNextQuestion({
        role: interview.role,
        experience: interview.experience,
        mode: interview.mode,
        resumeText: interview.resumeText,
        projects: interview.projects,
        skills: interview.skills,
        stage: nextStage,
        targetDifficulty,
        assignedTopic,
        assignedContext,
        assignedCategory,
        bannedSubtopics,
        compactHistory,
        previousQuestions: interview.questions,
        latestAnswer: answer,
        latestEvaluation: isFollowUp ? evaluationResult : null,
        isFollowUp,
        followUpAngle,
      });

      const nextQId = Math.random().toString(36).substring(7);
      nextQuestion = {
        questionId: nextQId,
        questionText: nextQuestionObj.questionText,
        topic: nextQuestionObj.topic,
        subtopic: nextQuestionObj.subtopic,
        category: nextQuestionObj.category,
        difficulty: nextQuestionObj.difficulty,
        isFollowUp,
        assignedTopic,
        askedAt: new Date(),
      };

      interview.questions.push(nextQuestion);
    } else {
      // ─ Finish interview ─
      interview.status = "Completed";
      const stats = computeFinalStats(interview.questions);
      interview.finalScore = stats.finalScore;
      interview.strengths = stats.strengths;
      interview.weaknesses = stats.weaknesses;

      resume.interviewCount = (resume.interviewCount || 0) + 1;
      await resume.save();
    }

    interview.markModified("questions");
    interview.markModified("topicPlan");
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

// ─── finishDynamicInterview ───────────────────────────────────────────────────

export const finishDynamicInterview = async (req, res) => {
  try {
    const { interviewId, totalDetections, proctoringLogs } = req.body;
    const interview = await Interview.findById(interviewId);

    if (!interview) return res.status(404).json({ message: "Interview not found" });

    if (totalDetections !== undefined) interview.totalDetections = totalDetections;
    if (proctoringLogs !== undefined) interview.proctoringLogs = proctoringLogs;

    interview.status = "Completed";
    const stats = computeFinalStats(interview.questions);
    interview.finalScore = stats.finalScore;
    interview.strengths = stats.strengths;
    interview.weaknesses = stats.weaknesses;

    await interview.save();

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
      recordings: interview.recordings || {},
    });
  } catch (error) {
    console.error("Finish dynamic interview error:", error);
    return res.status(500).json({ message: `failed to finish interview ${error}` });
  }
};

// ─── getDynamicInterviewReport ────────────────────────────────────────────────

export const getDynamicInterviewReport = async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id);
    if (!interview) return res.status(404).json({ message: "Interview not found" });

    return res.json({
      _id: interview._id,
      finalScore: interview.finalScore,
      totalDetections: interview.totalDetections || 0,
      proctoringLogs: interview.proctoringLogs || [],
      questions: interview.questions,
      strengths: interview.strengths || [],
      weaknesses: interview.weaknesses || [],
      recordings: interview.recordings || {},
    });
  } catch (error) {
    return res.status(500).json({ message: `failed to find Interview report ${error}` });
  }
};

// ─── analyzeResume ────────────────────────────────────────────────────────────

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
        content: `You are a resume parser.

Rules:
- Return ONLY valid JSON
- No explanation or extra text
- Do NOT guess missing info
- If missing → use "" or []
- For skills: extract ALL technical skills, frameworks, tools, languages, and platforms mentioned
- For projects: extract ALL project names (include academic, personal, and professional projects)

Output format:
{
  "name": "string",
  "education": "string",
  "role": "string",
  "experience": "string",
  "projects": ["project1", "project2"],
  "skills": ["skill1", "skill2"]
}`,
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
      console.error("Invalid JSON from resume parser:", aiResponse);
      return res.status(500).json({ message: "AI returned invalid JSON", raw: aiResponse });
    }

    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);

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
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(500).json({ message: error.message });
  }
};

// ─── getMyInterviews ──────────────────────────────────────────────────────────

export const getMyInterviews = async (req, res) => {
  try {
    const dynamicInterviews = await Interview.find({ userId: req.userId })
      .select("role experience mode finalScore status createdAt")
      .lean();

    const allInterviews = dynamicInterviews.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    return res.status(200).json(allInterviews);
  } catch (error) {
    return res.status(500).json({ message: "failed to find currentUser Interview " + error });
  }
};
