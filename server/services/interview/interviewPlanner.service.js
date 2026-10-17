/**
 * interviewPlanner.service.js
 *
 * Central coordinator for topic selection, mastery tracking, and topic-plan management.
 *
 * DESIGN PRINCIPLES:
 *  - The backend decides which topic to test — the AI only generates a question for it.
 *  - A persistent topic plan is built once per interview session and never regenerated.
 *  - Weak answers do NOT immediately force the same topic again.
 *  - At most ONE consecutive follow-up per topic is allowed.
 *  - Weak-topic revision is secondary to covering uncovered topics.
 *  - Cross-interview rotation uses previous-interview history to prefer under-tested topics.
 */

// ─── Normalization ──────────────────────────────────────────────────────────

/**
 * Normalise a topic name so that mastery-map keys and plan topic names
 * always match, regardless of capitalisation or Mongoose dot-escaping.
 */
export const normalizeTopic = (topic) => {
  if (!topic) return "";
  return topic.trim().toLowerCase().replace(/\./g, "_");
};

/**
 * Strip common category prefixes (e.g. "Project:", "Experience:", "Achievement:", "Scenario:")
 * for flexible matching.
 */
export const stripTopicPrefix = (topic) => {
  if (!topic) return "";
  return topic.replace(/^(project|experience|internship|achievement|scenario):\s*/i, "").trim();
};

// ─── Resume Section Parser ───────────────────────────────────────────────────

/**
 * Parse and categorize grounded sections from resume data without inventing unlisted details.
 *
 * Grounded categories:
 *  - fundamentals: Core CS, OOP, DBMS, DSA, base programming languages
 *  - practical: Frameworks, APIs, libraries, web/mobile, databases
 *  - experiences: Internship responsibilities, role mentions (e.g. RBAC), and measurable achievements
 *  - projects: Concrete projects listed in resume
 *  - scenarios: Realistic situational challenges grounded strictly in candidate's tech stack
 *
 * @param {Object} resume - { skills, projects, resumeText }
 * @returns {{ fundamentals: Array, practical: Array, experiences: Array, projects: Array, scenarios: Array }}
 */
