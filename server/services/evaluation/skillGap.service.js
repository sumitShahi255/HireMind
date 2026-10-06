import { askAi } from "../groq.service.js";

/**
 * Analyzes the skill gaps of a candidate based on their interview performance
 * compared against the expected skills for the role/company.
 * 
 * @param {Object} interviewData - Complete data from the interview (Coding & HR)
 * @param {Array} requiredSkills - Optional list of required skills
 * @returns {Object} Structured skill gap analysis
 */
export const generateSkillGapAnalysis = async (interviewData, requiredSkills = []) => {
  let exampleSkills = "";
  if (interviewData.type === "Coding") {
    exampleSkills = `
    { "skill": "Data Structures & Algorithms", "score": 90 },
    { "skill": "Code Quality & Cleanliness", "score": 82 },
    { "skill": "Time & Space Complexity", "score": 52 },
    { "skill": "Problem Solving", "score": 81 }`;
  } else if (interviewData.type?.includes("HR")) {
    exampleSkills = `
    { "skill": "Communication & Clarity", "score": 90 },
    { "skill": "Behavioral & Cultural Fit", "score": 82 },
    { "skill": "Leadership & Initiative", "score": 52 },
    { "skill": "Conflict Resolution", "score": 81 }`;
  } else {
    exampleSkills = `
    { "skill": "Backend & API Design", "score": 90 },
    { "skill": "Database Management", "score": 82 },
    { "skill": "System Design & Architecture", "score": 52 },
    { "skill": "Problem Solving", "score": 81 }`;
  }

  const systemPrompt = `
You are an expert technical assessor and HR manager.
Your task is to perform a Skill Gap Analysis for a candidate based on their interview performance.

Compare their demonstrated skills in the interview against the typical required skills for a ${interviewData.difficulty || interviewData.experience || "mid"} level role at ${interviewData.company || "a tech company"}.
${requiredSkills.length > 0 ? `Explicitly check for these required skills: ${requiredSkills.join(", ")}` : ""}

Evaluate each skill on a percentage scale (0-100%).
Identify the top critical gaps or weaknesses that the candidate needs to address.

CRITICAL: Do NOT just copy the example skill names below. You MUST derive the specific skills based on the EXACT questions asked in the interview data. For example, if it's a coding interview about arrays, use "Array Manipulation".

Return EXACTLY ONE valid JSON object in this format:
{
  "skills": [${exampleSkills}
  ],
  "criticalGaps": [
    "Specific Topic - Needs improvement in this specific area.",
    "Another Topic - Struggled with edge cases here."
  ],
  "strengths": [
    "Strong command over this specific concept.",
    "Excellent communication and structural clarity."
  ]
}

Rules:
- Output only JSON. No markdown.
- Be realistic and rigorous. If they missed edge cases, their score should reflect it.
- Keep the gaps actionable and specific.
`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `Interview Data: ${JSON.stringify(interviewData)}` }
  ];

  try {
    const aiResponse = await askAi(messages, true, 0.2);
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No valid JSON found in AI response");
    }
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("Failed to generate skill gap analysis.", error.message);
    
    // Fallback
    return {
      skills: [
        { skill: "Problem Solving", score: 50 },
        { skill: "Coding", score: 50 }
      ],
      criticalGaps: [`System error: ${error.message}`],
      strengths: []
    };
  }
};
