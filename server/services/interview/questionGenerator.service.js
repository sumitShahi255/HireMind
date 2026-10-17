/**
 * questionGenerator.service.js
 *
 * Generates ONE interview question for the backend-assigned topic.
 *
 * KEY RULES:
 *  1. The assigned topic is passed by the controller — the AI MUST use it.
 *  2. Resume context is expanded to 3500 chars (not 500).
 *  3. Full evaluation details are only injected for permitted follow-ups.
 *  4. The generated question is validated against the assigned topic.
 *  5. If the topic is wrong, one retry is attempted with explicit correction.
 *  6. If retry fails, a controlled fallback question is returned.
 */

import { askAi } from "../groq.service.js";
import { normalizeTopic, stripTopicPrefix } from "./interviewPlanner.service.js";

const RESUME_CONTEXT_CHARS = 3500;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Check whether the AI-returned topic matches the assigned topic.
 * Uses normalized comparison with prefix-stripping and strict keyword protection
 * (e.g., prevents "Java" matching "JavaScript").
 */
export const topicMatches = (returnedTopic, assignedTopic) => {
  if (!assignedTopic) return true; // no constraint
  const r = normalizeTopic(returnedTopic);
  const a = normalizeTopic(assignedTopic);
  if (r === a) return true;

  const rClean = normalizeTopic(stripTopicPrefix(returnedTopic));
  const aClean = normalizeTopic(stripTopicPrefix(assignedTopic));
  if (rClean === aClean) return true;

  // Exact match required for short keywords to prevent "Java" matching "JavaScript" or "C" matching "CSS"
  const shortKeywords = ["java", "c", "r", "go", "git", "css", "sql", "dsa", "oop"];
  if (shortKeywords.includes(aClean) || shortKeywords.includes(rClean)) {
    return rClean === aClean;
  }

  return rClean.includes(aClean) || aClean.includes(rClean);
};

/**
 * Validate the raw AI response object and throw if invalid.
 */
export const validateQuestion = (obj, assignedTopic, bannedTopics = []) => {
  if (!obj || typeof obj !== "object") throw new Error("Response is not an object");
  if (!obj.questionText || obj.questionText.trim().length < 10) throw new Error("questionText is too short");
  if (!obj.topic) throw new Error("topic is missing");
  if (typeof obj.difficulty !== "number" || obj.difficulty < 1 || obj.difficulty > 5) {
    throw new Error(`difficulty out of range: ${obj.difficulty}`);
  }

  // Topic match enforcement
  if (assignedTopic && !topicMatches(obj.topic, assignedTopic)) {
    throw new Error(`Topic mismatch: assigned "${assignedTopic}", returned "${obj.topic}"`);
  }

  // Banned topic check (normalised exact match or prefix-stripped match)
  if (bannedTopics.length > 0) {
    const returnedNorm = normalizeTopic(stripTopicPrefix(obj.topic));
    const isBanned = bannedTopics.some((bt) => normalizeTopic(stripTopicPrefix(bt)) === returnedNorm);
    if (isBanned) throw new Error(`Topic "${obj.topic}" is currently banned`);
  }
};

// ─── Prompt Builders ─────────────────────────────────────────────────────────

