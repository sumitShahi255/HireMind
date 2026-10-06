import { askAi } from "../groq.service.js";

/**
 * Generates an explainable score breakdown for a candidate based on their 
 * interview performance (coding, video/HR) and proctoring integrity signals.
 * 
 * @param {Object} interviewData - Complete data from the interview (Coding & HR)
 * @param {Array} proctoringLogs - Array of integrity events (e.g., phone detected)
 * @returns {Object} Structured explanation of the score
 */
export const generateExplainableScore = async (interviewData, proctoringLogs = []) => {
  const systemPrompt = `
You are an expert AI recruiter and data scientist forming an Explainable Evaluation for a candidate.
You are provided with the raw scores from their coding rounds, HR answers, and proctoring/integrity logs.

Calculate a final "Overall Score" out of 100, and break down exactly WHY they received this score using feature factors (like SHAP values).
The sum of the base score and the contributions must equal the Overall Score.

Return EXACTLY ONE valid JSON object in this format:
{
  "overallScore": 84,
  "baseScore": 50,
  "factors": [
    { "factor": "Coding correctness", "contribution": 15, "rationale": "Passed 80% of test cases." },
    { "factor": "Problem solving", "contribution": 12, "rationale": "Good algorithmic approach." },
    { "factor": "Communication", "contribution": 10, "rationale": "Clear explanations during HR round." },
    { "factor": "Integrity signals", "contribution": -5, "rationale": "Looked away from screen multiple times." }
  ],
  "summary": "Strong candidate with solid problem-solving skills, but minor integrity flags."
}

Rules:
- Output only JSON. No markdown.
- The sum of baseScore and all factor contributions MUST exactly equal overallScore.
- Contributions can be positive or negative.
- Analyze the provided data strictly and fairly.
`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `Interview Data: ${JSON.stringify(interviewData)}\nProctoring Logs: ${JSON.stringify(proctoringLogs)}` }
  ];

  try {
    const aiResponse = await askAi(messages, true, 0.2); // Low temperature for consistency
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No valid JSON found in AI response");
    }
    const result = JSON.parse(jsonMatch[0]);
    
    // Validate the sum rule just in case the LLM makes a math error
    const calculatedScore = result.baseScore + result.factors.reduce((sum, f) => sum + f.contribution, 0);
    if (calculatedScore !== result.overallScore) {
        result.overallScore = calculatedScore; // Force alignment
    }
    
    return result;
  } catch (error) {
    console.error("Failed to generate explainable score.", error.message);
    
    // Fallback explainability
    return {
      overallScore: 50,
      baseScore: 50,
      factors: [
        { factor: "System Error", contribution: 0, rationale: `Error: ${error.message}` }
      ],
      summary: "Score could not be fully explained due to an error."
    };
  }
};
