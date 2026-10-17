/**
 * hrTopicSelector.service.js
 *
 * Selects the next HR topic from the persistent topic plan.
 * Follow-up decisions are now delegated to decideFollowUp() in interviewPlanner.service.js
 * so that the one-consecutive-follow-up limit is respected uniformly.
 *
 * This module only selects the *topic*; the controller calls decideFollowUp() separately.
 */

const HR_TOPICS = [
  "Resume & Past Experience",
  "Internship Experience",
  "Behavioral - Teamwork",
  "Behavioral - Conflict Resolution",
  "Behavioral - Leadership",
  "Situational - High Pressure / Deadline",
  "Situational - Disagreement with Manager",
  "Motivation & Career Goals",
  "Self-Awareness - Strengths & Weaknesses",
  "Learning from Failure",
  "Adaptability & Change",
  "Problem Solving",
];

/**
 * Select the next HR topic based on the persistent topic plan in the interview doc.
 * Priority:
 *  1. Next uncovered topic in the plan (plan is already rotation-sorted)
 *  2. Any remaining uncovered topic from the HR_TOPICS list
 *  3. Fallback generic topic
 *
 * @param {Object}   interview         - Full interview document (has topicPlan)
 * @param {Object[]} previousQuestions - Current interview questions
 * @returns {{ topic: string, planIndex: number }}
 */
export const hrTopicSelector = (interview, previousQuestions) => {
  const plan = interview.topicPlan || [];

  const coveredTopics = new Set(
    previousQuestions
      .filter((q) => !q.isFollowUp)
      .map((q) => (q.topic || "").toLowerCase().trim())
  );

  // Phase 1: Next uncovered topic in the plan
  for (let i = 0; i < plan.length; i++) {
    const entry = plan[i];
    if (!coveredTopics.has((entry.topic || "").toLowerCase().trim())) {
      console.log(`[HRTopicSelector] Phase 1 — uncovered: "${entry.topic}" (plan index ${i})`);
      return { topic: entry.topic, planIndex: i };
    }
  }

  // Phase 2: Any uncovered HR topic not in the plan
  const unasked = HR_TOPICS.filter((t) => !coveredTopics.has(t.toLowerCase().trim()));
  if (unasked.length > 0) {
    console.log(`[HRTopicSelector] Phase 2 — unplanned uncovered HR topic: "${unasked[0]}"`);
    return { topic: unasked[0], planIndex: -1 };
  }

  // Phase 3: Fallback
  console.log(`[HRTopicSelector] Phase 3 — all topics covered, using fallback`);
  return { topic: "Complex Behavioral Scenario", planIndex: -1 };
};
