
export const updateResumeMastery = async (resume, mode, topic, evaluation) => {
  const masteryMap = (mode === "TECHNICAL" || mode === "Technical") ? resume.technicalMastery : resume.hrMastery;
  
  // Basic logic to update mastery based on evaluation
  const averageScore = (evaluation.confidence + evaluation.communication + evaluation.correctness) / 3;
  
  if (topic) {
    const safeTopic = topic.replace(/\./g, '_');
    let currentMastery = masteryMap.get(safeTopic);
    if (!currentMastery) {
      currentMastery = {
        currentLevel: 1,
        averageScore: averageScore,
        attempts: 1,
        trend: "stable",
        demonstrated: evaluation.strengths || [],
        weakAreas: evaluation.weaknesses || [],
        lastTested: new Date()
      };
    } else {
      const newAttempts = currentMastery.attempts + 1;
      const newAverage = ((currentMastery.averageScore * currentMastery.attempts) + averageScore) / newAttempts;
      
      let trend = "stable";
      if (averageScore > currentMastery.averageScore + 1) trend = "improving";
      else if (averageScore < currentMastery.averageScore - 1) trend = "needs_practice";

      let newLevel = currentMastery.currentLevel;
      if (newAverage > 8 && currentMastery.attempts > 2) newLevel = Math.min(5, newLevel + 1);
      if (newAverage < 4 && currentMastery.attempts > 2) newLevel = Math.max(1, newLevel - 1);

      const newDemonstrated = [...(currentMastery.demonstrated || [])];
      if (evaluation.strengths) {
        evaluation.strengths.forEach(s => {
          if (!newDemonstrated.includes(s)) newDemonstrated.push(s);
        });
      }

      const newWeakAreas = [...(currentMastery.weakAreas || [])];
      if (evaluation.weaknesses) {
        evaluation.weaknesses.forEach(w => {
          if (!newWeakAreas.includes(w)) newWeakAreas.push(w);
        });
      }

      currentMastery.currentLevel = newLevel;
      currentMastery.averageScore = newAverage;
      currentMastery.attempts = newAttempts;
      currentMastery.trend = trend;
      currentMastery.demonstrated = newDemonstrated;
      currentMastery.weakAreas = newWeakAreas;
      currentMastery.lastTested = new Date();
    }
    masteryMap.set(safeTopic, currentMastery);
  }

  if (mode === "TECHNICAL" || mode === "Technical") {
    resume.markModified('technicalMastery');
  } else {
    resume.markModified('hrMastery');
  }
  
  await resume.save();
};

export const selectTopic = (resume, masteryMap, stage, previousQuestions, mode) => {
  const isHR = mode === "HR" || mode === "Hr" || mode === "hr";

  const askedTopics = previousQuestions.map(q => q.topic).filter(Boolean);

  if (isHR) {
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
      "Learning from Failure"
    ];
    const unaskedHr = hrTopics.filter(t => !askedTopics.includes(t));
    
    if (stage === "Foundation") {
      return unaskedHr.length > 0 ? unaskedHr[Math.floor(Math.random() * unaskedHr.length)] : "Communication";
    }
    if (stage === "Practical Application") {
      return unaskedHr.length > 0 ? unaskedHr[Math.floor(Math.random() * unaskedHr.length)] : "Teamwork Scenario";
    }
    
    // For Deep Dive / Challenge, check weak topics
    let weakTopic = null;
    let lowestScore = 10;
    if (masteryMap && typeof masteryMap.forEach === 'function') {
      masteryMap.forEach((val, key) => {
        if (val.averageScore < lowestScore) {
          lowestScore = val.averageScore;
          weakTopic = key;
        }
      });
    }
    if (weakTopic && lowestScore <= 6 && !askedTopics.includes(weakTopic)) {
      return weakTopic;
    }
    
    return "Complex Behavioral Scenario";
  }

  // Technical Logic
  const skills = resume.skills || [];
  const projects = resume.projects || [];
  
  // Add a pseudo-project to ensure work experience/internships are explicitly tested
  const technicalTopics = [...projects, "Past Work Experience or Internships"];
  
  const unaskedSkills = skills.filter(s => !askedTopics.includes(s));
  const unaskedProjects = technicalTopics.filter(p => !askedTopics.includes(p));

  // Determine what type of topic to pick based on the Stage
  if (stage === "Foundation") {
    // Priority: Test core skills that haven't been tested yet
    if (unaskedSkills.length > 0) return unaskedSkills[Math.floor(Math.random() * unaskedSkills.length)];
    return skills.length > 0 ? skills[0] : "General Technical Concepts";
  }
  
  if (stage === "Practical Application") {
    // Priority: Practical scenarios often involve projects, internships, or combining skills
    const mix = [...unaskedSkills, ...unaskedProjects];
    if (mix.length > 0) return mix[Math.floor(Math.random() * mix.length)];
    if (technicalTopics.length > 0) return technicalTopics[Math.floor(Math.random() * technicalTopics.length)];
    if (skills.length > 1) return `${skills[0]} and ${skills[1]}`;
    return "Practical Problem Solving";
  }
  
  if (stage === "Deep Dive" || stage === "Challenge") {
    // Priority 1: Retest weak areas from past interviews
    let weakTopic = null;
    let lowestScore = 10;
    
    if (masteryMap && typeof masteryMap.forEach === 'function') {
      masteryMap.forEach((val, key) => {
        if (val.averageScore < lowestScore) {
          lowestScore = val.averageScore;
          weakTopic = key;
        }
      });
    }
    
    // Test the weak topic if it hasn't been tested in THIS interview yet
    if (weakTopic && lowestScore <= 6 && !askedTopics.includes(weakTopic)) {
      return weakTopic;
    }
    
    // Priority 2: Dive deep into an unasked project or internship
    if (unaskedProjects.length > 0) return unaskedProjects[Math.floor(Math.random() * unaskedProjects.length)];
    
    // Priority 3: Complex scenario combining multiple unasked/asked skills
    return "Complex Architecture Scenario";
  }

  return "General Context";
};