const buildSystemPrompt = (mode) => {
  let prompt = `You are an adaptive AI interviewer conducting a realistic, resume-grounded job interview.
You will generate exactly ONE question.
The backend has pre-selected the topic you MUST use. Your sole job is to generate a realistic, specific question for that assigned topic.
You MUST set the "topic" field in your JSON to the exact assigned topic provided.
`;

  if (mode === "TECHNICAL" || mode === "Technical") {
    prompt += `
Constraint: TECHNICAL interview. No HR or generic behavioral questions. Focus on technical skills, actual resume claims, coding concepts, practical architecture, and realistic scenarios.

CRITICAL GROUNDING AND INTEGRITY RULES:
1. Strict Resume Grounding:
   - Ground questions strictly in actual resume sections: listed skills, internship responsibilities, measurable achievements, and project descriptions.
   - Anchor questions in the candidate's actual technologies and stated accomplishments.
2. ABSOLUTE PROHIBITION ON INVENTING RESUME DETAILS:
   - NEVER invent or assume technologies, tools, frameworks, databases, or cloud services that are NOT mentioned in the candidate's profile (e.g. NEVER introduce Docker, Kubernetes, AWS, Kafka, Redis, GraphQL, Python, or C++ unless explicitly provided).
   - NEVER invent candidate achievements, percentages, metrics, company names, or job titles not in the resume context.
3. No Presumption of Advanced Techniques:
   - Do NOT assume the candidate has used advanced techniques merely because a related technology appears on their resume.
   - For difficulty 1-2 (Foundation stage): Ask foundational questions testing core principles, basic mechanics, syntax, and fundamental understanding first.
   - Only advance to architectural tradeoffs, deep performance tuning, or edge-case troubleshooting if the difficulty is 4-5.
4. Question Styles:
   - Core Fundamentals: Test foundational CS concepts, language mechanisms, data structures, or DBMS internals.
   - Practical Implementation: Test realistic code, API implementation, component lifecycle, or query writing.
   - Resume Deep Dive (Projects & Experiences): Probe candidate's actual role, architectural decisions, and how claimed measurable results (e.g. optimization percentages) were achieved and verified.
   - Problem-Solving Scenarios: Present realistic debugging or situational challenges strictly within their known tech stack.`;
  } else {
    prompt += `\nConstraint: HR/Behavioral interview. Evaluate behavior, experience, communication, ownership, and motivation. Do NOT ask direct technical knowledge questions. Ground questions in candidate's actual resume experience and projects without inventing details.`;
  }

  prompt += `

Output exactly ONE valid JSON object:
{
  "questionText": "The actual interview question (15-40 words)",
  "topic": "MUST match the assigned topic exactly",
  "subtopic": "Specific subtopic within the assigned topic",
  "category": "REAL_WORLD or THEORETICAL or FOLLOW_UP",
  "difficulty": <number 1-5>,
  "reason": "One sentence: why this specific subtopic was chosen"
}

Rules:
- Output ONLY JSON. No markdown fences, no explanation.
- The "topic" field MUST equal the assigned topic you receive.
- The question must be a single, natural sentence (15-40 words).
- NEVER repeat a question from the interview history.
- Adhere strictly to the requested difficulty level.

Difficulty levels:
- 1-2: Foundational ("What is...", "Can you explain the core mechanism of...", "How does... work fundamentally")
- 3-4: Intermediate, practical scenario-based or applied implementation
- 5: Complex, architectural, or deep-dive problem-solving`;

  return prompt;
};

