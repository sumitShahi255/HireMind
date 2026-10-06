export const hrTopicSelector = (
  resume,
  questionNumber,
  previousQuestions,
  currentEvaluation
) => {
  const hrTopics = [
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

  // If there's an evaluation and it presents a follow-up opportunity, take it!
  if (currentEvaluation && currentEvaluation.followUpOpportunity) {
    return {
      topic: "Follow Up",
      subtopic: "Candidate Answer Deep Dive",
      isFollowUp: true,
      followUpAngle: currentEvaluation.suggestedFollowUpAngle,
    };
  }

  // Get previously covered topics
  const coveredTopics = previousQuestions.map((q) => q.topic).filter(Boolean);

  // Filter out what's already been asked to avoid repetition
  const unaskedHr = hrTopics.filter((t) => !coveredTopics.includes(t));

  // Determine stage based on question number
  let stage = "Foundation";
  if (questionNumber > 2) stage = "Practical Application";
  if (questionNumber > 5) stage = "Deep Dive";
  if (questionNumber > 8) stage = "Challenge";

  let selectedTopic = "";

  // Prioritize missing crucial areas in the last few questions (Q8-Q10)
  if (questionNumber >= 8) {
    const criticalAreas = [
      "Behavioral - Leadership",
      "Situational - Disagreement with Manager",
      "Motivation & Career Goals",
      "Learning from Failure"
    ];
    
    const missingCritical = criticalAreas.filter(area => !coveredTopics.includes(area));
    if (missingCritical.length > 0) {
      selectedTopic = missingCritical[Math.floor(Math.random() * missingCritical.length)];
    }
  }

  // If we haven't selected a topic via priority, use stage logic
  if (!selectedTopic) {
    if (stage === "Foundation") {
      const foundations = ["Resume & Past Experience", "Internship Experience", "Motivation & Career Goals"];
      const unaskedFoundations = foundations.filter(f => !coveredTopics.includes(f));
      
      if (unaskedFoundations.length > 0) {
        selectedTopic = unaskedFoundations[Math.floor(Math.random() * unaskedFoundations.length)];
      }
    } 
    else if (stage === "Practical Application") {
      const practicals = ["Behavioral - Teamwork", "Behavioral - Conflict Resolution", "Problem Solving", "Adaptability & Change"];
      const unaskedPracticals = practicals.filter(p => !coveredTopics.includes(p));
      
      if (unaskedPracticals.length > 0) {
        selectedTopic = unaskedPracticals[Math.floor(Math.random() * unaskedPracticals.length)];
      }
    }
  }

  // Fallback to any unasked topic if the above logic yields nothing
  if (!selectedTopic && unaskedHr.length > 0) {
    selectedTopic = unaskedHr[Math.floor(Math.random() * unaskedHr.length)];
  }

  // Absolute fallback if somehow everything is exhausted
  if (!selectedTopic) {
    selectedTopic = "Complex Behavioral Scenario";
  }

  return {
    topic: selectedTopic,
    subtopic: "General",
    isFollowUp: false,
    followUpAngle: null,
  };
};
