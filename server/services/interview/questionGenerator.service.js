import { askAi } from "../groq.service.js";

export const generateNextQuestion = async ({
  role,
  experience,
  mode,
  resumeText,
  projects,
  skills,
  stage,
  targetDifficulty,
  targetTopicFocus,
  targetTopicMastery,
  resumeFocusArea,
  compactHistory,
  previousQuestions,
  latestAnswer,
  latestEvaluation,
  isFollowUp,
  followUpAngle
}) => {
  const isFirstQuestion = !previousQuestions || previousQuestions.length === 0;

  let systemPrompt = `
You are an adaptive AI interviewer conducting a realistic job interview.
You will ask exactly ONE question. 
You must strictly follow the backend's instructions regarding the interview stage, target difficulty, and topic focus.
`;

  if (mode === "TECHNICAL" || mode === "Technical") {
    systemPrompt += `\nConstraint: This is a TECHNICAL interview. Do NOT ask generic HR or behavioral questions. Focus strictly on technical skills, system design, coding principles, and practical scenarios.`;
  } else {
    systemPrompt += `\nConstraint: This is an HR/Behavioral interview.
Your objective is to evaluate the candidate's behavior, experience, communication, ownership, and motivation.
- DO NOT ask direct technical knowledge questions (e.g., "What is dependency injection?").
- You MUST identify any soft skills, leadership roles, or behavioral traits claimed in the Resume Context and formulate questions to validate them (e.g., if they claim "Team Leadership", ask them for a specific instance where they led a struggling team).
- You MAY use the candidate's technical projects/skills from their resume to frame HR questions (e.g., "You worked on a Spring Boot project. What was the biggest challenge you personally faced and how did you handle it?").
- Ensure your questions naturally fall into one of these categories:
  * Resume/Experience: Internships, Job experience, Responsibilities.
  * Behavioral/Soft Skills: Teamwork, Communication, Conflict handling, Leadership.
  * Situational: Hypothetical scenarios (e.g., "What if a team member misses a deadline?").
  * Motivation/Career: Why this role? Career goals.
  * Self-awareness: Strengths, Weaknesses, Failures.`;
  }

  systemPrompt += `
Output exactly ONE valid JSON object with the following structure:
{
  "questionText": "The actual question to ask",
  "topic": "Main topic (e.g. Java, Spring Boot, Conflict Resolution)",
  "subtopic": "Subtopic (e.g. Caching, Multithreading, Team Leadership)",
  "category": "REAL_WORLD or THEORETICAL or FOLLOW_UP",
  "difficulty": 1 to 5,
  "reason": "Brief reason why this question was chosen"
}
Rules:
- Output only JSON, no markdown formatting (\`\`\`json).
- The question must be a natural, single sentence (15 to 30 words).
- NEVER repeat a question that was asked previously in the current or past interviews.
- Do NOT ask the same or substantially similar question to any previous ones (e.g., if you already asked about strengths, do not ask about biggest strengths again).
- Adhere strictly to the requested Target Stage and Target Difficulty.

Difficulty Scaling Rules (CRITICAL):
- Level 1-2 (Easy/Foundation): Ask VERY basic, foundational questions (e.g., "What is...", "Can you explain..."). Do NOT ask complex architecture, deep-dive scenario, or advanced implementation questions, even if the resume contains advanced projects. Keep it simple and entry-level.
- Level 3-4 (Medium/Practical): Ask intermediate, scenario-based or application questions.
- Level 5 (Hard/Challenge): Ask complex, deep-dive architectural or highly specific problem-solving questions.

Dynamic Follow-Up Rules:
- If the controller specifies that this is a follow-up (isFollowUp = true), you MUST follow the suggested Follow-Up Angle and focus on the Candidate's Latest Answer.
- If it is not a follow-up, do NOT ask questions from the same Topic consecutively. Choose a completely DIFFERENT skill/topic to maximize interview breadth.
- If you ask a follow-up, set category to "FOLLOW_UP". Otherwise, set category to "REAL_WORLD" or "THEORETICAL" and follow the Controller's Target Topic Focus.
`;

  let userPrompt = `
Candidate Profile:
Role: ${role}
Experience: ${experience}
Mode: ${mode}
Projects: ${projects?.join(", ") || "None"}
Skills: ${skills?.join(", ") || "None"}
Resume Context: ${resumeText?.substring(0, 500) || "None"}

Interview Controller Directives:
- Target Stage: ${stage}
- Target Difficulty (1-5): ${targetDifficulty}
- Topic Focus: ${targetTopicFocus || "Controller allows AI to choose appropriate topic"}
- Resume Focus Area: ${resumeFocusArea || "General"}
- Is Follow-Up Required?: ${isFollowUp ? "YES" : "NO"}
- Follow-Up Angle: ${followUpAngle || "N/A"}
`;

  if (targetTopicMastery) {
    userPrompt += `- Topic Mastery Context:
    Demonstrated concepts: ${targetTopicMastery.demonstrated?.join(", ") || "None"}
    Weak areas to target: ${targetTopicMastery.weakAreas?.join(", ") || "None"}
`;
  }

  if (compactHistory && compactHistory.length > 0) {
    userPrompt += `\nPrevious Interview History for this Resume (DO NOT REPEAT THESE QUESTIONS):\n${compactHistory}\n`;
  }

  if (!isFirstQuestion) {
    const pastQuestionsStr = previousQuestions.map((q, idx) => `Q${idx + 1}: ${q.questionText} (Topic: ${q.topic}, Diff: ${q.difficulty})`).join("\n");
    userPrompt += `
Current Interview Progress:
${pastQuestionsStr}

Latest Question Asked:
${previousQuestions[previousQuestions.length - 1].questionText}

Candidate's Latest Answer:
${latestAnswer || "No answer provided"}

Evaluation of Latest Answer:
${JSON.stringify(latestEvaluation, null, 2)}
`;
  } else {
    userPrompt += `\nThis is the very first question of the interview. Pick a strong foundational question based on their primary skills or projects that matches the Target Difficulty and Topic.`;
  }

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ];

  try {
    const aiResponse = await askAi(messages, true, 0.7);
    return JSON.parse(aiResponse);
  } catch (error) {
    console.error("Failed to generate question from AI. Using fallback.", error.message);
    
    let fallbackText = "Can you describe a challenging problem you recently faced and how you solved it?";
    let fallbackTopic = "General Problem Solving";
    
    if (skills && skills.length > 0) {
      const randomSkill = skills[Math.floor(Math.random() * skills.length)];
      fallbackText = `Based on your resume, you have experience with ${randomSkill}. Can you explain a complex scenario where you applied this skill?`;
      fallbackTopic = randomSkill;
    } else if (projects && projects.length > 0) {
      const randomProject = projects[Math.floor(Math.random() * projects.length)];
      fallbackText = `You mentioned working on '${randomProject}'. What was your specific role and the biggest technical challenge you overcame in this project?`;
      fallbackTopic = "Project Experience";
    }

    return {
      questionText: fallbackText,
      topic: fallbackTopic,
      subtopic: "Practical Experience",
      category: "REAL_WORLD",
      difficulty: targetDifficulty || 3,
      reason: "Fallback question used due to AI generation error."
    };
  }
};
