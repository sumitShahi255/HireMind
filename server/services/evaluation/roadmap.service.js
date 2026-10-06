import { askAi } from "../groq.service.js";

/**
 * Generates a personalized 30-day candidate roadmap based on their skill gaps.
 * 
 * @param {Object} skillGapAnalysis - The skill gap analysis result
 * @param {Object} candidateContext - Basic context like target role
 * @returns {Object} Structured 30-day roadmap
 */
export const generateCandidateRoadmap = async (skillGapAnalysis, candidateContext) => {
  const systemPrompt = `
You are an expert Technical Career Coach.
Based on the candidate's Skill Gap Analysis and their target role (${candidateContext.difficulty} at ${candidateContext.company}), generate a personalized 30-Day Improvement Roadmap.

Focus exclusively on the "criticalGaps" and weak skills identified in the analysis. Do NOT give generic advice.

Return EXACTLY ONE valid JSON object in this format:
{
  "roadmapTitle": "30-Day System Design & Scalability Mastery",
  "weeks": [
    {
      "week": 1,
      "focus": "Scalability fundamentals",
      "tasks": ["Study Load Balancing algorithms", "Implement a basic caching layer", "Review CAP theorem"]
    },
    {
      "week": 2,
      "focus": "Database Optimization",
      "tasks": ["Practice SQL indexing", "Understand B-Trees", "Optimize a slow query"]
    },
    {
      "week": 3,
      "focus": "Advanced Distributed Systems",
      "tasks": ["Message queues (Kafka/RabbitMQ)", "Event-driven architecture", "Microservices communication"]
    },
    {
      "week": 4,
      "focus": "Capstone & Retake",
      "tasks": ["Design a scalable e-commerce system", "Mock interview on System Design", "Retake HireMind assessment"]
    }
  ],
  "encouragementMessage": "You have a strong foundation in OOP. By focusing on system architecture this month, you will be highly competitive for this role."
}

Rules:
- Output only JSON. No markdown.
- Ensure there are exactly 4 weeks.
- Tailor the tasks heavily to the critical gaps provided.
`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `Skill Gaps: ${JSON.stringify(skillGapAnalysis)}` }
  ];

  try {
    const aiResponse = await askAi(messages, true, 0.4); // slightly higher temp for creative tasks
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No valid JSON found in AI response");
    }
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("Failed to generate candidate roadmap.", error.message);
    
    // Fallback
    return {
      roadmapTitle: "General Improvement Plan",
      weeks: [
        { week: 1, focus: "Review Basics", tasks: ["Review fundamental concepts"] },
        { week: 2, focus: "Practice Coding", tasks: ["Solve LeetCode Mediums"] },
        { week: 3, focus: "System Design", tasks: ["Read Grokking the System Design Interview"] },
        { week: 4, focus: "Mock Interviews", tasks: ["Do 3 mock interviews"] }
      ],
      encouragementMessage: "Keep practicing and you'll improve!"
    };
  }
};