export const parseResumeSections = (resume = {}) => {
  const resumeText = resume.resumeText || "";
  const skillsList = Array.isArray(resume.skills) ? resume.skills : [];
  const projectsList = Array.isArray(resume.projects) ? resume.projects : [];

  const fundamentals = [];
  const practical = [];
  const experiences = [];
  const projects = [];
  const scenarios = [];

  // Helper: extract surrounding snippet from resumeText
  const extractSnippet = (term, maxLen = 220) => {
    if (!resumeText || !term) return "";
    const idx = resumeText.toLowerCase().indexOf(term.toLowerCase());
    if (idx === -1) return "";
    const start = Math.max(0, idx - 30);
    const end = Math.min(resumeText.length, idx + term.length + (maxLen - 30));
    let snippet = resumeText.slice(start, end).replace(/\s+/g, " ").trim();
    if (start > 0) snippet = "..." + snippet;
    if (end < resumeText.length) snippet = snippet + "...";
    return snippet;
  };

  // 1. Categorize Skills into Fundamentals vs Practical Implementation
  const fundamentalPatterns = [
    /^java$/i,
    /^c$/i,
    /^c\+\+$/i,
    /^python$/i,
    /^javascript$/i,
    /^typescript$/i,
    /^go$/i,
    /^golang$/i,
    /^rust$/i,
    /^ruby$/i,
    /^sql$/i,
    /^dsa$/i,
    /^data structures/i,
    /^algorithms/i,
    /^oop$/i,
    /^object[- ]oriented/i,
    /^dbms$/i,
    /^database management/i,
    /^operating systems?$/i,
    /^computer networks?$/i,
    /^system design$/i,
  ];

  skillsList.forEach((skill) => {
    const trimmed = skill.trim();
    if (!trimmed) return;
    const isFund = fundamentalPatterns.some((pattern) => pattern.test(trimmed));
    const snippet = extractSnippet(trimmed, 140);
    if (isFund) {
      fundamentals.push({
        topic: trimmed,
        category: "core_fundamental",
        context: snippet || `Core fundamental concept: ${trimmed}`,
      });
    } else {
      practical.push({
        topic: trimmed,
        category: "practical_implementation",
        context: snippet || `Practical technology/framework: ${trimmed}`,
      });
    }
  });

  // Helper: extract clean context and technologies for a project
  const extractProjectDetails = (projectName) => {
    if (!resumeText || !projectName) {
      return { context: `Candidate project: ${projectName}`, technologies: [] };
    }
    const pLower = projectName.toLowerCase();
    const idx = resumeText.toLowerCase().indexOf(pLower);
    if (idx === -1) {
      return { context: `Candidate project: ${projectName}`, technologies: [] };
    }

    // Capture the line / block describing this project
    const start = idx;
    const forwardText = resumeText.slice(start, start + 450);
    // Boundary: next bullet point, next major project title, or major section header
    const boundary = forwardText
      .slice(projectName.length)
      .search(/\n\s*[-•*]|\n\s*[A-Z][A-Za-z0-9_.\- ]{2,25}\s*[:\n]|\n\s*(?:skills|experience|internship|education|certifications)\b/i);
    const end = boundary !== -1 ? start + projectName.length + boundary : start + Math.min(forwardText.length, 350);
    const desc = resumeText.slice(start, end).replace(/\s+/g, " ").trim();

    // Scan for technologies mentioned in the project description
    const detectedTechs = [];
    const techSignatures = [
      { name: "Python", regex: /\bpython\b/i },
      { name: "FastAPI", regex: /\bfastapi\b/i },
      { name: "ML", alt: "Machine Learning", regex: /\b(?:ml|machine\s+learning)\b/i },
      { name: "Computer Vision", regex: /\b(?:computer\s+vision|cv)\b/i },
      { name: "React", regex: /\breact(?:\.js|js)?\b/i },
      { name: "Node.js", regex: /\bnode(?:\.js|js)?\b/i },
      { name: "Express.js", regex: /\bexpress(?:\.js|js)?\b/i },
      { name: "MongoDB", regex: /\bmongodb\b/i },
      { name: "MySQL", regex: /\bmysql\b/i },
      { name: "REST APIs", regex: /\brest(?:ful)?\s*api[s]?\b/i },
      { name: "PyTorch", regex: /\bpytorch\b/i },
      { name: "TensorFlow", regex: /\btensorflow\b/i },
    ];

    techSignatures.forEach(({ name, alt, regex }) => {
      if (regex.test(desc)) {
        detectedTechs.push(name);
        if (alt) detectedTechs.push(alt);
      }
    });

    return {
      context: desc,
      technologies: detectedTechs,
    };
  };

  // 2. Extract Projects
  const seenProjects = new Set();
  projectsList.forEach((proj) => {
    const trimmed = proj.trim();
    if (!trimmed || seenProjects.has(trimmed.toLowerCase())) return;
    seenProjects.add(trimmed.toLowerCase());
    const details = extractProjectDetails(trimmed);
    projects.push({
      topic: `Project: ${trimmed}`,
      category: "resume_project",
      context: details.context || `Candidate resume project: ${trimmed}`,
      technologies: details.technologies || [],
    });
  });

  // If projects list was empty, extract explicit project titles from resumeText
  if (projects.length === 0 && resumeText) {
    const projMatch = resumeText.match(/(?:projects?|academic projects?)\s*[:\n]([\s\S]*?)(?:experience|skills|education|$)/i);
    if (projMatch && projMatch[1]) {
      const lines = projMatch[1].split(/\n|\r|\u2022|;/).map((l) => l.trim()).filter((l) => l.length > 3);
      for (const line of lines.slice(0, 3)) {
        const titleMatch = line.match(/^([A-Za-z0-9_.\- ]{3,30})(?:\s*[-:]|\s+using|\s+built|\s+is|\s*\(|$)/i);
        const name = titleMatch ? titleMatch[1].trim() : line.slice(0, 25).trim();
        if (name && !seenProjects.has(name.toLowerCase())) {
          seenProjects.add(name.toLowerCase());
          const details = extractProjectDetails(name);
          projects.push({
            topic: `Project: ${name}`,
            category: "resume_project",
            context: details.context || line.slice(0, 250).trim(),
            technologies: details.technologies || [],
          });
        }
      }
    }
  }

  // 3. Extract Internship & Experience from resumeText
  if (resumeText) {
    // Specific MERN internship check
    if (/mern\s+(?:stack\s+)?intern(?:ship)?/i.test(resumeText)) {
      const snippet = extractSnippet("intern", 250);
      experiences.push({
        topic: "Experience: MERN Internship",
        category: "resume_experience",
        context: snippet || "MERN Stack internship role and responsibilities as stated on candidate's resume.",
      });
    } else {
      // General intern/internship match if present
      const internMatch = resumeText.match(/([A-Za-z0-9_.\- ]{0,30}\s*intern(?:ship)?)/i);
      if (internMatch && internMatch[1] && !/no internship/i.test(internMatch[1])) {
        const roleName = internMatch[1].trim();
        experiences.push({
          topic: `Experience: ${roleName}`,
          category: "resume_experience",
          context: extractSnippet(roleName, 250),
        });
      }
    }

    // Role-Based Access Control (RBAC)
    if (/role[- ]based access control|\brbac\b/i.test(resumeText)) {
      const snippet = extractSnippet("rbac", 200) || extractSnippet("role-based", 200);
      experiences.push({
        topic: "Experience: Role-Based Access Control (RBAC)",
        category: "resume_experience",
        context: snippet || "Implementation of Role-Based Access Control (RBAC) in candidate's experience/projects.",
      });
    }

    // 4. Measurable Achievements (percentage or metric performance improvements)
    const metricMatch =
      resumeText.match(/(?:database optimization|optimization|query optimization|performance improvement|latency reduction).*?(\d+%\s*(?:performance improvement|improvement|faster|reduction|boost)?)/i) ||
      resumeText.match(/(\d+%\s*(?:performance improvement|improvement|faster|reduction|boost))/i);

    if (metricMatch) {
      const metricText = metricMatch[0].trim();
      const pctMatch = metricText.match(/(\d+%)/);
      const pct = pctMatch ? pctMatch[1] : "";
      const isDbOpt = /database|db|query/i.test(metricText);
      const title = isDbOpt
        ? `Achievement: Database Optimization (${pct} Improvement)`
        : `Achievement: Performance Optimization (${pct})`;

      experiences.push({
        topic: title,
        category: "resume_experience",
        context: extractSnippet(pct || metricText, 250) || metricText,
      });
    }
  }

  // 5. Build supportedTechnologies set across skills, projects, and experiences
  const supportedTechnologies = new Set();

  skillsList.forEach((s) => {
    if (s && s.trim()) supportedTechnologies.add(s.trim());
  });

  projects.forEach((p) => {
    (p.technologies || []).forEach((t) => supportedTechnologies.add(t));
  });

  const candidateTechPatterns = [
    { name: "Python", regex: /\bpython\b/i },
    { name: "FastAPI", regex: /\bfastapi\b/i },
    { name: "ML", alt: "Machine Learning", regex: /\b(?:ml|machine\s+learning)\b/i },
    { name: "Java", regex: /\bjava\b/i },
    { name: "JavaScript", regex: /\bjavascript\b/i },
    { name: "React", regex: /\breact(?:\.js|js)?\b/i },
    { name: "Node.js", regex: /\bnode(?:\.js|js)?\b/i },
    { name: "Express.js", regex: /\bexpress(?:\.js|js)?\b/i },
    { name: "MongoDB", regex: /\bmongodb\b/i },
    { name: "MySQL", regex: /\bmysql\b/i },
    { name: "REST APIs", regex: /\brest(?:ful)?\s*api[s]?\b/i },
    { name: "HTML", regex: /\bhtml(?:5)?\b/i },
    { name: "CSS", regex: /\bcss(?:3)?\b/i },
    { name: "Bootstrap", regex: /\bbootstrap\b/i },
    { name: "DSA", regex: /\bdsa|data\s+structures\b/i },
    { name: "OOP", regex: /\boop|object[- ]oriented\b/i },
    { name: "DBMS", regex: /\bdbms\b/i },
    { name: "SQL", regex: /\bsql\b/i },
  ];

  candidateTechPatterns.forEach(({ name, alt, regex }) => {
    if (regex.test(resumeText)) {
      supportedTechnologies.add(name);
      if (alt) supportedTechnologies.add(alt);
    }
  });

  // If ResQVision or other projects introduce technologies like Python, FastAPI, or ML not in skills list,
  // ensure they are recognized as resume-supported topics with proper foundational/practical categorization
  if (supportedTechnologies.has("Python") && !fundamentals.some((f) => normalizeTopic(f.topic) === "python")) {
    fundamentals.push({
      topic: "Python",
      category: "core_fundamental",
      context: "Used in Project: ResQVision for backend services and ML inference.",
    });
  }

  if (supportedTechnologies.has("FastAPI") && !practical.some((p) => normalizeTopic(p.topic) === "fastapi")) {
    practical.push({
      topic: "FastAPI",
      category: "practical_implementation",
      context: "Used in Project: ResQVision for high-performance REST API services.",
    });
  }

  if (supportedTechnologies.has("ML") && !practical.some((p) => normalizeTopic(p.topic) === "ml" || normalizeTopic(p.topic) === "machine_learning_(ml)")) {
    practical.push({
      topic: "Machine Learning (ML)",
      category: "practical_implementation",
      context: "Used in Project: ResQVision for real-time hazard detection models.",
    });
  }

  // 6. Realistic Problem-Solving Scenarios (strictly derived from candidate's actual tech stack)
  const skillsLower = skillsList.map((s) => s.toLowerCase());
  const hasDb = skillsLower.some((s) => /mysql|mongodb|postgres|sql|dbms/.test(s));
  const hasBackend = skillsLower.some((s) => /node|express|rest|api/.test(s));
  const hasFrontend = skillsLower.some((s) => /react|angular|vue|next/.test(s));
  const hasJava = skillsLower.some((s) => /java/.test(s));

  if (hasDb) {
    scenarios.push({
      topic: "Scenario: Database Optimization & Query Performance",
      category: "problem_solving",
      context: "Real-world database performance, indexing, query optimization, and schema design scenario tailored to candidate's database skills.",
    });
  }

  if (hasBackend || experiences.some((e) => /rbac/i.test(e.topic))) {
    scenarios.push({
      topic: "Scenario: Secure API Design & Authorization",
      category: "problem_solving",
      context: "Practical scenario on authentication, authorization (RBAC), and API error handling within candidate's backend stack.",
    });
  }

  if (hasFrontend && hasBackend) {
    scenarios.push({
      topic: "Scenario: Full-Stack Architecture & State Management",
      category: "problem_solving",
      context: "Practical scenario focusing on data flow, state synchronization, and failure recovery across frontend and backend services.",
    });
  } else if (hasJava) {
    scenarios.push({
      topic: "Scenario: Object-Oriented System Architecture & Exception Handling",
      category: "problem_solving",
      context: "Architecture and design scenario applying OOP principles and exception management in Java.",
    });
  }

  if (supportedTechnologies.has("FastAPI") || supportedTechnologies.has("ML")) {
    scenarios.push({
      topic: "Scenario: Real-Time Vision & API Inference",
      category: "problem_solving",
      context: "Practical scenario on low-latency ML model inference and API endpoints in Python/FastAPI based on ResQVision.",
    });
  }

  return {
    fundamentals,
    practical,
    experiences,
    projects,
    scenarios,
    supportedTechnologies: Array.from(supportedTechnologies),
  };
};

/**
 * Check whether a technology is supported anywhere in the candidate's resume
 * (skills, project descriptions, or experience context).
 *
 * @param {string} tech   - Technology name (e.g. "Python", "FastAPI", "Docker")
 * @param {Object} resume - Resume document
 * @returns {boolean}
 */
export const isTechnologySupported = (tech, resume = {}) => {
  if (!tech || typeof tech !== "string") return false;
  const sections = parseResumeSections(resume);
  const tNorm = normalizeTopic(tech);
  const supported = sections.supportedTechnologies || [];

  const aliasMap = {
    ml: ["ml", "machine_learning", "machine learning"],
    machine_learning: ["ml", "machine_learning", "machine learning"],
    js: ["javascript", "js"],
    javascript: ["javascript", "js"],
    ts: ["typescript", "ts"],
    typescript: ["typescript", "ts"],
    postgres: ["postgresql", "postgres"],
    postgresql: ["postgresql", "postgres"],
    node: ["node", "node_js", "nodejs"],
    node_js: ["node", "node_js", "nodejs"],
  };

  const aliases = aliasMap[tNorm] || [tNorm];

  return supported.some((st) => {
    const sNorm = normalizeTopic(st);
    if (aliases.includes(sNorm)) return true;
    return sNorm === tNorm || sNorm.includes(tNorm) || tNorm.includes(sNorm);
  });
};

// ─── Topic-Plan Builder ──────────────────────────────────────────────────────

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
 * Build a fresh topic plan for a new interview session.
 *
 * For TECHNICAL mode:
 *  - Integrates core fundamentals, practical implementation, resume-specific deep dives
 *    (projects, internship, measurable achievements), and realistic problem-solving scenarios.
 *  - Interleaves categories so projects and internships are tested in every interview session
 *    instead of being starved behind a long skills list.
 *  - Uses previous interview history to prioritize under-tested topics across sessions.
 *
 * For HR mode: uses a fixed ordered list, rotated similarly.
 *
 * @param {Object}   resume          - Resume document
 * @param {string}   mode            - "TECHNICAL" | "Technical" | "HR"
 * @param {Object[]} previousHistory - Array of completed interview docs (most-recent first)
 * @returns {Array<{topic, category, context, subtopicsTested, timesAsked, isWeak}>}
 */
export const buildTopicPlan = (resume = {}, mode = "TECHNICAL", previousHistory = []) => {
  const isHR = mode === "HR" || mode === "Hr" || mode === "hr";

  // Count how many times each topic was asked across all previous interviews
  const crossInterviewCount = {};
  previousHistory.forEach((interview) => {
    (interview.questions || []).forEach((q) => {
      const key = normalizeTopic(q.assignedTopic || q.topic);
      if (key) crossInterviewCount[key] = (crossInterviewCount[key] || 0) + 1;
    });
  });

  if (isHR) {
    let rawTopics = [...HR_TOPICS];
    const seen = new Set();
    rawTopics = rawTopics.filter((t) => {
      const key = normalizeTopic(t);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    rawTopics.sort((a, b) => {
      const ca = crossInterviewCount[normalizeTopic(a)] || 0;
      const cb = crossInterviewCount[normalizeTopic(b)] || 0;
      return ca - cb;
    });

    return rawTopics.map((topic) => ({
      topic,
      category: "hr",
      context: "",
      subtopicsTested: [],
      timesAsked: 0,
      isWeak: false,
    }));
  }

  // ── TECHNICAL MODE ──
  const sections = parseResumeSections(resume);
  const { fundamentals, practical, experiences, projects, scenarios } = sections;

  // Sort each category by cross-interview count (ascending) so under-tested items come first
  const sortByCrossCount = (list) => {
    return [...list].sort((a, b) => {
      const ca = crossInterviewCount[normalizeTopic(a.topic)] || 0;
      const cb = crossInterviewCount[normalizeTopic(b.topic)] || 0;
      return ca - cb;
    });
  };

  const sortedFundamentals = sortByCrossCount(fundamentals);
  const sortedPractical = sortByCrossCount(practical);
  const sortedExperiences = sortByCrossCount(experiences);
  const sortedProjects = sortByCrossCount(projects);
  const sortedScenarios = sortByCrossCount(scenarios);

  // Fallback if resume is completely empty
  if (
    sortedFundamentals.length === 0 &&
    sortedPractical.length === 0 &&
    sortedExperiences.length === 0 &&
    sortedProjects.length === 0
  ) {
    const fallbackList = [
      { topic: "General Technical Concepts", category: "core_fundamental", context: "" },
      { topic: "Data Structures & Algorithms", category: "core_fundamental", context: "" },
      { topic: "System Architecture & Design", category: "problem_solving", context: "" },
      { topic: "Practical Problem Solving", category: "practical_implementation", context: "" },
    ];
    return fallbackList.map((item) => ({
      topic: item.topic,
      category: item.category,
      context: item.context,
      subtopicsTested: [],
      timesAsked: 0,
      isWeak: false,
    }));
  }

  const plan = [];
  const added = new Set();

  const addTopic = (item) => {
    if (!item || !item.topic) return;
    const key = normalizeTopic(item.topic);
    if (!added.has(key)) {
      added.add(key);
      plan.push({
        topic: item.topic,
        category: item.category || "general",
        context: item.context || "",
        subtopicsTested: [],
        timesAsked: 0,
        isWeak: false,
      });
    }
  };

  // 1. Stage: Foundation (Questions 1 - 2)
  // Pull top under-tested core fundamentals; if none, practical skills
  if (sortedFundamentals.length > 0) addTopic(sortedFundamentals[0]);
  if (sortedFundamentals.length > 1) addTopic(sortedFundamentals[1]);
  if (plan.length < 2 && sortedPractical.length > 0) addTopic(sortedPractical[0]);

  // 2. Stage: Practical Application (Questions 3 - 4)
  // Pull top under-tested practical implementation skills
  const unaddedPractical = sortedPractical.filter((p) => !added.has(normalizeTopic(p.topic)));
  if (unaddedPractical.length > 0) addTopic(unaddedPractical[0]);
  if (unaddedPractical.length > 1) addTopic(unaddedPractical[1]);

  // 3. Stage: Practical Application / Deep Dive - Experience & Achievements (Question 5)
  // Pull under-tested internship responsibility or measurable achievement
  if (sortedExperiences.length > 0) addTopic(sortedExperiences[0]);

  // 4. Stage: Deep Dive - Resume Projects (Questions 6 - 7)
  // Pull under-tested resume projects
  if (sortedProjects.length > 0) addTopic(sortedProjects[0]);
  if (sortedProjects.length > 1) addTopic(sortedProjects[1]);

  // If projects are exhausted or absent, pull another experience topic
  const unaddedExp = sortedExperiences.filter((e) => !added.has(normalizeTopic(e.topic)));
  if (plan.length < 7 && unaddedExp.length > 0) addTopic(unaddedExp[0]);

  // 5. Stage: Challenge / Problem Solving (Question 8)
  // Realistic problem-solving scenario grounded in candidate's tech stack
  if (sortedScenarios.length > 0) addTopic(sortedScenarios[0]);

  // 6. Remaining slots: Add all remaining items from all categories
  // Sorted strictly by cross-interview count so under-tested items always come first
  const remainingPool = [
    ...sortedExperiences,
    ...sortedProjects,
    ...sortedScenarios,
    ...sortedPractical,
    ...sortedFundamentals,
  ].filter((item) => !added.has(normalizeTopic(item.topic)));

  remainingPool.sort((a, b) => {
    const ca = crossInterviewCount[normalizeTopic(a.topic)] || 0;
    const cb = crossInterviewCount[normalizeTopic(b.topic)] || 0;
    return ca - cb;
  });

  remainingPool.forEach(addTopic);

  // If candidate has projects/skills but experiences was empty and resume has no internship mention,
  // append generic fallback experience at the end so it's available without being invented early
  if (sortedExperiences.length === 0 && !added.has(normalizeTopic("Past Work Experience or Internships"))) {
    addTopic({
      topic: "Past Work Experience or Internships",
      category: "resume_experience",
      context: "Candidate's past software engineering work experience and internships.",
    });
  }

  return plan;
};

// ─── Topic Selector ──────────────────────────────────────────────────────────

/**
 * Select the next topic from the persistent topic plan.
 *
 * Priority order:
 *  1. Next uncovered topic in the plan (in plan order — already rotation-sorted)
 *  2. Weak topic not yet revisited in this interview (revision phase)
 *  3. Any remaining plan topic (deeper questions on already-covered topics)
 *  4. Generic fallback
 *
 * @param {Object}   interview   - Full interview document (has topicPlan, topicPlanIndex)
 * @param {Object}   masteryMap  - resume.technicalMastery or resume.hrMastery (Mongoose Map)
 * @returns {{ topic: string, category: string, context: string, planIndex: number, isRevision: boolean }}
 */
export const selectNextTopic = (interview, masteryMap) => {
  const plan = interview.topicPlan || [];
  const coveredTopics = new Set(
    interview.questions
      .filter((q) => !q.isFollowUp)
      .map((q) => normalizeTopic(q.assignedTopic || q.topic))
  );

  // Phase 1: Find the next uncovered topic in the plan
  for (let i = 0; i < plan.length; i++) {
    const entry = plan[i];
    if (!coveredTopics.has(normalizeTopic(entry.topic))) {
      console.log(`[TopicSelector] Phase 1 — uncovered topic: "${entry.topic}" (plan index ${i})`);
      return {
        topic: entry.topic,
        category: entry.category || "general",
        context: entry.context || "",
        planIndex: i,
        isRevision: false,
      };
    }
  }

  // Phase 2: All planned topics covered — revisit weak topics with different subtopics
  const weakTopicsInPlan = plan.filter((entry) => {
    const mastery = masteryMap?.get(normalizeTopic(entry.topic).replace(/\./g, "_"));
    return mastery && mastery.averageScore <= 5;
  });

  if (weakTopicsInPlan.length > 0) {
    // Pick the weakest topic not revisited more than once
    let best = null;
    let bestScore = Infinity;
    weakTopicsInPlan.forEach((entry, idx) => {
      const key = normalizeTopic(entry.topic).replace(/\./g, "_");
      const mastery = masteryMap?.get(key);
      if (mastery && mastery.averageScore < bestScore) {
        bestScore = mastery.averageScore;
        best = { entry, planIndex: idx };
      }
    });
    if (best) {
      console.log(`[TopicSelector] Phase 2 — weak-topic revision: "${best.entry.topic}" (score ${bestScore.toFixed(1)})`);
      return {
        topic: best.entry.topic,
        category: best.entry.category || "general",
        context: best.entry.context || "",
        planIndex: best.planIndex,
        isRevision: true,
      };
    }
  }

  // Phase 3: All covered, no weak topics — cycle through topics for deeper questions
  const idx = interview.topicPlanIndex % Math.max(plan.length, 1);
  const fallbackEntry = plan[idx] || { topic: "General Technical Concepts", category: "general", context: "" };
  console.log(`[TopicSelector] Phase 3 — deeper questions on: "${fallbackEntry.topic}"`);
  return {
    topic: fallbackEntry.topic,
    category: fallbackEntry.category || "general",
    context: fallbackEntry.context || "",
    planIndex: idx,
    isRevision: false,
  };
};

// ─── Follow-Up Decision ──────────────────────────────────────────────────────

/**
 * Decide whether the next question should be a follow-up.
 *
 * Rules:
 *  - Max 1 consecutive follow-up per topic (regardless of weak score).
 *  - Follow-up is only allowed when the evaluator flagged followUpOpportunity AND
 *    the candidate actually answered (not "I don't know" / blank).
 *  - A weak answer RECORDS the weakness; it does NOT force a follow-up.
 *
 * @param {Object} interview      - Full interview document
 * @param {Object} latestEval     - Latest evaluation result
 * @param {string} latestAnswer   - Raw answer string
 * @returns {{ isFollowUp: boolean, followUpAngle: string|null }}
 */
export const decideFollowUp = (interview, latestEval, latestAnswer) => {
  const MAX_CONSECUTIVE_FOLLOW_UPS = 1;

  const consecutiveFollowUps = interview.consecutiveFollowUps || 0;
  if (consecutiveFollowUps >= MAX_CONSECUTIVE_FOLLOW_UPS) {
    console.log(`[FollowUp] Blocked — already used ${consecutiveFollowUps} consecutive follow-up(s). Moving to next topic.`);
    return { isFollowUp: false, followUpAngle: null };
  }

  const answerIsBlank = !latestAnswer || latestAnswer.trim().length < 5;
  const saidDontKnow = latestAnswer && /don.?t know|no idea|not sure|can.?t answer|skip/i.test(latestAnswer);

  if (answerIsBlank || saidDontKnow) {
    // Record weakness but move on — don't follow up on a blank/skipped answer
    console.log(`[FollowUp] Skipping — candidate did not answer. Recording weakness and moving on.`);
    return { isFollowUp: false, followUpAngle: null };
  }

  if (latestEval?.followUpOpportunity && latestEval?.suggestedFollowUpAngle) {
    console.log(`[FollowUp] Approved — evaluator flagged opportunity: "${latestEval.suggestedFollowUpAngle}"`);
    return { isFollowUp: true, followUpAngle: latestEval.suggestedFollowUpAngle };
  }

  return { isFollowUp: false, followUpAngle: null };
};

// ─── Stage Calculator ────────────────────────────────────────────────────────

export const getStage = (questionNumber) => {
  if (questionNumber <= 2) return "Foundation";
  if (questionNumber <= 5) return "Practical Application";
  if (questionNumber <= 8) return "Deep Dive";
  return "Challenge";
};

// ─── Difficulty Calculator ───────────────────────────────────────────────────

export const getAdaptiveDifficulty = (topicMastery, stage) => {
  if (!topicMastery || topicMastery.attempts === 0) {
    if (stage === "Foundation") return 1;
    if (stage === "Practical Application") return 2;
    if (stage === "Deep Dive") return 3;
    return 4;
  }
  let baseDiff = topicMastery.currentLevel || 1;
  let diff = baseDiff;
  if (stage === "Challenge") diff = Math.min(5, baseDiff + 1);
  if (stage === "Foundation") diff = Math.max(1, baseDiff - 1);
  return diff;
};

// ─── Mastery Updater ─────────────────────────────────────────────────────────

/**
 * Update the resume's mastery map after an answer is evaluated.
 * Handles missing/null scores safely (normalises to 0).
 * Also marks the topic plan entry as weak if score <= 5.
 *
 * @param {Object} resume       - Resume document
 * @param {string} mode         - "TECHNICAL" | "Technical" | "HR"
 * @param {string} topic        - Topic name (original, not normalised)
 * @param {string} subtopic     - Subtopic name
 * @param {Object} evaluation   - Evaluation result from evaluateAnswer()
 * @param {Object} interview    - Interview document (to update topicPlan entry)
 */
export const updateResumeMastery = async (resume, mode, topic, subtopic, evaluation, interview) => {
  const masteryMap = (mode === "TECHNICAL" || mode === "Technical")
    ? resume.technicalMastery
    : resume.hrMastery;

  // Safely extract numeric scores (guard against null/undefined)
  const toNum = (v) => (typeof v === "number" && !isNaN(v) ? v : 0);
  const averageScore = (toNum(evaluation.confidence) + toNum(evaluation.communication) + toNum(evaluation.correctness)) / 3;

  if (topic) {
    const safeTopic = normalizeTopic(topic).replace(/\//g, "_");
    let currentMastery = masteryMap.get(safeTopic);

    if (!currentMastery) {
      currentMastery = {
        currentLevel: 1,
        averageScore,
        attempts: 1,
        trend: "stable",
        demonstrated: evaluation.strengths || [],
        weakAreas: evaluation.weaknesses || [],
        lastTested: new Date(),
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
      (evaluation.strengths || []).forEach((s) => {
        if (!newDemonstrated.includes(s)) newDemonstrated.push(s);
      });

      const newWeakAreas = [...(currentMastery.weakAreas || [])];
      (evaluation.weaknesses || []).forEach((w) => {
        if (!newWeakAreas.includes(w)) newWeakAreas.push(w);
      });

      currentMastery.currentLevel = newLevel;
      currentMastery.averageScore = newAverage;
      currentMastery.attempts = newAttempts;
      currentMastery.trend = trend;
      currentMastery.demonstrated = newDemonstrated;
      currentMastery.weakAreas = newWeakAreas;
      currentMastery.lastTested = new Date();
    }

    masteryMap.set(safeTopic, currentMastery);

    // Update topicPlan entry in the interview document
    if (interview) {
      const planEntry = interview.topicPlan.find(
        (e) => normalizeTopic(e.topic) === normalizeTopic(topic)
      );
      if (planEntry) {
        planEntry.timesAsked = (planEntry.timesAsked || 0) + 1;
        planEntry.isWeak = averageScore <= 5;
        if (subtopic && !planEntry.subtopicsTested.includes(subtopic)) {
          planEntry.subtopicsTested.push(subtopic);
        }
      }
    }
  }

  if (mode === "TECHNICAL" || mode === "Technical") {
    resume.markModified("technicalMastery");
  } else {
    resume.markModified("hrMastery");
  }

  await resume.save();
};

// ─── Compact History Builder ─────────────────────────────────────────────────

/**
 * Build a concise summary of past interviews for a resume.
 * Lists question texts and topics only — keeps prompt size bounded.
 *
 * @param {Object[]} pastInterviews - Array of completed interview docs
 * @returns {string}
 */
export const buildCompactHistory = (pastInterviews) => {
  if (!pastInterviews || pastInterviews.length === 0) return "";

  let history = "";
  pastInterviews.forEach((interview, index) => {
    history += `\n--- Past Interview ${index + 1} (${new Date(interview.createdAt).toLocaleDateString()}) ---\n`;
    history += `Overall Strengths: ${interview.strengths?.join(", ") || "None"}\n`;
    history += `Overall Weaknesses: ${interview.weaknesses?.join(", ") || "None"}\n`;
    history += `Questions Asked:\n`;
    interview.questions.forEach((q) => {
      history += `  - [Topic: ${q.topic || "Unknown"}, Subtopic: ${q.subtopic || "—"}, Diff: ${q.difficulty}] ${q.questionText}\n`;
    });
  });
  return history;
};

// ─── Legacy selectTopic (kept for backward compatibility) ────────────────────
// This is used by the HR flow only now; technical flow uses selectNextTopic().

export const selectTopic = (resume, masteryMap, stage, previousQuestions, mode) => {
  const isHR = mode === "HR" || mode === "Hr" || mode === "hr";
  const askedTopics = previousQuestions.map((q) => normalizeTopic(q.topic)).filter(Boolean);

  if (isHR) {
    const unaskedHr = HR_TOPICS.filter((t) => !askedTopics.includes(normalizeTopic(t)));
    if (unaskedHr.length > 0) return unaskedHr[0];
    return "Complex Behavioral Scenario";
  }

  const skills = resume.skills || [];
  const projects = resume.projects || [];
  const technicalTopics = [...projects, "Past Work Experience or Internships"];

  const unaskedSkills = skills.filter((s) => !askedTopics.includes(normalizeTopic(s)));
  const unaskedProjects = technicalTopics.filter((p) => !askedTopics.includes(normalizeTopic(p)));

  if (stage === "Foundation") {
    if (unaskedSkills.length > 0) return unaskedSkills[0];
    return skills[0] || "General Technical Concepts";
  }

  const mix = [...unaskedSkills, ...unaskedProjects];
  if (mix.length > 0) return mix[0];
  return "General Technical Concepts";
};
