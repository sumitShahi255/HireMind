/**
 * interviewPlanner.test.js
 *
 * Unit tests for interviewPlanner.service.js
 * Run with: node --experimental-vm-modules server/tests/interviewPlanner.test.js
 * Or with Jest if configured.
 *
 * Tests cover:
 *  - buildTopicPlan: rotation, deduplication, cross-interview ordering
 *  - selectNextTopic: coverage priority, weak-topic revision, deep-question fallback
 *  - decideFollowUp: max-1-consecutive, blank answer, I-don't-know, evaluator flag
 *  - updateResumeMastery: safe score averaging, null/missing handling
 *  - normalizeTopic: case and dot handling
 */

import {
  buildTopicPlan,
  selectNextTopic,
  decideFollowUp,
  updateResumeMastery,
  normalizeTopic,
  stripTopicPrefix,
  parseResumeSections,
  isTechnologySupported,
  getStage,
  getAdaptiveDifficulty,
} from "../services/interview/interviewPlanner.service.js";

import {
  topicMatches,
  validateQuestion,
} from "../services/interview/questionGenerator.service.js";

// ─── Minimal test harness ─────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
    failures.push({ name, error: err.message });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(arr, item, message) {
  if (!arr.includes(item)) {
    throw new Error(message || `Expected array to include ${JSON.stringify(item)}, got [${arr.join(", ")}]`);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeResume = (skills = [], projects = []) => ({
  skills,
  projects,
  technicalMastery: new Map(),
  hrMastery: new Map(),
});

const makeInterview = (topicPlan = [], questions = [], index = 0, consecutiveFollowUps = 0) => ({
  topicPlan,
  topicPlanIndex: index,
  consecutiveFollowUps,
  questions,
});

const makePlanEntry = (topic, timesAsked = 0, subtopicsTested = [], isWeak = false) => ({
  topic,
  timesAsked,
  subtopicsTested,
  isWeak,
});

// ─── normalizeTopic ────────────────────────────────────────────────────────────

console.log("\n[normalizeTopic]");

test("lowercases topic", () => {
  assertEqual(normalizeTopic("Java"), "java");
});

test("replaces dots with underscores", () => {
  assertEqual(normalizeTopic("Node.js"), "node_js");
});

test("handles empty string", () => {
  assertEqual(normalizeTopic(""), "");
});

test("handles null/undefined gracefully", () => {
  assertEqual(normalizeTopic(null), "");
  assertEqual(normalizeTopic(undefined), "");
});

test("trims whitespace", () => {
  assertEqual(normalizeTopic("  Spring Boot  "), "spring boot");
});

// ─── buildTopicPlan ────────────────────────────────────────────────────────────

console.log("\n[buildTopicPlan]");

test("builds plan from resume skills", () => {
  const resume = makeResume(["Java", "Spring Boot", "SQL"], []);
  const plan = buildTopicPlan(resume, "TECHNICAL", []);
  const topics = plan.map((e) => e.topic);
  assertIncludes(topics, "Java");
  assertIncludes(topics, "Spring Boot");
  assertIncludes(topics, "SQL");
});

test("includes project topics prefixed with 'Project:'", () => {
  const resume = makeResume(["Java"], ["E-Commerce App"]);
  const plan = buildTopicPlan(resume, "TECHNICAL", []);
  const topics = plan.map((e) => e.topic);
  assertIncludes(topics, "Project: E-Commerce App");
});

test("always appends 'Past Work Experience or Internships' for technical", () => {
  const resume = makeResume(["React"], []);
  const plan = buildTopicPlan(resume, "TECHNICAL", []);
  const topics = plan.map((e) => e.topic);
  assertIncludes(topics, "Past Work Experience or Internships");
});

test("de-duplicates topics (case-insensitive)", () => {
  const resume = makeResume(["java", "Java", "JAVA"], []);
  const plan = buildTopicPlan(resume, "TECHNICAL", []);
  const javaCount = plan.filter((e) => normalizeTopic(e.topic) === "java").length;
  assertEqual(javaCount, 1, "Should have exactly one java entry");
});

test("rotates — less-tested topic comes first", () => {
  const resume = makeResume(["Java", "Python", "SQL"], []);
  // Simulate previous history: Java asked 3 times, Python 1, SQL 0
  const previousInterviews = [
    { questions: [{ topic: "Java" }, { topic: "Java" }, { topic: "Python" }] },
    { questions: [{ topic: "Java" }] },
  ];
  const plan = buildTopicPlan(resume, "TECHNICAL", previousInterviews);
  // SQL (0 appearances) should come before Java (3 appearances)
  const sqlIdx = plan.findIndex((e) => normalizeTopic(e.topic) === "sql");
  const javaIdx = plan.findIndex((e) => normalizeTopic(e.topic) === "java");
  assert(sqlIdx < javaIdx, `SQL (idx ${sqlIdx}) should be before Java (idx ${javaIdx})`);
});

test("builds HR plan from HR_TOPICS list", () => {
  const resume = makeResume([], []);
  const plan = buildTopicPlan(resume, "HR", []);
  assert(plan.length > 0, "HR plan should not be empty");
  assert(plan.some((e) => e.topic.includes("Behavioral")), "HR plan should include behavioral topics");
});

test("handles empty resume gracefully", () => {
  const resume = makeResume([], []);
  const plan = buildTopicPlan(resume, "TECHNICAL", []);
  // Should at least have 'Past Work Experience or Internships'
  assert(plan.length >= 1, "Plan should have at least one entry");
});

// ─── selectNextTopic ───────────────────────────────────────────────────────────

console.log("\n[selectNextTopic]");

test("Phase 1: selects first uncovered topic", () => {
  const plan = [makePlanEntry("Java"), makePlanEntry("Spring Boot"), makePlanEntry("SQL")];
  const interview = makeInterview(plan, []); // no questions asked yet
  const result = selectNextTopic(interview, new Map());
  assertEqual(result.topic, "Java");
});

test("Phase 1: skips already-covered topics", () => {
  const plan = [makePlanEntry("Java"), makePlanEntry("Spring Boot"), makePlanEntry("SQL")];
  const interview = makeInterview(plan, [
    { topic: "Java", isFollowUp: false },
  ]);
  const result = selectNextTopic(interview, new Map());
  assertEqual(result.topic, "Spring Boot");
});

test("Phase 2: after all covered, picks weakest topic for revision", () => {
  const plan = [makePlanEntry("Java"), makePlanEntry("Spring Boot")];
  const masteryMap = new Map([
    ["java", { averageScore: 3, attempts: 2 }],
    ["spring boot", { averageScore: 7, attempts: 2 }],
  ]);
  const interview = makeInterview(plan, [
    { topic: "Java", isFollowUp: false },
    { topic: "Spring Boot", isFollowUp: false },
  ]);
  const result = selectNextTopic(interview, masteryMap);
  // Java has lower score (3 ≤ 5), should be selected for revision
  assertEqual(result.topic, "Java");
  assert(result.isRevision, "Should be marked as revision");
});

test("Phase 3: fallback to plan index when all covered and no weak topics", () => {
  const plan = [makePlanEntry("Java"), makePlanEntry("Spring Boot")];
  const masteryMap = new Map([
    ["java", { averageScore: 9, attempts: 3 }],
    ["spring boot", { averageScore: 8, attempts: 3 }],
  ]);
  const interview = makeInterview(plan, [
    { topic: "Java", isFollowUp: false },
    { topic: "Spring Boot", isFollowUp: false },
  ], 0);
  const result = selectNextTopic(interview, masteryMap);
  // Should return a topic (fallback, not revision)
  assert(result.topic, "Should return a topic in Phase 3");
  assert(!result.isRevision, "Phase 3 is not revision");
});

// ─── decideFollowUp ────────────────────────────────────────────────────────────

console.log("\n[decideFollowUp]");

test("allows follow-up when evaluator flags opportunity and answer is present", () => {
  const interview = makeInterview([], [], 0, 0);
  const eval_ = { followUpOpportunity: true, suggestedFollowUpAngle: "Ask for more details" };
  const result = decideFollowUp(interview, eval_, "I handled the conflict by mediating.");
  assert(result.isFollowUp, "Should allow follow-up");
  assertEqual(result.followUpAngle, "Ask for more details");
});

test("blocks second consecutive follow-up", () => {
  const interview = makeInterview([], [], 0, 1); // already 1 consecutive follow-up
  const eval_ = { followUpOpportunity: true, suggestedFollowUpAngle: "Probe further" };
  const result = decideFollowUp(interview, eval_, "Some answer here");
  assert(!result.isFollowUp, "Should block second consecutive follow-up");
});

test("does not follow up on blank answer", () => {
  const interview = makeInterview([], [], 0, 0);
  const eval_ = { followUpOpportunity: true, suggestedFollowUpAngle: "Ask again" };
  const result = decideFollowUp(interview, eval_, "");
  assert(!result.isFollowUp, "Should not follow up on blank answer");
});

test("does not follow up on 'I don't know'", () => {
  const interview = makeInterview([], [], 0, 0);
  const eval_ = { followUpOpportunity: true, suggestedFollowUpAngle: "Rephrase" };
  const result = decideFollowUp(interview, eval_, "I don't know");
  assert(!result.isFollowUp, "Should not follow up on 'I don't know'");
});

test("does not follow up when evaluator does not flag opportunity", () => {
  const interview = makeInterview([], [], 0, 0);
  const eval_ = { followUpOpportunity: false, suggestedFollowUpAngle: "" };
  const result = decideFollowUp(interview, eval_, "Here is my answer about java.");
  assert(!result.isFollowUp, "Should not follow up when evaluator says no");
});

test("does not follow up on 'skip' keyword", () => {
  const interview = makeInterview([], [], 0, 0);
  const eval_ = { followUpOpportunity: true, suggestedFollowUpAngle: "Rephrase" };
  const result = decideFollowUp(interview, eval_, "skip");
  assert(!result.isFollowUp, "Should not follow up on skip");
});

// ─── updateResumeMastery ───────────────────────────────────────────────────────

console.log("\n[updateResumeMastery]");

// We test the pure computation logic without actually calling resume.save()
// by using a mock resume object

function makeMockResume(mode) {
  const map = new Map();
  return {
    technicalMastery: mode === "TECHNICAL" ? map : new Map(),
    hrMastery: mode === "HR" ? map : new Map(),
    markModified: () => {},
    save: async () => {},
  };
}

function extractMastery(resume, mode, topic) {
  const safeTopic = normalizeTopic(topic).replace(/\//g, "_");
  const map = mode === "TECHNICAL" ? resume.technicalMastery : resume.hrMastery;
  return map.get(safeTopic);
}

test("creates new mastery entry on first attempt", async () => {
  const resume = makeMockResume("TECHNICAL");
  const eval_ = { confidence: 7, communication: 8, correctness: 6, strengths: ["good"], weaknesses: [] };
  await updateResumeMastery(resume, "TECHNICAL", "Java", "Collections", eval_, null);
  const mastery = extractMastery(resume, "TECHNICAL", "Java");
  assert(mastery, "Mastery entry should exist");
  assertEqual(mastery.attempts, 1);
  assert(mastery.averageScore > 0, "averageScore should be positive");
});

test("accumulates average score correctly across attempts", async () => {
  const resume = makeMockResume("TECHNICAL");
  const eval1 = { confidence: 6, communication: 6, correctness: 6, strengths: [], weaknesses: [] };
  const eval2 = { confidence: 9, communication: 9, correctness: 9, strengths: [], weaknesses: [] };
  await updateResumeMastery(resume, "TECHNICAL", "Java", "Collections", eval1, null);
  await updateResumeMastery(resume, "TECHNICAL", "Java", "Threading", eval2, null);
  const mastery = extractMastery(resume, "TECHNICAL", "Java");
  assertEqual(mastery.attempts, 2);
  // Average of 6 and 9 = 7.5
  assert(Math.abs(mastery.averageScore - 7.5) < 0.01, `Expected 7.5, got ${mastery.averageScore}`);
});

test("handles null/undefined score values without NaN", async () => {
  const resume = makeMockResume("TECHNICAL");
  const eval_ = { confidence: null, communication: undefined, correctness: null, strengths: [], weaknesses: [] };
  await updateResumeMastery(resume, "TECHNICAL", "Python", "Generators", eval_, null);
  const mastery = extractMastery(resume, "TECHNICAL", "Python");
  assert(!isNaN(mastery.averageScore), "averageScore should not be NaN");
  assertEqual(mastery.averageScore, 0, "All null scores should average to 0");
});

test("tracks weak areas from evaluation", async () => {
  const resume = makeMockResume("TECHNICAL");
  const eval_ = { confidence: 3, communication: 3, correctness: 2, strengths: [], weaknesses: ["mocking", "assertions"] };
  await updateResumeMastery(resume, "TECHNICAL", "Unit Testing", "JUnit", eval_, null);
  const mastery = extractMastery(resume, "TECHNICAL", "Unit Testing");
  assertIncludes(mastery.weakAreas, "mocking");
  assertIncludes(mastery.weakAreas, "assertions");
});

test("updates topicPlan entry's subtopicsTested and isWeak", async () => {
  const resume = makeMockResume("TECHNICAL");
  const planEntry = makePlanEntry("SQL", 0, []);
  const interview = {
    topicPlan: [planEntry],
  };
  const eval_ = { confidence: 4, communication: 4, correctness: 3, strengths: [], weaknesses: [] };
  await updateResumeMastery(resume, "TECHNICAL", "SQL", "Joins", eval_, interview);
  assertIncludes(planEntry.subtopicsTested, "Joins");
  assert(planEntry.isWeak, "Topic should be marked weak (avg ≤ 5)");
});

// ─── Resume Grounding, Projects & Internship Influence Tests ─────────────────

console.log("\n[parseResumeSections & Grounding]");

const candidateResumeData = {
  skills: [
    "Java",
    "JavaScript",
    "DSA",
    "OOP",
    "DBMS",
    "React",
    "HTML",
    "CSS",
    "Bootstrap",
    "Node.js",
    "Express.js",
    "REST APIs",
    "MySQL",
    "MongoDB",
  ],
  projects: ["SmartHire.AI", "ResQVision"],
  resumeText: `Full Stack Engineer with strong foundations in Java, JavaScript, DSA, OOP, and DBMS.
Technical Skills: React, HTML, CSS, Bootstrap, Node.js, Express.js, REST APIs, MySQL, MongoDB.
Internship: MERN Stack Intern at CloudTech Labs.
Responsibilities: Built scalable RESTful micro-services, implemented Role-Based Access Control (RBAC) across protected endpoints.
Measurable Achievement: Performed database optimization with a claimed 30% performance improvement in query response latency.
Projects:
- SmartHire.AI: AI-driven applicant evaluation platform with real-time feedback and dynamic interview workflows using React and Express.
- ResQVision: Real-time emergency vision system built using Python, FastAPI, and Machine Learning (ML) models for disaster response and hazard detection.`,
};

test("parses candidate resume sections without inventing unsupported tech", () => {
  const sections = parseResumeSections(candidateResumeData);

  // 1. Fundamentals
  const fundTopics = sections.fundamentals.map((f) => f.topic);
  assertIncludes(fundTopics, "Java");
  assertIncludes(fundTopics, "JavaScript");
  assertIncludes(fundTopics, "DSA");
  assertIncludes(fundTopics, "OOP");
  assertIncludes(fundTopics, "DBMS");

  // 2. Practical
  const pracTopics = sections.practical.map((p) => p.topic);
  assertIncludes(pracTopics, "React");
  assertIncludes(pracTopics, "Node.js");
  assertIncludes(pracTopics, "Express.js");
  assertIncludes(pracTopics, "REST APIs");
  assertIncludes(pracTopics, "MongoDB");

  // 3. Projects
  const projTopics = sections.projects.map((p) => p.topic);
  assertIncludes(projTopics, "Project: SmartHire.AI");
  assertIncludes(projTopics, "Project: ResQVision");

  // 4. Internship & Experiences & Measurable Achievements
  const expTopics = sections.experiences.map((e) => e.topic);
  assert(expTopics.some((t) => t.includes("MERN Internship")), "Should include MERN Internship");
  assert(expTopics.some((t) => t.includes("Role-Based Access Control (RBAC)")), "Should include RBAC");
  assert(expTopics.some((t) => t.includes("30%")), "Should include 30% database optimization achievement");

  // 5. Scenarios
  const scenTopics = sections.scenarios.map((s) => s.topic);
  assert(scenTopics.some((t) => t.includes("Database Optimization")), "Should include Database Optimization scenario");
  assert(scenTopics.some((t) => t.includes("Secure API Design")), "Should include API Security / RBAC scenario");

  // 6. STRICT INTEGRITY: No unsupported technologies falsely attributed (truly absent technologies)
  const allParsedTopics = [
    ...fundTopics,
    ...pracTopics,
    ...projTopics,
    ...expTopics,
    ...scenTopics,
  ].map((t) => t.toLowerCase());

  const forbiddenTech = ["docker", "kubernetes", "aws", "kafka", "redis", "graphql", "c++", "ruby", "rust", "swift"];
  forbiddenTech.forEach((tech) => {
    assert(!allParsedTopics.some((t) => t.includes(tech)), `Should NOT falsely attribute unsupported technology: ${tech}`);
  });
});

test("does NOT invent internship or achievement when resume does not contain them", () => {
  const minimalResume = {
    skills: ["Java", "OOP", "SQL"],
    projects: ["SimpleCalculator"],
    resumeText: "Java developer with experience in OOP and SQL. Built SimpleCalculator.",
  };
  const sections = parseResumeSections(minimalResume);

  // Should NOT invent MERN internship or RBAC or 30% performance improvement
  const expTopics = sections.experiences.map((e) => e.topic);
  assert(!expTopics.some((t) => t.includes("MERN")), "Must NOT invent MERN internship");
  assert(!expTopics.some((t) => t.includes("RBAC")), "Must NOT invent RBAC");
  assert(!expTopics.some((t) => t.includes("30%")), "Must NOT invent 30% achievement");
});

// ─── Regression Tests for Project Technology Grounding ───────────────────────

console.log("\n[Regression Tests: ResQVision Technologies & Strict Grounding]");

test("regression 1: Python, FastAPI, and ML are recognized from ResQVision", () => {
  const sections = parseResumeSections(candidateResumeData);
  const resqEntry = sections.projects.find((p) => p.topic.includes("ResQVision"));

  assert(resqEntry, "ResQVision project entry must exist");
  assertIncludes(resqEntry.technologies, "Python", "Python must be associated with ResQVision");
  assertIncludes(resqEntry.technologies, "FastAPI", "FastAPI must be associated with ResQVision");
  assertIncludes(resqEntry.technologies, "ML", "ML must be associated with ResQVision");

  // Verify they are classified as supported technologies
  assert(isTechnologySupported("Python", candidateResumeData), "Python must be recognized as supported from resume");
  assert(isTechnologySupported("FastAPI", candidateResumeData), "FastAPI must be recognized as supported from resume");
  assert(isTechnologySupported("ML", candidateResumeData), "ML must be recognized as supported from resume");
  assert(isTechnologySupported("Machine Learning", candidateResumeData), "Machine Learning must be recognized as supported");
});

test("regression 2: Questions can be grounded in the actual ResQVision project description", () => {
  const sections = parseResumeSections(candidateResumeData);
  const resqEntry = sections.projects.find((p) => p.topic.includes("ResQVision"));

  // 1. Context verification
  assert(resqEntry.context.includes("Python"), "Context must include Python");
  assert(resqEntry.context.includes("FastAPI"), "Context must include FastAPI");
  assert(resqEntry.context.includes("Machine Learning") || resqEntry.context.includes("ML"), "Context must include ML");

  // 2. Topic matching
  assert(topicMatches("Project: ResQVision", "ResQVision"), "Project prefix topic must match ResQVision");
  assert(topicMatches("ResQVision", "Project: ResQVision"), "ResQVision must match Project: ResQVision");

  // 3. Question validation on grounded ResQVision question
  const validResQQuestion = {
    questionText: "In your ResQVision project, how did you structure your FastAPI endpoints to serve predictions from your ML models in real time?",
    topic: "Project: ResQVision",
    subtopic: "FastAPI ML Serving",
    category: "REAL_WORLD",
    difficulty: 3,
    reason: "Assessing real-time inference pipeline in FastAPI as described in candidate's project",
  };
  validateQuestion(validResQQuestion, "Project: ResQVision");

  // 4. Foundational difficulty enforcement (no advanced assumption)
  // When starting or exploring, difficulty begins at foundational/practical level (not level 5)
  const baseDiff = getAdaptiveDifficulty(null, "Practical Application");
  assertEqual(baseDiff, 2, "New practical/project questions must start at foundational difficulty 2, not advanced 5");
});

test("regression 3: Technologies genuinely absent from a resume are not falsely attributed to the candidate", () => {
  const genuinelyAbsentTech = [
    "Docker",
    "Kubernetes",
    "AWS",
    "Kafka",
    "GraphQL",
    "Ruby",
    "C++",
    "Rust",
    "Swift",
    "Golang",
  ];

  genuinelyAbsentTech.forEach((tech) => {
    assert(!isTechnologySupported(tech, candidateResumeData), `Technology "${tech}" must NOT be supported for this candidate`);
  });

  const sections = parseResumeSections(candidateResumeData);
  const allTopicNames = [
    ...sections.fundamentals.map((f) => f.topic),
    ...sections.practical.map((p) => p.topic),
    ...sections.experiences.map((e) => e.topic),
    ...sections.projects.map((pr) => pr.topic),
    ...sections.scenarios.map((s) => s.topic),
  ].map((t) => t.toLowerCase());

  genuinelyAbsentTech.forEach((tech) => {
    const tLower = tech.toLowerCase();
    assert(!allTopicNames.some((t) => t.includes(tLower)), `Absent tech "${tech}" must not appear in any topic name`);
  });
});

console.log("\n[Resume Projects & Internship Influence on Topic Plan]");

test("proves resume projects and internship experience are actively planned in early/mid slots (not starved by 14 skills)", () => {
  const plan = buildTopicPlan(candidateResumeData, "TECHNICAL", []);
  const planTopics = plan.map((p) => p.topic);

  // Verify plan has projects and experiences
  const projectEntries = plan.filter((p) => p.category === "resume_project");
  const expEntries = plan.filter((p) => p.category === "resume_experience");

  assert(projectEntries.length >= 2, "Plan must contain candidate resume projects");
  assert(expEntries.length >= 2, "Plan must contain internship / measurable achievement entries");

  // Verify that an interview of 8 questions covers fundamentals, practical, experience, projects, and scenarios
  const first8Topics = plan.slice(0, 8);
  const first8Categories = first8Topics.map((p) => p.category);

  assertIncludes(first8Categories, "core_fundamental", "First 8 questions must include core fundamentals");
  assertIncludes(first8Categories, "practical_implementation", "First 8 questions must include practical implementation");
  assertIncludes(first8Categories, "resume_experience", "First 8 questions must include resume experience/internship");
  assertIncludes(first8Categories, "resume_project", "First 8 questions must include resume projects");
  assertIncludes(first8Categories, "problem_solving", "First 8 questions must include a problem-solving scenario");

  // Proves that SmartHire.AI or ResQVision is reached in first 7 questions
  const projectIndices = planTopics
    .map((t, idx) => (t.includes("SmartHire.AI") || t.includes("ResQVision") ? idx : -1))
    .filter((idx) => idx !== -1);
  assert(projectIndices.length > 0 && Math.min(...projectIndices) < 7, "Project must appear within first 7 questions, not buried after all 14 skills");

  // Proves that MERN Internship appears in first 7 questions
  const mernIdx = planTopics.findIndex((t) => t.includes("MERN Internship"));
  assert(mernIdx !== -1 && mernIdx < 7, `MERN internship must appear within first 7 questions (found at idx ${mernIdx})`);
});

test("selectNextTopic progresses through balanced resume sections during an interview", () => {
  const plan = buildTopicPlan(candidateResumeData, "TECHNICAL", []);
  const interview = makeInterview(plan, [], 0, 0);

  // Q1: Foundation (Core Fundamental)
  const q1 = selectNextTopic(interview, new Map());
  assertEqual(q1.category, "core_fundamental");
  interview.questions.push({ questionId: "q1", topic: q1.topic, assignedTopic: q1.topic, isFollowUp: false });

  // Q2: Foundation (Core Fundamental)
  const q2 = selectNextTopic(interview, new Map());
  assertEqual(q2.category, "core_fundamental");
  interview.questions.push({ questionId: "q2", topic: q2.topic, assignedTopic: q2.topic, isFollowUp: false });

  // Q3: Practical Application
  const q3 = selectNextTopic(interview, new Map());
  assertEqual(q3.category, "practical_implementation");
  interview.questions.push({ questionId: "q3", topic: q3.topic, assignedTopic: q3.topic, isFollowUp: false });

  // Q4: Practical Application
  const q4 = selectNextTopic(interview, new Map());
  assertEqual(q4.category, "practical_implementation");
  interview.questions.push({ questionId: "q4", topic: q4.topic, assignedTopic: q4.topic, isFollowUp: false });

  // Q5: Experience / Measurable Achievement
  const q5 = selectNextTopic(interview, new Map());
  assertEqual(q5.category, "resume_experience");
  assert(q5.topic.includes("MERN Internship") || q5.topic.includes("30%"), "Q5 should test internship or achievement");
  interview.questions.push({ questionId: "q5", topic: q5.topic, assignedTopic: q5.topic, isFollowUp: false });

  // Q6: Project Deep Dive
  const q6 = selectNextTopic(interview, new Map());
  assertEqual(q6.category, "resume_project");
  assert(q6.topic.includes("Project:"), "Q6 should test a resume project");
  interview.questions.push({ questionId: "q6", topic: q6.topic, assignedTopic: q6.topic, isFollowUp: false });
});

console.log("\n[Cross-Interview Prioritization of Under-Tested Topics]");

test("prioritizes under-tested fundamentals, practical skills, projects, and achievements in subsequent interview", () => {
  // Simulate Interview 1 having asked:
  // Java, JavaScript, React, HTML, Experience: MERN Internship, Project: SmartHire.AI, Project: ResQVision, Scenario: Database Optimization & Query Performance
  const interview1 = {
    questions: [
      { topic: "Java", assignedTopic: "Java" },
      { topic: "JavaScript", assignedTopic: "JavaScript" },
      { topic: "React", assignedTopic: "React" },
      { topic: "HTML", assignedTopic: "HTML" },
      { topic: "Experience: MERN Internship", assignedTopic: "Experience: MERN Internship" },
      { topic: "Project: SmartHire.AI", assignedTopic: "Project: SmartHire.AI" },
      { topic: "Project: ResQVision", assignedTopic: "Project: ResQVision" },
      { topic: "Scenario: Database Optimization & Query Performance", assignedTopic: "Scenario: Database Optimization & Query Performance" },
    ],
  };

  const plan2 = buildTopicPlan(candidateResumeData, "TECHNICAL", [interview1]);
  const plan2Topics = plan2.map((p) => p.topic);

  // In Interview 2, untested fundamentals (DSA, OOP, DBMS) should come before tested Java & JavaScript
  const dsaIdx = plan2Topics.findIndex((t) => normalizeTopic(t) === "dsa");
  const oopIdx = plan2Topics.findIndex((t) => normalizeTopic(t) === "oop");
  const javaIdx = plan2Topics.findIndex((t) => normalizeTopic(t) === "java");
  assert(dsaIdx !== -1 && dsaIdx < javaIdx, `DSA (idx ${dsaIdx}) should be prioritized before previously tested Java (idx ${javaIdx})`);
  assert(oopIdx !== -1 && oopIdx < javaIdx, `OOP (idx ${oopIdx}) should be prioritized before previously tested Java (idx ${javaIdx})`);

  // Untested practical skills (Node.js, Express.js, REST APIs, MongoDB) should come before tested React & HTML
  const nodeIdx = plan2Topics.findIndex((t) => normalizeTopic(t) === "node_js");
  const reactIdx = plan2Topics.findIndex((t) => normalizeTopic(t) === "react");
  assert(nodeIdx !== -1 && nodeIdx < reactIdx, `Node.js (idx ${nodeIdx}) should be prioritized before previously tested React (idx ${reactIdx})`);

  // Untested experience / achievements (RBAC or 30% optimization) should come before previously tested MERN internship
  const rbacIdx = plan2Topics.findIndex((t) => t.includes("RBAC"));
  const mernIdx = plan2Topics.findIndex((t) => t.includes("MERN Internship"));
  assert(rbacIdx !== -1 && rbacIdx < mernIdx, `RBAC (idx ${rbacIdx}) should be prioritized before previously tested MERN Internship (idx ${mernIdx})`);
});

console.log("\n[Foundational Questions First & Adaptive Difficulty]");

test("difficulty starts at foundational level 1 and scales adaptively", () => {
  // Topic with no prior attempts starts at 1 in Foundation stage
  const diffQ1 = getAdaptiveDifficulty(null, "Foundation");
  assertEqual(diffQ1, 1, "New topic in Foundation stage must be difficulty 1");

  // Topic with no prior attempts in Practical Application stage starts at 2
  const diffQ3 = getAdaptiveDifficulty(null, "Practical Application");
  assertEqual(diffQ3, 2, "New topic in Practical stage must be difficulty 2");

  // Topic with high mastery (level 3) in Challenge stage scales to 4
  const highMastery = { currentLevel: 3, attempts: 3, averageScore: 8.5 };
  const diffChallenge = getAdaptiveDifficulty(highMastery, "Challenge");
  assertEqual(diffChallenge, 4, "High mastery in Challenge stage scales up");

  // Stages correctly map question numbers
  assertEqual(getStage(1), "Foundation");
  assertEqual(getStage(2), "Foundation");
  assertEqual(getStage(3), "Practical Application");
  assertEqual(getStage(5), "Practical Application");
  assertEqual(getStage(6), "Deep Dive");
  assertEqual(getStage(8), "Deep Dive");
  assertEqual(getStage(9), "Challenge");
});

console.log("\n[Question Validation & Precise Topic Matching]");

test("topicMatches strictly matches topics and prevents false substring matches", () => {
  // Exact match
  assert(topicMatches("Java", "Java"), "Java should match Java");
  assert(topicMatches("Node.js", "node_js"), "Node.js should match node_js");

  // Prefix stripped match
  assert(topicMatches("Project: SmartHire.AI", "SmartHire.AI"), "Project: SmartHire.AI should match SmartHire.AI");
  assert(topicMatches("SmartHire.AI", "Project: SmartHire.AI"), "SmartHire.AI should match Project: SmartHire.AI");
  assert(topicMatches("Experience: MERN Internship", "MERN Internship"), "Experience: MERN Internship should match MERN Internship");
  assert(topicMatches("Achievement: Database Optimization (30% Improvement)", "Database Optimization"), "Achievement topic should match Database Optimization");

  // CRITICAL INTEGRITY: Prevent false keyword substring matches
  assert(!topicMatches("JavaScript", "Java"), "JavaScript must NOT match Java");
  assert(!topicMatches("Java", "JavaScript"), "Java must NOT match JavaScript");
  assert(!topicMatches("CSS", "C"), "CSS must NOT match C");
  assert(!topicMatches("C", "CSS"), "C must NOT match CSS");
});

test("validateQuestion enforces valid topic, difficulty, and question length", () => {
  // Valid question
  validateQuestion(
    {
      questionText: "What are the core differences between an abstract class and an interface in Java?",
      topic: "Java",
      difficulty: 1,
    },
    "Java"
  );

  // Mismatched topic should throw
  let threwMismatch = false;
  try {
    validateQuestion(
      {
        questionText: "How do you handle asynchronous promises in JavaScript?",
        topic: "JavaScript",
        difficulty: 1,
      },
      "Java"
    );
  } catch (err) {
    threwMismatch = true;
  }
  assert(threwMismatch, "validateQuestion must reject topic mismatch");

  // Banned topic should throw
  let threwBanned = false;
  try {
    validateQuestion(
      {
        questionText: "Explain how React state works and how re-renders are triggered.",
        topic: "React",
        difficulty: 2,
      },
      "React",
      ["React"]
    );
  } catch (err) {
    threwBanned = true;
  }
  assert(threwBanned, "validateQuestion must reject banned topic");
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.error("\nFailed tests:");
  failures.forEach((f) => console.error(`  ✗ ${f.name}: ${f.error}`));
  process.exit(1);
} else {
  console.log("All tests passed! ✓");
  process.exit(0);
}