const buildUserPrompt = ({
  role,
  experience,
  mode,
  resumeText,
  projects,
  skills,
  stage,
  targetDifficulty,
  assignedTopic,
  assignedContext,
  assignedCategory,
  assignedSubtopicHint,
  bannedSubtopics,
  compactHistory,
  previousQuestions,
  latestAnswer,
  latestEvaluation,
  isFollowUp,
  followUpAngle,
}) => {
  const isFirstQuestion = !previousQuestions || previousQuestions.length === 0;

  let resumeContext = (resumeText || "").substring(0, RESUME_CONTEXT_CHARS);

  let prompt = `Candidate Profile:
Role: ${role}
Experience: ${experience}
Mode: ${mode}
Skills: ${skills?.join(", ") || "None"}
Projects: ${projects?.join(", ") || "None"}
Resume Context (Ground truth for interview questions):
${resumeContext}

--- CONTROLLER DIRECTIVES (MANDATORY) ---
Assigned Topic (you MUST use this): ${assignedTopic || "General Technical Concepts"}
Assigned Topic Category: ${assignedCategory || "general"}
${assignedContext ? `Topic Specific Grounding / Context: ${assignedContext}` : ""}
Target Stage: ${stage}
Target Difficulty (1-5): ${targetDifficulty}
Is Follow-Up: ${isFollowUp ? "YES" : "NO"}
${isFollowUp && followUpAngle ? `Follow-Up Angle: ${followUpAngle}` : ""}
${bannedSubtopics && bannedSubtopics.length > 0 ? `Already-tested subtopics for this topic (choose a DIFFERENT subtopic): ${bannedSubtopics.join(", ")}` : ""}
${assignedSubtopicHint ? `Preferred Subtopic Hint: ${assignedSubtopicHint}` : ""}

GROUNDING INSTRUCTIONS FOR THIS QUESTION:
- Target Topic: "${assignedTopic}"
- If this topic is a Core Fundamental: Ask foundational questions first (difficulty ${targetDifficulty}). Do not assume advanced knowledge.
- If this topic is a Project or Internship or Measurable Achievement: Probe the candidate's actual implementation, role, and verified results using ONLY details mentioned in the resume. Do NOT assume tools or metrics not in the resume.
- If this topic is a Scenario: Ground the scenario strictly in the candidate's listed technologies (${skills?.slice(0, 8).join(", ") || "the candidate's tech stack"}).
`;

  if (compactHistory) {
    prompt += `\nPrevious Interview History (DO NOT REPEAT THESE QUESTIONS):\n${compactHistory}\n`;
  }

  if (!isFirstQuestion) {
    const pastQStr = previousQuestions
      .map((q, i) => `Q${i + 1}: [Topic: ${q.topic}, Sub: ${q.subtopic || "—"}, Diff: ${q.difficulty}] ${q.questionText}`)
      .join("\n");
    prompt += `\nCurrent Interview Progress:\n${pastQStr}\n`;

    if (isFollowUp && latestAnswer) {
      // Only include detailed evaluation for follow-ups
      prompt += `\nCandidate's Latest Answer:\n${latestAnswer}\n`;
      if (latestEvaluation) {
        const evalSummary = {
          summary: latestEvaluation.summary,
          weaknesses: latestEvaluation.weaknesses,
          missingConcepts: latestEvaluation.missingConcepts,
        };
        prompt += `\nFocused Evaluation Summary (for follow-up context only):\n${JSON.stringify(evalSummary)}\n`;
      }
    } else {
      // For normal questions: only provide the last question text for "don't repeat" context
      const lastQ = previousQuestions[previousQuestions.length - 1];
      prompt += `\nLast Question Asked: ${lastQ.questionText}\n`;
      prompt += `\nIMPORTANT: Do NOT include evaluation details — focus on generating a fresh question for the assigned topic.\n`;
    }
  } else {
    prompt += `\nThis is the very first question. Generate a strong foundational question for the assigned topic at difficulty ${targetDifficulty}.\n`;
  }

  return prompt;
};

// ─── Main Export ─────────────────────────────────────────────────────────────

/**
 * Generate the next interview question for the backend-assigned topic.
 *
 * @param {Object} params
 * @param {string} params.role
 * @param {string} params.experience
 * @param {string} params.mode
 * @param {string} params.resumeText
 * @param {string[]} params.projects
 * @param {string[]} params.skills
 * @param {string} params.stage
 * @param {number} params.targetDifficulty
 * @param {string} params.assignedTopic          - Topic assigned by backend (ENFORCED)
 * @param {string} [params.assignedSubtopicHint] - Preferred subtopic hint
 * @param {string[]} [params.bannedSubtopics]    - Subtopics already tested for this topic
 * @param {string[]} [params.bannedTopics]       - Topics entirely banned for this turn
 * @param {string} [params.compactHistory]       - Past-interview question history string
 * @param {Object[]} [params.previousQuestions]  - Current interview questions
 * @param {string} [params.latestAnswer]         - Candidate's last answer (follow-up only)
 * @param {Object} [params.latestEvaluation]     - Evaluation of last answer (follow-up only)
 * @param {boolean} [params.isFollowUp]
 * @param {string} [params.followUpAngle]
 */
