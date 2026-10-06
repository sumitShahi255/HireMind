import { askAi } from "../groq.service.js";

export const evaluateAnswer = async (questionText, answerText, mode) => {
  let systemPrompt = `
You are an expert interviewer evaluating a candidate's answer.
Analyze the response realistically, fairly, and critically.

Score the following from 1 to 10:
- confidence: Delivery and sureness.
- communication: Clarity and structure.
- correctness: Accuracy of the information.
- technicalDepth: Depth of knowledge demonstrated (score 0 for HR questions if inapplicable).
- practicalApplication: Ability to apply the concept to real-world scenarios.
- relevance: How relevant the answer is to the question.
- specificity: How specific their examples are (vs generic/vague).
- ownership: Demonstration of taking responsibility and leadership.

Also provide arrays of short strings for:
- strengths: What they did well.
- weaknesses: Areas of improvement or incorrect statements.
- missingConcepts: Key concepts they should have mentioned but didn't.

Follow-Up Analysis (CRITICAL FOR HR MODE):
- followUpOpportunity: true if the answer is vague, generic, OR if it mentions an interesting scenario that should be probed deeper (e.g. a conflict, a failure). false if the answer is completely satisfactory and no follow-up is needed.
- suggestedFollowUpAngle: If followUpOpportunity is true, provide a 1-sentence suggestion on what to ask next (e.g., "Ask for the specific conflict and how it was resolved"). If false, leave empty.

Return EXACTLY ONE valid JSON object:
{
  "confidence": number,
  "communication": number,
  "correctness": number,
  "technicalDepth": number,
  "practicalApplication": number,
  "relevance": number,
  "specificity": number,
  "ownership": number,
  "strengths": ["string"],
  "weaknesses": ["string"],
  "missingConcepts": ["string"],
  "followUpOpportunity": boolean,
  "suggestedFollowUpAngle": "string",
  "summary": "1-2 sentence professional feedback summary to show the candidate"
}

Rules:
- Output only JSON, no markdown formatting.
- CRITICAL: If the answer is completely missing, irrelevant, off-topic, or says "I don't know", you MUST score EXACTLY 0 for ALL metrics (confidence, communication, correctness, etc). Do NOT give 1 or 2 for effort.
- Do not inflate scores. Be extremely strict.
`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `Question Asked: ${questionText}\nCandidate Answer: ${answerText || "[No answer provided]"}` }
  ];

  try {
    const aiResponse = await askAi(messages, true, 0.3, "qwen/qwen3.8-27b");
    return JSON.parse(aiResponse);
  } catch (error) {
    console.error("Failed to evaluate answer from AI. Using fallback.", error.message);
    
    // Return a default evaluation to prevent the interview from crashing
    return {
      confidence: 5,
      communication: 5,
      correctness: 5,
      technicalDepth: 5,
      practicalApplication: 5,
      relevance: 5,
      specificity: 5,
      ownership: 5,
      strengths: ["Attempted to answer the question"],
      weaknesses: ["AI service was unavailable for detailed evaluation"],
      missingConcepts: [],
      followUpOpportunity: false,
      suggestedFollowUpAngle: "",
      summary: "Good effort. (Note: AI evaluation was temporarily unavailable due to a network or rate limit issue)."
    };
  }
};