export const generateNextQuestion = async ({
  role,
  experience,
  mode,
  resumeText,
  projects,
  skills,
  stage,
  targetDifficulty,
  assignedTopic,
  assignedContext,
  assignedCategory,
  assignedSubtopicHint,
  bannedSubtopics = [],
  bannedTopics = [],
  compactHistory,
  previousQuestions,
  latestAnswer,
  latestEvaluation,
  isFollowUp,
  followUpAngle,
}) => {

  console.log(`[QuestionGenerator] Assigned topic: "${assignedTopic}" | Category: ${assignedCategory} | Stage: ${stage} | Difficulty: ${targetDifficulty} | FollowUp: ${isFollowUp}`);

  const systemPrompt = buildSystemPrompt(mode);
  const userPrompt = buildUserPrompt({
    role,
    experience,
    mode,
    resumeText,
    projects,
    skills,
    stage,
    targetDifficulty,
    assignedTopic,
    assignedContext,
    assignedCategory,
    assignedSubtopicHint,
    bannedSubtopics,
    compactHistory,
    previousQuestions,
    latestAnswer,
    latestEvaluation,
    isFollowUp,
    followUpAngle,
  });

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  // ── Attempt 1 ──
  let parsedResult = null;
  let attempt1Error = null;

  try {
    const raw = await askAi(messages, true, 0.5);
    parsedResult = JSON.parse(raw);
    validateQuestion(parsedResult, assignedTopic, bannedTopics);
    console.log(`[QuestionGenerator] ✓ Generated question on topic "${parsedResult.topic}" (subtopic: "${parsedResult.subtopic}")`);
    return parsedResult;
  } catch (err) {
    attempt1Error = err;
    console.warn(`[QuestionGenerator] Attempt 1 failed: ${err.message}`);
  }

  // ── Attempt 2 (retry with explicit correction) ──
  try {
    const correctionMessages = [
      ...messages,
      {
        role: "assistant",
        content: parsedResult ? JSON.stringify(parsedResult) : "{}",
      },
      {
        role: "user",
        content: `Your previous response was rejected because: ${attempt1Error.message}
CRITICAL: You MUST set "topic" to exactly "${assignedTopic}". 
Regenerate a completely different question strictly about "${assignedTopic}" at difficulty ${targetDifficulty}. Return only valid JSON.`,
      },
    ];
    const raw2 = await askAi(correctionMessages, true, 0.3);
    const retryResult = JSON.parse(raw2);
    validateQuestion(retryResult, assignedTopic, bannedTopics);
    console.log(`[QuestionGenerator] ✓ Retry succeeded. Topic: "${retryResult.topic}"`);
    return retryResult;
  } catch (retryErr) {
    console.error(`[QuestionGenerator] Retry also failed: ${retryErr.message}. Using fallback.`);
  }

  // ── Controlled Fallback ──
  const fallbackTopic = assignedTopic || (skills?.length > 0 ? skills[0] : "General Technical Concepts");
  let fallbackText = `Can you explain a key concept or challenge you have encountered while working with ${fallbackTopic}?`;

  if (fallbackTopic.startsWith("Project:")) {
    const projectName = fallbackTopic.replace("Project:", "").trim();
    fallbackText = `In your ${projectName} project, what was your role and the most significant technical challenge you solved?`;
  } else if (fallbackTopic.startsWith("Experience:") || fallbackTopic.startsWith("Achievement:")) {
    const cleanTopic = stripTopicPrefix(fallbackTopic);
    fallbackText = `Regarding your ${cleanTopic}, what specific approach did you implement and how did you verify the results?`;
  } else if (fallbackTopic.startsWith("Scenario:")) {
    const cleanScenario = stripTopicPrefix(fallbackTopic);
    fallbackText = `In a production scenario involving ${cleanScenario}, how would you approach architecting and diagnosing issues?`;
  }

  console.warn(`[QuestionGenerator] Using fallback question for topic "${fallbackTopic}".`);
  return {
    questionText: fallbackText,
    topic: fallbackTopic,
    subtopic: "General",
    category: isFollowUp ? "FOLLOW_UP" : "REAL_WORLD",
    difficulty: targetDifficulty || 3,
    reason: "Fallback question — AI generation failed after retry.",
  };
};
