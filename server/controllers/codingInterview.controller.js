import CodingInterview from "../models/codingInterview.model.js";
import QuestionBank from "../models/questionBank.model.js";
import User from "../models/user.model.js";
import QuestionUsage from "../models/questionUsage.model.js";
import vm from "node:vm";
import axios from "axios";
import crypto from "crypto";
import { askAi } from "../services/groq.service.js";

import { COMPANIES_DSA_METADATA, COMPANY_TOPIC_WEIGHTS } from "../utils/dsaMetadata.js";
import { getEffectiveLanguage, wrapCodeForExecution, normalize, normalizeOutput, parseInputAssignments } from "../utils/codeWrapper/index.js";
import {
  getCodeTemplateForLanguage,
  isDuplicateQuestion,
  getQuestionHash,
  validateCompanyTopic,
  parseAiJson,
  normalizeTitle
} from "../utils/dsaHelpers.js";
import { getJudge0Providers, executeOnJudge0, executeBatchOnJudge0 } from "../utils/judge0.js";

const getTemplateLanguageKey = (language) => {
  const lang = (language || "").toLowerCase();
  if (lang.includes("c++") || lang.includes("cpp")) return "cpp";
  if (lang.includes("javascript") || lang.includes("node") || lang.includes("js")) return "javascript";
  if (lang.includes("python")) return "python";
  if (lang.includes("java")) return "java";
  if (lang === "c") return "c";
  return "python";
};

export const startCodingInterview = async (req, res) => {
  try {
    const { company, language, difficulty, roundType, userName } = req.body;
    const targetRound = roundType || "General";

    if (!company || !language || !difficulty) {
      return res.status(400).json({ message: "Company, language, and difficulty are required" });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.credits < 50) {
      return res.status(403).json({ message: "Not enough credits. Minimum 50 required." });
    }

    // Get used question details for this user to avoid any duplicates (including variants)
    const usedUsages = await QuestionUsage.find({ userId: user._id })
      .populate("questionId");

    const usedHashes = new Set(usedUsages.map(u => u.questionHash).filter(Boolean));
    const usedTitles = new Set(
      usedUsages.map(u => u.questionTitle ? normalizeTitle(u.questionTitle) : (u.questionId ? normalizeTitle(u.questionId.title) : "")).filter(Boolean)
    );

    const companyMetadata = COMPANIES_DSA_METADATA[company];
    const allowedTopics = companyMetadata?.focusTopics || [];

    // Query active questions of specified difficulty
    const dbQuestions = await QuestionBank.find({
      difficulty: { $regex: new RegExp(`^${difficulty}$`, "i") },
      active: true
    });
    // Group candidate questions by topic to check exhaustion per topic
    const questionsByTopic = {};
    dbQuestions.forEach(q => {
      if (allowedTopics.length === 0 || validateCompanyTopic(q.topic, allowedTopics)) {
        if (!questionsByTopic[q.topic]) {
          questionsByTopic[q.topic] = [];
        }
        questionsByTopic[q.topic].push(q);
      }
    });


    // Check exhaustion and warn. Deletion is bypassed; we instead fallback to LRU recycling.

    // Now construct the final pool of allowed questions with updated used sets
    let filteredQuestions = dbQuestions.filter((q) => {
      if (allowedTopics.length > 0 && !validateCompanyTopic(q.topic, allowedTopics)) {
        return false;
      }
      const qHash = q.questionHash || getQuestionHash(q.title, q.topic, q.difficulty);
      if (usedHashes.has(qHash)) return false;

      const normTitle = normalizeTitle(q.title);
      if (usedTitles.has(normTitle)) return false;

      return true;
    });

    // Determine weights mapping
    const companyWeights = COMPANY_TOPIC_WEIGHTS[company] || COMPANY_TOPIC_WEIGHTS.Default;

    // Proper Fisher-Yates shuffle first
    for (let i = filteredQuestions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [filteredQuestions[i], filteredQuestions[j]] = [filteredQuestions[j], filteredQuestions[i]];
    }

    // Weighted random topic selection
    const availableTopicsSet = new Set(filteredQuestions.map(q => q.topic).filter(Boolean));
    let availableTopics = Array.from(availableTopicsSet).map(topic => ({
      topic,
      weight: companyWeights[topic] || COMPANY_TOPIC_WEIGHTS.Default[topic] || 1
    }));

    const chosenTopics = [];
    while (chosenTopics.length < 3 && availableTopics.length > 0) {
      const totalWeight = availableTopics.reduce((sum, t) => sum + t.weight, 0);
      let r = Math.random() * totalWeight;
      let selectedIdx = -1;
      for (let i = 0; i < availableTopics.length; i++) {
        r -= availableTopics[i].weight;
        if (r <= 0) {
          selectedIdx = i;
          break;
        }
      }
      if (selectedIdx === -1) selectedIdx = availableTopics.length - 1;
      
      chosenTopics.push(availableTopics[selectedIdx].topic);
      availableTopics.splice(selectedIdx, 1);
    }

    // Sort filteredQuestions so chosen topics are prioritized
    filteredQuestions = filteredQuestions.sort((a, b) => {
      const idxA = chosenTopics.indexOf(a.topic);
      const idxB = chosenTopics.indexOf(b.topic);
      
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      
      return 0; // Pre-shuffle order is preserved
    });

    // Select 3 questions ensuring uniqueness by title, pattern, and topic within this interview
    let selected = [];
    const currentBatchTitles = [];
    const currentBatchPatterns = [];
    const currentBatchAlgos = [];
    const currentBatchTopics = [];

    const selectFromPool = (pool, enforceUniqueTopic = true) => {
      for (const q of pool) {
        if (selected.length === 3) break;
        // Skip if already selected in this specific batch
        if (selected.some(sel => sel._id.toString() === q._id.toString())) continue;

        const isDup = isDuplicateQuestion(
          q.title,
          q.pattern,
          q.topic,
          q.coreAlgorithm,
          currentBatchTitles,
          currentBatchPatterns,
          [],
          currentBatchAlgos
        );
        
        let topicDup = false;
        if (enforceUniqueTopic && q.topic) {
          const normTopic = normalizeTitle(q.topic);
          topicDup = currentBatchTopics.some(t => {
            const normExisting = normalizeTitle(t);
            return normTopic === normExisting || normTopic.includes(normExisting) || normExisting.includes(normTopic);
          });
        }

        if (!isDup && !topicDup) {
          selected.push(q);
          currentBatchTitles.push(normalizeTitle(q.title));
          if (q.pattern) currentBatchPatterns.push(normalizeTitle(q.pattern));
          if (q.coreAlgorithm) currentBatchAlgos.push(normalizeTitle(q.coreAlgorithm));
          if (q.topic) currentBatchTopics.push(normalizeTitle(q.topic));
        }
      }
    };

    // Select questions (prioritize unique topics)
    selectFromPool(filteredQuestions, true);
    if (selected.length < 3) {
      // Relax unique topic constraint if we couldn't find 3
      selectFromPool(filteredQuestions, false);
    }

    // If we have fewer than 3 questions, it means the unused pool for this company + difficulty is exhausted.
    // We will recycle questions (least recently used) WITHOUT deleting the history.
    if (selected.length < 3) {
      console.log(`Pool exhausted for ${company} + ${difficulty}. Entering recycling mode.`);

      // Get all questions matching difficulty and company/topics
      const allEligibleQuestions = dbQuestions.filter((q) => {
        if (allowedTopics.length > 0 && !validateCompanyTopic(q.topic, allowedTopics)) {
          return false;
        }
        return true;
      });

      // For each eligible question, find the last time it was used by this user
      const questionLastUsedMap = {};
      usedUsages.forEach((usage) => {
        const keyHash = usage.questionHash;
        const keyTitle = usage.questionTitle ? normalizeTitle(usage.questionTitle) : (usage.questionId ? normalizeTitle(usage.questionId.title) : "");
        const usedTime = usage.usedAt ? new Date(usage.usedAt).getTime() : 0;

        if (keyHash) {
          if (!questionLastUsedMap[keyHash] || usedTime > questionLastUsedMap[keyHash]) {
            questionLastUsedMap[keyHash] = usedTime;
          }
        }
        if (keyTitle) {
          if (!questionLastUsedMap[keyTitle] || usedTime > questionLastUsedMap[keyTitle]) {
            questionLastUsedMap[keyTitle] = usedTime;
          }
        }
      });

      // Proper Fisher-Yates shuffle for recycling phase
      for (let i = allEligibleQuestions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allEligibleQuestions[i], allEligibleQuestions[j]] = [allEligibleQuestions[j], allEligibleQuestions[i]];
      }

      // Weighted random topic selection for recycling phase
      const fallbackTopicsSet = new Set(allEligibleQuestions.map(q => q.topic).filter(Boolean));
      let fallbackAvailableTopics = Array.from(fallbackTopicsSet).map(topic => ({
        topic,
        weight: companyWeights[topic] || COMPANY_TOPIC_WEIGHTS.Default[topic] || 1
      }));

      const fallbackChosenTopics = [];
      while (fallbackChosenTopics.length < 3 && fallbackAvailableTopics.length > 0) {
        const totalWeight = fallbackAvailableTopics.reduce((sum, t) => sum + t.weight, 0);
        let r = Math.random() * totalWeight;
        let selectedIdx = -1;
        for (let i = 0; i < fallbackAvailableTopics.length; i++) {
          r -= fallbackAvailableTopics[i].weight;
          if (r <= 0) {
            selectedIdx = i;
            break;
          }
        }
        if (selectedIdx === -1) selectedIdx = fallbackAvailableTopics.length - 1;
        
        fallbackChosenTopics.push(fallbackAvailableTopics[selectedIdx].topic);
        fallbackAvailableTopics.splice(selectedIdx, 1);
      }

      // Sort questions:
      // 1. Never used questions first (lastUsed = 0)
      // 2. Used questions sorted by last used time (ascending -> least recently used first)
      allEligibleQuestions.sort((a, b) => {
        const aHash = a.questionHash || getQuestionHash(a.title, a.topic, a.difficulty);
        const aTitle = normalizeTitle(a.title);
        const aTime = Math.max(questionLastUsedMap[aHash] || 0, questionLastUsedMap[aTitle] || 0);

        const bHash = b.questionHash || getQuestionHash(b.title, b.topic, b.difficulty);
        const bTitle = normalizeTitle(b.title);
        const bTime = Math.max(questionLastUsedMap[bHash] || 0, questionLastUsedMap[bTitle] || 0);

        if (aTime !== bTime) {
          return aTime - bTime;
        }

        // Tie-breaker: weighted random chosen topics
        const idxA = fallbackChosenTopics.indexOf(a.topic);
        const idxB = fallbackChosenTopics.indexOf(b.topic);
        
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;

        return 0; // Pre-shuffle order is preserved
      });

      // Clear the current batch selections to start fresh
      selected = [];
      currentBatchTitles.length = 0;
      currentBatchPatterns.length = 0;
      currentBatchAlgos.length = 0;
      currentBatchTopics.length = 0;

      selectFromPool(allEligibleQuestions, true);
      if (selected.length < 3) {
        selectFromPool(allEligibleQuestions, false);
      }
    }

    // Ultimate Fallback if we still don't have 3 questions (database itself doesn't have 3 questions for this difficulty)
    if (selected.length < 3) {
      let tier4Pool = await QuestionBank.find({
        difficulty: { $regex: new RegExp(`^${difficulty}$`, "i") },
        active: true
      });
      tier4Pool = tier4Pool.sort(() => Math.random() - 0.5);
      selectFromPool(tier4Pool, true);
      if (selected.length < 3) {
        selectFromPool(tier4Pool, false);
      }
    }



    // If still less than 3 questions, return 400
    if (selected.length < 3) {
      return res.status(400).json({ message: "Not enough questions in database matching requested difficulty" });
    }

    // Map selected questions to frontend expected schema
    const questionsMapped = selected.map((q) => {
      const sigObj = q.functionSignature || {};
      const templateCache = q.codeTemplates || {};
      const getTemplate = (langKey, dsaLang) => templateCache[langKey] ? templateCache[langKey] : getCodeTemplateForLanguage(dsaLang, sigObj);

      const resolvedLangKey = getTemplateLanguageKey(language);
      const codeTemplate = getTemplate(resolvedLangKey, language);
      const codeTemplates = {
        cpp: getTemplate("cpp", "c++"),
        java: getTemplate("java", "java"),
        python: getTemplate("python", "python"),
        javascript: getTemplate("javascript", "javascript"),
        c: getTemplate("c", "c")
      };

      const testCases = q.testCases.map(tc => ({
        input: typeof tc.input === "object" ? JSON.stringify(tc.input) : String(tc.input ?? ""),
        expectedOutput: typeof tc.expectedOutput === "object" ? JSON.stringify(tc.expectedOutput) : String(tc.expectedOutput ?? ""),
        isHidden: !!tc.isHidden
      }));

      const visibleTestCases = testCases.filter(tc => !tc.isHidden);
      const hiddenTestCases = testCases.filter(tc => tc.isHidden);

      const examples = [
        ...q.examples.map(ex => ({
          input: typeof ex.input === "object" ? JSON.stringify(ex.input) : String(ex.input ?? ""),
          output: typeof ex.output === "object" ? JSON.stringify(ex.output) : String(ex.output ?? ""),
          explanation: ex.explanation || ""
        }))
      ];

      return {
        title: q.title,
        problemStatement: q.problemStatement,
        constraints: q.constraints,
        examples,
        expectedComplexity: q.expectedComplexity,
        functionSignature: q.functionSignature || {},
        codeTemplate,
        codeTemplates,
        checker: q.checker || { enabled: false, language: "javascript", version: 1, code: "" },
        testCases,
        visibleTestCases,
        hiddenTestCases,
        topic: q.topic,
        subtopic: q.subtopic,
        pattern: q.pattern,
        hash: q.hash,
        companyOrigin: company,
        coreAlgorithm: q.coreAlgorithm,
        qualityScore: q.qualityScore,
        leetcodeEquivalent: q.leetcodeEquivalent,
        roundType: q.roundType || targetRound,
        version: q.version || 1
      };
    });

    // Deduct user credits
    user.credits -= 50;
    await user.save();

    // Save Usage History
    await QuestionUsage.insertMany(
      selected.map((q) => ({
        userId: user._id,
        questionId: q._id,
        questionHash: q.questionHash || getQuestionHash(q.title, q.topic, q.difficulty),
        questionTitle: q.title,
        company,
        difficulty
      }))
    );

    // Update Usage Count
    await QuestionBank.updateMany({
      _id: {
        $in: selected.map(q => q._id)
      }
    }, {
      $inc: {
        usageCount: 1
      }
    });

    // Create Interview
    const codingInterview = await CodingInterview.create({
      userId: user._id,
      candidateName: userName || user?.name || "Candidate",
      company,
      language,
      difficulty,
      questions: questionsMapped,
      status: "Incompleted"
    });

    res.json({
      interviewId: codingInterview._id,
      creditsLeft: user.credits,
      company: codingInterview.company,
      language: codingInterview.language,
      difficulty: codingInterview.difficulty,
      questions: codingInterview.questions
    });

  } catch (error) {
    console.error("Start coding interview error:", error);
    res.status(500).json({ message: "Failed to generate coding interview" });
  }
};

export const runCode = async (req, res) => {
  try {
    const { code, language, input, question } = req.body;

    if (!code || !language) {
      return res.status(400).json({ message: "Code and language are required" });
    }

    const effectiveLang = getEffectiveLanguage(code, language);

    if (req.body.testCases && Array.isArray(req.body.testCases)) {
      const testCases = req.body.testCases;
      let runResults = [];
      const wrappedSubmissions = [];

      try {
        for (let i = 0; i < testCases.length; i++) {
          const tc = testCases[i];
          const wrappedCode = await wrapCodeForExecution(code, effectiveLang, tc.input, question || null);
          wrappedSubmissions.push({
            source_code: wrappedCode,
            language_id: getLanguageId(effectiveLang),
            stdin: tc.input || ""
          });
        }
        runResults = await executeBatchOnJudge0(wrappedSubmissions, effectiveLang);
      } catch (e) {
        console.error("Batch execution failed in runCode, falling back to sequential:", e);
        for (const tc of testCases) {
          try {
            const wrappedCode = await wrapCodeForExecution(code, effectiveLang, tc.input, question || null);
            const res = await executeOnJudge0(wrappedCode, effectiveLang, tc.input);
            runResults.push(res);
          } catch (seqError) {
            runResults.push({ stdout: "", stderr: "Execution failed or timed out", compile_output: "", exitCode: 1, runTime: 0, memory: 0, status: "Internal Error", passed: false });
          }
        }
      }

      const formattedResults = testCases.map((tc, idx) => {
        const res = runResults[idx] || {};
        let tcPassed = false;

        if (question && question.checker && question.checker.enabled && question.checker.code) {
          try {
            let userOutput;
            try { userOutput = JSON.parse(res.stdout); } catch { userOutput = (res.stdout || "").trim(); }
            const tcInput = parseInputAssignments(tc.input);
            const inputObj = {};
            const argsArray = [];
            tcInput.forEach((item, j) => {
              let parsedVal;
              try { parsedVal = JSON.parse(item.val); } catch { parsedVal = item.val; }
              inputObj[item.name || ("arg_" + j)] = parsedVal;
              argsArray.push(parsedVal);
            });
            const expectedOutputStr = (tc.expectedOutput || "").trim();
            let expectedOutput;
            try { expectedOutput = JSON.parse(expectedOutputStr); } catch { expectedOutput = expectedOutputStr; }
            const sandboxContext = { result: userOutput, options: { input: inputObj, args: argsArray, expectedOutput: expectedOutput, testCase: tc } };
            vm.createContext(sandboxContext);
            const script = new vm.Script("const checkerFn = " + question.checker.code + ";\ncheckerFn(result, options);");
            tcPassed = script.runInContext(sandboxContext) === true && res.exitCode === 0;
          } catch (e) {
            console.error("Custom VM checker error in runCode:", e);
            tcPassed = false;
          }
        } else {
          const normStdout = normalizeOutput(res.stdout);
          const normExpected = normalizeOutput(tc.expectedOutput);
          tcPassed = (normStdout === normExpected || (normStdout === 'null' && normExpected === '[]')) && res.exitCode === 0;
        }

        return {
          input: tc.input,
          expected: tc.expectedOutput,
          got: tcPassed ? tc.expectedOutput : (res.stdout || (res.stderr ? "ERROR" : "")),
          stderr: res.stderr || "",
          passed: tcPassed,
          isHidden: tc.isHidden
        };
      });

      return res.json({ results: formattedResults });
    }

    const wrappedCode = await wrapCodeForExecution(code, effectiveLang, input, question || null);
    const result = await executeOnJudge0(wrappedCode, effectiveLang, input);

    let checkerPassed = false;
    let hasCustomChecker = false;
    if (question && question.checker && question.checker.enabled && question.checker.code) {
      hasCustomChecker = true;
      try {
        let userOutput;
        try {
          userOutput = JSON.parse(result.stdout);
        } catch {
          userOutput = (result.stdout || "").trim();
        }

        const tcInput = parseInputAssignments(input);
        const inputObj = {};
        const argsArray = [];
        tcInput.forEach((item, idx) => {
          let parsedVal;
          try { parsedVal = JSON.parse(item.val); } catch { parsedVal = item.val; }
          inputObj[item.name || ("arg_" + idx)] = parsedVal;
          argsArray.push(parsedVal);
        });

        const tc = question.testCases ? question.testCases.find(t => t.input === input) : null;
        const expectedOutputStr = tc ? (tc.expectedOutput || "").trim() : "";
        let expectedOutput;
        try {
          expectedOutput = JSON.parse(expectedOutputStr);
        } catch {
          expectedOutput = expectedOutputStr;
        }

        const sandboxContext = {
          result: userOutput,
          options: {
            input: inputObj,
            args: argsArray,
            expectedOutput: expectedOutput,
            testCase: tc || { input }
          }
        };

        vm.createContext(sandboxContext);

        const script = new vm.Script("const checkerFn = " + question.checker.code + ";\ncheckerFn(result, options);");

        checkerPassed = script.runInContext(sandboxContext) === true && result.exitCode === 0;
      } catch (e) {
        console.error("Custom VM checker error in runCode:", e);
        checkerPassed = false;
      }
    }

    if (question) {
      const templateStr = String(question.codeTemplate || "");
      if (templateStr.includes('ListNode') || templateStr.includes('TreeNode')) {
        const tc = question.testCases ? question.testCases.find(t => t.input === input) : null;
        if (tc) {
          const normStdout = normalizeOutput(result.stdout);
          const normExpected = normalizeOutput(tc.expectedOutput);
          if (normStdout === 'null' && normExpected === '[]') {
            result.stdout = "[]\n";
          }
        }
      }
    }

    res.json({
      stdout: result.stdout,
      stderr: result.stderr || result.compile_output,
      exitCode: result.exitCode,
      runTime: result.runTime,
      memory: result.memory,
      status: result.status,
      checkerPassed,
      hasCustomChecker
    });
  } catch (error) {
    console.error("Run code error:", error);
    res.status(500).json({ message: "Failed to run code" });
  }
};

export const submitQuestion = async (req, res) => {
  try {
    const { interviewId, questionIndex, code, language, proctoringLogs, totalDetections } = req.body;

    if (!interviewId || questionIndex === undefined || !code || !language) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const interview = await CodingInterview.findById(interviewId);
    if (!interview) {
      return res.status(404).json({ message: "Coding interview not found" });
    }

    if (interview.status === "completed") {
      return res.status(400).json({ message: "This interview has already been submitted." });
    }

    const question = interview.questions[questionIndex];
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    const currentHash = crypto.createHash('sha256').update(`${questionIndex}:${language}:${code}`).digest('hex');

    // Idempotency check: if code is unchanged, return existing evaluation
    if (question.codeHash === currentHash && question.aiEvaluation?.qualityScore !== undefined) {
      const formattedResults = question.testCases.map((tc) => ({
        input: tc.input,
        expected: tc.expectedOutput,
        got: tc.passed ? tc.expectedOutput : (question.runResult?.stdout || (question.runResult?.stderr ? "ERROR" : "")),
        stderr: tc.passed ? "" : (question.runResult?.stderr || ""),
        passed: tc.passed,
        isHidden: tc.isHidden
      }));

      return res.json({
        message: "Question already evaluated with this code.",
        question: question,
        results: formattedResults
      });
    }

    question.userCode = code;
    question.codeHash = currentHash;

    const effectiveLang = getEffectiveLanguage(code, language);
    let runResults = [];
    try {
      const wrappedSubmissions = [];
      for (let i = 0; i < question.testCases.length; i++) {
        const tc = question.testCases[i];
        const wrappedCode = await wrapCodeForExecution(code, effectiveLang, tc.input, question);
        wrappedSubmissions.push({
          sourceCode: wrappedCode,
          input: tc.input
        });
        // Add a 4000ms delay to prevent hitting the 6000 TPM (Tokens Per Minute) hard limit on the free tier
        await new Promise(resolve => setTimeout(resolve, 4000));
      }

      runResults = await executeBatchOnJudge0(wrappedSubmissions, effectiveLang);
    } catch (e) {
      console.error("Batch execution failed, falling back to sequential:", e);
      runResults = [];
      for (const tc of question.testCases) {
        try {
          const wrappedCode = await wrapCodeForExecution(code, effectiveLang, tc.input, question);
          const res = await executeOnJudge0(wrappedCode, effectiveLang, tc.input);
          runResults.push(res);
        } catch (seqError) {
          console.error("Sequential fallback execution failed:", seqError);
          runResults.push({
            stdout: "",
            stderr: "Execution failed or timed out",
            compile_output: "",
            exitCode: 1,
            runTime: 0,
            memory: 0,
            status: "Internal Error",
            passed: false
          });
        }
      }
    }

    let passedCases = 0;
    let lastResult = { stdout: "", stderr: "", runTime: 0, memory: 0, passed: false };

    runResults.forEach((runRes, j) => {
      const tc = question.testCases[j];
      let tcPassed = false;

      if (question.checker && question.checker.enabled && question.checker.code) {
        try {
          let userOutput;
          try {
            userOutput = JSON.parse(runRes.stdout);
          } catch {
            userOutput = (runRes.stdout || "").trim();
          }

          const tcInput = parseInputAssignments(tc.input);
          const inputObj = {};
          const argsArray = [];
          tcInput.forEach((item, idx) => {
            let parsedVal;
            try { parsedVal = JSON.parse(item.val); } catch { parsedVal = item.val; }
            inputObj[item.name || `arg_${idx}`] = parsedVal;
            argsArray.push(parsedVal);
          });

          const expectedOutputStr = (tc.expectedOutput || "").trim();
          let expectedOutput;
          try {
            expectedOutput = JSON.parse(expectedOutputStr);
          } catch {
            expectedOutput = expectedOutputStr;
          }

          const sandboxContext = {
            result: userOutput,
            options: {
              input: inputObj,
              args: argsArray,
              expectedOutput: expectedOutput,
              testCase: tc
            }
          };

          vm.createContext(sandboxContext);
          const script = new vm.Script("const checkerFn = " + question.checker.code + ";\ncheckerFn(result, options);");
          tcPassed = script.runInContext(sandboxContext) === true && runRes.exitCode === 0;
        } catch (e) {
          console.error("Custom VM checker error:", e);
          tcPassed = false;
        }
      } else {
        const normStdout = normalizeOutput(runRes.stdout);
        const normExpected = normalizeOutput(tc.expectedOutput);
        let isMatch = normalize(runRes.stdout) === normalize(tc.expectedOutput) ||
          normStdout === normExpected ||
          `[${normStdout}]` === normExpected ||
          normStdout === `[${normExpected}]`;

        if (!isMatch && normStdout === 'null' && normExpected === '[]') {
          const templateStr = String(question.codeTemplate || "");
          if (templateStr.includes('ListNode') || templateStr.includes('TreeNode')) {
            isMatch = true;
            runRes.stdout = "[]";
          }
        }

        tcPassed = isMatch && runRes.exitCode === 0;
      }

      if (tc) {
        tc.passed = tcPassed;
        if (tcPassed && question.checker && question.checker.enabled) {
          tc.expectedOutput = runRes.stdout;
        }
      }

      if (tcPassed) {
        passedCases++;
      }

      if (j === 0) {
        lastResult = {
          stdout: runRes.stdout,
          stderr: runRes.stderr || runRes.compile_output,
          runTime: runRes.runTime,
          memory: runRes.memory,
          passed: tcPassed
        };
      }
    });

    question.runResult = lastResult;
    question.status = passedCases === question.testCases.length ? "Passed" : "Failed";

    const evalSystemPrompt = `
You are an expert DSA coding evaluator.
Evaluate the user's solution STRICTLY based on:
1. Submitted code
2. Actual testcase results
3. Passed and failed cases (Passed ${passedCases} out of ${question.testCases.length})
4. Runtime and memory usage (Runtime: ${lastResult.runTime}ms, Memory: ${lastResult.memory}KB)

Do not assume correctness.

Problem:
${question.problemStatement}

User's Code:
${code}

Return ONLY a valid JSON object in this format:
{
  "timeComplexity": "O(...)",
  "spaceComplexity": "O(...)",
  "qualityScore": 85,
  "optimizations": "Provide optimization advice and feedback on their approach...",
  "edgeCases": "Identify actual logical gaps, potential bugs, or missed edge cases in the user's code. Do not suggest checking for empty/null inputs or negative bounds if the problem constraints guarantee valid inputs. If the user's code handles all edge cases correctly, return 'None' or 'All edge cases handled correctly.'"
}
`;

    const messages = [{ role: "system", content: evalSystemPrompt }];
    let evaluation;
    try {
      const aiResponse = await askAi(messages, true);
      evaluation = parseAiJson(aiResponse);
    } catch (e) {
      evaluation = {
        timeComplexity: "O(N)",
        spaceComplexity: "O(1)",
        qualityScore: passedCases > 0 ? 50 : 10,
        optimizations: "Could not evaluate code structure.",
        edgeCases: "Could not verify edge cases."
      };
    }

    const correctnessRatio = question.testCases.length > 0 ? (passedCases / question.testCases.length) : 0;
    const rawQuality = typeof evaluation.qualityScore === 'number' ? evaluation.qualityScore : parseInt(evaluation.qualityScore) || 50;
    let finalQuestionScore = Math.round((correctnessRatio * 80) + (rawQuality * 0.2));
    if (correctnessRatio === 0 && rawQuality < 20) {
      finalQuestionScore = 0;
    }

    question.aiEvaluation = {
      timeComplexity: evaluation.timeComplexity,
      spaceComplexity: evaluation.spaceComplexity,
      qualityScore: finalQuestionScore,
      optimizations: evaluation.optimizations,
      edgeCases: evaluation.edgeCases
    };

    if (proctoringLogs !== undefined) interview.proctoringLogs = proctoringLogs;
    if (totalDetections !== undefined) interview.totalDetections = totalDetections;

    let currentTotalScore = 0;
    interview.questions.forEach(q => {
      currentTotalScore += (q.aiEvaluation?.qualityScore || 0);
    });
    interview.score = Math.round(currentTotalScore / interview.questions.length);

    const updatePayload = {
      [`questions.${questionIndex}`]: question,
      score: interview.score
    };

    if (proctoringLogs !== undefined) updatePayload.proctoringLogs = proctoringLogs;
    if (totalDetections !== undefined) updatePayload.totalDetections = totalDetections;

    await CodingInterview.updateOne({ _id: interview._id }, { $set: updatePayload });

    const formattedResults = question.testCases.map((tc, idx) => {
      const res = runResults[idx] || {};
      return {
        input: tc.input,
        expected: tc.expectedOutput,
        got: tc.passed ? tc.expectedOutput : (res.stdout || (res.stderr ? "ERROR" : "")),
        stderr: res.stderr || "",
        passed: tc.passed,
        isHidden: tc.isHidden
      };
    });

    res.json({
      message: "Question submitted successfully",
      question: question,
      results: formattedResults
    });
  } catch (error) {
    console.error("Submit question error:", error);
    res.status(500).json({ message: "Failed to submit question: " + error.message + " | " + error.stack });
  }
};

export const submitCodingInterview = async (req, res) => {
  try {
    const { interviewId, submissions, proctoringLogs, totalDetections } = req.body;

    const interview = await CodingInterview.findById(interviewId);
    if (!interview) {
      return res.status(404).json({ message: "Coding interview not found" });
    }

    if (interview.status === "completed") {
      return res.status(400).json({ message: "This interview has already been submitted." });
    }

    if (proctoringLogs !== undefined) interview.proctoringLogs = proctoringLogs;
    if (totalDetections !== undefined) interview.totalDetections = totalDetections;

    let totalScore = 0;
    const qualityScores = [];

    for (let i = 0; i < interview.questions.length; i++) {
      const question = interview.questions[i];
      const submission = (submissions && Array.isArray(submissions)
        ? submissions.find((s) => s.questionIndex === i)
        : submissions?.[i]) || {};
      const userCode = submission.code || "";

      question.userCode = userCode;

      // Check if user code is empty, whitespace-only, or exactly matches the starting template (ignoring whitespace/newlines)
      const subLanguage = submission.language || interview.language;
      const langKey = getTemplateLanguageKey(subLanguage);
      const startingTemplate = question.codeTemplates?.[langKey] || question.codeTemplate || "";
      const cleanUserCode = (userCode || "").replace(/\s+/g, "");
      const cleanTemplate = startingTemplate.replace(/\s+/g, "");
      const isUnsolved = !cleanUserCode || cleanUserCode === cleanTemplate;

      if (isUnsolved) {
        question.runResult = {
          stdout: "",
          stderr: "No code submitted.",
          runTime: 0,
          memory: 0,
          passed: false
        };
        question.status = "Unattempted";
        question.aiEvaluation = {
          timeComplexity: "N/A",
          spaceComplexity: "N/A",
          qualityScore: 0,
          optimizations: "No code was submitted for this question.",
          edgeCases: "No code was submitted to verify edge cases."
        };
        qualityScores.push(0);
        continue;
      }

      const currentHash = crypto.createHash('sha256').update(`${i}:${subLanguage}:${userCode}`).digest('hex');
      if (question.codeHash === currentHash && question.aiEvaluation?.qualityScore !== undefined) {
        qualityScores.push(question.aiEvaluation.qualityScore);
        continue;
      }
      question.codeHash = currentHash;

      // Prepare batch submissions
      let runResults = [];
      try {
        const effectiveLang = getEffectiveLanguage(userCode, subLanguage);
        const wrappedSubmissions = [];
        for (let i = 0; i < question.testCases.length; i++) {
          const tc = question.testCases[i];
          const wrappedCode = await wrapCodeForExecution(userCode, effectiveLang, tc.input, question);
          wrappedSubmissions.push({
            sourceCode: wrappedCode,
            input: tc.input
          });
          // Add a 4000ms delay to prevent hitting the 6000 TPM (Tokens Per Minute) hard limit on the free tier
          await new Promise(resolve => setTimeout(resolve, 4000));
        }

        runResults = await executeBatchOnJudge0(wrappedSubmissions, effectiveLang);
      } catch (e) {
        console.error("Batch execution failed, falling back to sequential:", e);
        // Fallback to sequential execution
        runResults = [];
        const subLanguage = submission.language || interview.language;
        const effectiveLang = getEffectiveLanguage(userCode, subLanguage);
        for (const tc of question.testCases) {
          try {
            const wrappedCode = await wrapCodeForExecution(userCode, effectiveLang, tc.input, question);
            const res = await executeOnJudge0(wrappedCode, effectiveLang, tc.input);
            runResults.push(res);
          } catch (seqError) {
            console.error("Sequential fallback execution failed:", seqError);
            runResults.push({
              stdout: "",
              stderr: "Execution failed or timed out",
              compile_output: "",
              exitCode: 1,
              runTime: 0,
              memory: 0,
              status: "Internal Error",
              passed: false
            });
          }
        }
      }

      let passedCases = 0;
      let lastResult = { stdout: "", stderr: "", runTime: 0, memory: 0, passed: false };

      runResults.forEach((runRes, j) => {
        const tc = question.testCases[j];

        let tcPassed = false;

        if (question.checker && question.checker.enabled && question.checker.code) {
          try {
            let userOutput;
            try {
              userOutput = JSON.parse(runRes.stdout);
            } catch {
              userOutput = (runRes.stdout || "").trim();
            }

            const tcInput = parseInputAssignments(tc.input);
            const inputObj = {};
            const argsArray = [];
            tcInput.forEach((item, idx) => {
              let parsedVal;
              try { parsedVal = JSON.parse(item.val); } catch { parsedVal = item.val; }
              inputObj[item.name || `arg_${idx}`] = parsedVal;
              argsArray.push(parsedVal);
            });

            const expectedOutputStr = (tc.expectedOutput || "").trim();
            let expectedOutput;
            try {
              expectedOutput = JSON.parse(expectedOutputStr);
            } catch {
              expectedOutput = expectedOutputStr;
            }

            const sandboxContext = {
              result: userOutput,
              options: {
                input: inputObj,
                args: argsArray,
                expectedOutput: expectedOutput,
                testCase: tc
              }
            };

            vm.createContext(sandboxContext);

            const script = new vm.Script("const checkerFn = " + question.checker.code + ";\ncheckerFn(result, options);");

            tcPassed = script.runInContext(sandboxContext) === true && runRes.exitCode === 0;
          } catch (e) {
            console.error("Custom VM checker error:", e);
            tcPassed = false;
          }
        } else {
          const normStdout = normalizeOutput(runRes.stdout);
          const normExpected = normalizeOutput(tc.expectedOutput);
          let isMatch = normalize(runRes.stdout) === normalize(tc.expectedOutput) ||
            normStdout === normExpected ||
            `[${normStdout}]` === normExpected ||
            normStdout === `[${normExpected}]`;

          if (!isMatch && normStdout === 'null' && normExpected === '[]') {
            const templateStr = String(question.codeTemplate || "");
            if (templateStr.includes('ListNode') || templateStr.includes('TreeNode')) {
              isMatch = true;
              runRes.stdout = "[]";
            }
          }

          tcPassed = isMatch && runRes.exitCode === 0;
        }

        if (tc) {
          tc.passed = tcPassed;
          if (tcPassed && question.checker && question.checker.enabled) {
            tc.expectedOutput = runRes.stdout;
          }
        }

        if (tcPassed) {
          passedCases++;
        }

        if (j === 0) {
          lastResult = {
            stdout: runRes.stdout,
            stderr: runRes.stderr || runRes.compile_output,
            runTime: runRes.runTime,
            memory: runRes.memory,
            passed: tcPassed
          };
        }
      });

      question.runResult = lastResult;
      question.status = passedCases === question.testCases.length ? "Passed" : "Failed";

      // Evaluate code quality and complexities using Groq AI
      const evalSystemPrompt = `
You are an expert DSA coding evaluator.
Evaluate the user's solution STRICTLY based on:
1. Submitted code
2. Actual testcase results
3. Passed and failed cases (Passed ${passedCases} out of ${question.testCases.length})
4. Runtime and memory usage (Runtime: ${lastResult.runTime}ms, Memory: ${lastResult.memory}KB)

Do not assume correctness.

Problem:
${question.problemStatement}

User's Code:
${userCode}

Return ONLY a valid JSON object in this format:
{
  "timeComplexity": "O(...)",
  "spaceComplexity": "O(...)",
  "qualityScore": 85,
  "optimizations": "Provide optimization advice and feedback on their approach...",
  "edgeCases": "Identify actual logical gaps, potential bugs, or missed edge cases in the user's code. Do not suggest checking for empty/null inputs or negative bounds if the problem constraints guarantee valid inputs. If the user's code handles all edge cases correctly, return 'None' or 'All edge cases handled correctly.'"
}
`;

      const messages = [{ role: "system", content: evalSystemPrompt }];
      let evaluation;
      try {
        const aiResponse = await askAi(messages, true);
        evaluation = parseAiJson(aiResponse);
      } catch (e) {
        evaluation = {
          timeComplexity: "O(N)",
          spaceComplexity: "O(1)",
          qualityScore: passedCases > 0 ? 50 : 10,
          optimizations: "Could not evaluate code structure.",
          edgeCases: "Could not verify edge cases."
        };
      }

      const correctnessRatio = question.testCases.length > 0 ? (passedCases / question.testCases.length) : 0;
      const rawQuality = typeof evaluation.qualityScore === 'number' ? evaluation.qualityScore : parseInt(evaluation.qualityScore) || 50;
      let finalQuestionScore = Math.round((correctnessRatio * 80) + (rawQuality * 0.2));
      if (correctnessRatio === 0 && rawQuality < 20) {
        finalQuestionScore = 0;
      }

      question.aiEvaluation = {
        timeComplexity: evaluation.timeComplexity,
        spaceComplexity: evaluation.spaceComplexity,
        qualityScore: finalQuestionScore,
        optimizations: evaluation.optimizations,
        edgeCases: evaluation.edgeCases
      };

      qualityScores.push(finalQuestionScore);
    }

    qualityScores.forEach((score) => {
      totalScore += score;
    });

    interview.score = Math.round(totalScore / interview.questions.length);
    interview.status = "completed";
    interview.completedAt = new Date();

    if (proctoringLogs && Array.isArray(proctoringLogs)) {
      interview.proctoringLogs = proctoringLogs;
    }

    // Skip follow-up question generation if no code was submitted (score is 0)
    if (interview.score === 0) {
      interview.followUpQuestions = [];
      interview.followUpAnswers = [];
      interview.finalEvaluation = {
        communicationScore: 0,
        problemSolvingScore: 0,
        optimizationScore: 0,
        dsaKnowledge: 0,
        overallRecommendation: "No technical evaluation generated because no code solutions were submitted for discussion.",
        isEvaluated: true
      };
      const updatePayloadZero = {
        score: interview.score,
        status: interview.status,
        completedAt: interview.completedAt,
        followUpQuestions: interview.followUpQuestions,
        followUpAnswers: interview.followUpAnswers,
        finalEvaluation: interview.finalEvaluation,
        questions: interview.questions
      };
      if (proctoringLogs && Array.isArray(proctoringLogs)) updatePayloadZero.proctoringLogs = proctoringLogs;
      if (totalDetections !== undefined) updatePayloadZero.totalDetections = totalDetections;

      await CodingInterview.updateOne({ _id: interview._id }, { $set: updatePayloadZero });

      return res.json({
        message: "Coding interview submitted successfully with zero score",
        score: interview.score,
        interviewId: interview._id
      });
    }

    // Select interviewer personality
    const personalities = [
      "Strict Interviewer",
      "Friendly Mentor",
      "Google-style Interviewer",
      "Amazon-style Interviewer"
    ];
    const selectedPersonality = personalities[Math.floor(Math.random() * personalities.length)];
    interview.interviewerPersonality = selectedPersonality;

    // Calculate candidate performance metrics for adaptive difficulty
    let totalTC = 0;
    let passedTC = 0;
    interview.questions.forEach(q => {
      (q.testCases || []).forEach(tc => {
        totalTC++;
        if (tc.passed) passedTC++;
      });
    });
    const accuracy = totalTC > 0 ? (passedTC / totalTC) : 0;

    let targetDifficulty = "Medium";
    let targetConcept = "standard time/space complexity trade-offs, standard data structures, and edge cases";
    if (accuracy >= 0.8) {
      targetDifficulty = "FAANG-level";
      targetConcept = "deep optimizations, extreme scales, mathematical complexity bounds, and system-design DSA trade-offs";
    } else if (accuracy < 0.4) {
      targetDifficulty = "Beginner";
      targetConcept = "conceptual walkthroughs, fundamental control flow, recursion versus iteration, and correcting basic logic bugs";
    }

    // Generate 5 dynamic follow-up questions
    const attemptedQuestions = interview.questions.filter(q => q.runResult && q.runResult.stderr !== "No code submitted." && q.aiEvaluation?.qualityScore > 0);

    const codeSubmissionsText = attemptedQuestions.map((q, idx) => {
      const failedInputs = (q.testCases || []).filter(tc => !tc.passed).map(tc => tc.input);
      const passedCount = (q.testCases || []).filter(tc => tc.passed).length;
      const totalCount = (q.testCases || []).length;
      return `Question ${idx + 1}: ${q.title}
Problem: ${q.problemStatement}
User Code:
${q.userCode || "No code submitted"}
Execution Status: Passed ${passedCount}/${totalCount} test cases.
Failed Testcase Inputs: ${failedInputs.length > 0 ? JSON.stringify(failedInputs) : "None"}
AI Evaluation Correctness / Complexities:
Time Complexity: ${q.aiEvaluation.timeComplexity}
Space Complexity: ${q.aiEvaluation.spaceComplexity}
Missed Edge Cases: ${q.aiEvaluation.edgeCases}
Optimization Feedback: ${q.aiEvaluation.optimizations}
`;
    }).join("\n\n");

    const followUpSystemPrompt = `
You are an expert DSA technical interviewer conducting a coding interview discussion round.
Your interviewer personality is: "${selectedPersonality}".

Personality Guidelines:
- Strict Interviewer: Direct, rigorous, pressure-based optimization. Critiques complexity and highlights line-by-line inefficiencies. Interrupts/probes deep.
- Friendly Mentor: Warm, supportive, provides guidance and hints to help candidate optimize or debug their own code.
- Google-style Interviewer: Deep focus on computer science fundamentals, mathematical efficiency, strict memory constraints, and extreme scalability.
- Amazon-style Interviewer: Focuses on clean code, alternative data structures, practical trade-offs, and robust operational edge cases.

Here is the candidate's submitted code and its evaluation metrics (only for the questions they attempted):
${codeSubmissionsText}

The candidate has completed their coding round. Based ONLY on the actual submitted code, any mistakes, inefficient logic, choice of data structures, complexity estimates, and failed test cases, generate exactly 5 professional, technical follow-up questions.
The target candidate level is "${targetDifficulty}" (focusing on ${targetConcept}).

You MUST strictly generate the questions in the following sequential order:
1. Question 1 (Category: "correctness"): Ask about used algorithm, loops, recursion, sorting, hashmaps, or DP states in their actual code.
2. Question 2 (Category: "optimization"): Focus on reducing time/space complexity (e.g. optimizing O(n²) to O(n)) based on nested loops or choices in their code.
3. Question 3 (Category: "debugging"): Focus on failed test cases or specific edge cases (duplicates, empty arrays, null/negatives) based on candidate's code.
4. Question 4 (Category: "scalability"): Focus on behavior under extreme constraints (e.g. $10^6$ inputs, caching, or physical memory constraints).
5. Question 5 (Category: "system_thinking"): Discussion on alternative approaches or different solutions (e.g. greedy vs DP, hashmap vs set, complexity trade-offs, system-design style tradeoffs).

Rules:
- NEVER ask generic questions like "Explain your code" or "Explain your approach".
- ONLY ask follow-up questions about the specific problems the candidate actually attempted above. DO NOT ask about problems they skipped or did not write code for.
- Actively ask the candidate to discuss alternative approaches or different solutions for the problems they solved.
- Refer directly to specific code structures, lines, or helper data structures from the candidate's code.
- Wording, tone, and formatting MUST reflect the "${selectedPersonality}" personality.
- Provide a list of 2-4 key technical keywords or concepts that a correct answer should cover (expectedConcepts).
- Return ONLY a valid JSON array of exactly 5 objects. Do not wrap in markdown or include explanations. E.g.
[
  {
    "question": "Strict/friendly style question for Q1...",
    "category": "correctness",
    "difficulty": "${targetDifficulty}",
    "expectedConcepts": ["loops", "recursion", "iteration"]
  },
  ...
]
`;

    const followUpMessages = [{ role: "system", content: followUpSystemPrompt }];
    let followUpQuestions = [];
    try {
      const followUpResponse = await askAi(followUpMessages, true);
      const parsedQuestions = parseAiJson(followUpResponse);
      if (Array.isArray(parsedQuestions) && parsedQuestions.length === 5) {
        followUpQuestions = parsedQuestions.map((q, idx) => {
          const category = q.category || (idx === 0 ? "correctness" : idx === 1 ? "optimization" : idx === 2 ? "debugging" : idx === 3 ? "scalability" : "system_thinking");
          const defaultConcepts =
            category === "correctness" ? ["loop structure", "algorithm", "correctness"] :
              category === "optimization" ? ["time complexity", "optimize", "data structures", "nested loops"] :
                category === "debugging" ? ["edge case", "empty", "duplicates", "debugging", "null"] :
                  category === "scalability" ? ["memory limit", "extreme scale", "scaling", "large inputs"] :
                    ["trade-offs", "alternatives", "design", "data structure comparison"];

          return {
            questionId: idx,
            question: q.question || q,
            category: category,
            difficulty: q.difficulty || targetDifficulty,
            expectedConcepts: Array.isArray(q.expectedConcepts) && q.expectedConcepts.length > 0
              ? q.expectedConcepts.map(c => String(c).toLowerCase().trim())
              : defaultConcepts
          };
        });
      }
    } catch (e) {
      console.error("Failed to generate follow-up questions:", e);
    }

    // Fallback if AI generation fails
    if (followUpQuestions.length === 0) {
      followUpQuestions = [
        { questionId: 0, question: "Walk me through the loop structures in your solutions and identify any redundant operations.", category: "correctness", difficulty: targetDifficulty, expectedConcepts: ["loop structures", "redundant operations", "iteration"] },
        { questionId: 1, question: "Can we optimize your time complexity to a linear time complexity? Explain the required data structures.", category: "optimization", difficulty: targetDifficulty, expectedConcepts: ["optimize", "linear time complexity", "data structures"] },
        { questionId: 2, question: "How does your code handle edge cases such as empty arrays, duplicate values, or null inputs?", category: "debugging", difficulty: targetDifficulty, expectedConcepts: ["edge cases", "empty arrays", "duplicate values", "null inputs"] },
        { questionId: 3, question: "Will your solution successfully execute within memory and CPU limits if the input size scales to 10^6?", category: "scalability", difficulty: targetDifficulty, expectedConcepts: ["memory limit", "cpu limit", "scale", "10^6"] },
        { questionId: 4, question: "What are the trade-offs of using a Hash Map versus a Set or a sorted list in your algorithms?", category: "system_thinking", difficulty: targetDifficulty, expectedConcepts: ["hash map", "set", "sorted list", "trade-offs"] }
      ];
    }

    interview.followUpQuestions = followUpQuestions;
    
    const updatePayloadFull = {
      score: interview.score,
      status: interview.status,
      completedAt: interview.completedAt,
      interviewerPersonality: interview.interviewerPersonality,
      followUpQuestions: interview.followUpQuestions,
      questions: interview.questions
    };
    if (proctoringLogs && Array.isArray(proctoringLogs)) updatePayloadFull.proctoringLogs = proctoringLogs;
    if (totalDetections !== undefined) updatePayloadFull.totalDetections = totalDetections;

    await CodingInterview.updateOne({ _id: interview._id }, { $set: updatePayloadFull });

    res.json({
      message: "Coding interview submitted successfully",
      score: interview.score,
      interviewId: interview._id
    });

  } catch (error) {
    if (error.name === 'VersionError') {
      return res.status(400).json({ message: "This interview has already been processed." });
    }
    console.error("Submit coding interview error:", error);
    res.status(500).json({ message: "Failed to submit coding interview" });
  }
};

export const submitFinalEvaluation = async (req, res) => {
  try {
    const { interviewId, answers } = req.body;

    const interview = await CodingInterview.findById(interviewId);
    if (!interview) {
      return res.status(404).json({ message: "Coding interview not found" });
    }

    if (interview.finalEvaluation && interview.finalEvaluation.isEvaluated) {
      return res.status(400).json({ message: "This evaluation has already been submitted." });
    }

    if (!answers || !Array.isArray(answers) || answers.length !== 5) {
      return res.status(400).json({ message: "Please provide exactly 5 answers" });
    }

    // Pre-validation helper to detect short/meaningless responses
    const invalidPatterns = [
      /^[a-z]$/i,              // single letters
      /^.$/,                   // single characters
      /^[0-9]+$/,              // digits only
      /^[bcdfghjklmnpqrstvwxyz\s]+$/i, // consonants only
      /^[aeiou\s]+$/i          // vowels only
    ];

    const checkIsGibberish = (ans) => {
      const cleanAns = (ans || "").trim();
      if (cleanAns.length < 15) return true;

      const words = cleanAns.split(/\s+/).filter(w => w.length > 0);
      if (words.length < 3) return true;

      for (const pattern of invalidPatterns) {
        if (pattern.test(cleanAns)) return true;
      }

      // Repeated characters check (e.g. "aaaaaa", "jjjjj")
      const uniqueChars = new Set(cleanAns.toLowerCase().replace(/\s+/g, ''));
      if (uniqueChars.size <= 2 && cleanAns.length > 5) return true;

      return false;
    };

    // Save the answers
    interview.followUpAnswers = answers.map((ans, idx) => ({
      questionId: idx,
      answer: ans
    }));

    const codeSubmissionsText = interview.questions.map((q, idx) => {
      return `Question ${idx + 1}: ${q.title}
User Code:
${q.userCode || "No code submitted"}
`;
    }).join("\n\n");

    let totalCorrectness = 0;
    let totalDepth = 0;
    let totalCommunication = 0;
    let totalOptimization = 0;
    let totalConfidenceNum = 0;
    let invalidCount = 0;

    const results = [];
    for (let idx = 0; idx < interview.followUpQuestions.length; idx++) {
      const q = interview.followUpQuestions[idx];
      const ans = (answers[idx] || "").trim();
      const isGibberish = checkIsGibberish(ans);

      if (isGibberish) {
        results.push({
          questionId: q.questionId,
          question: q.question,
          category: q.category,
          difficulty: q.difficulty,
          expectedConcepts: q.expectedConcepts,
          correctnessScore: 0,
          depthScore: 0,
          communicationScore: 0,
          optimizationScore: 0,
          confidence: "low",
          feedback: ans === "" ? "No answer was provided." : "Answer is too short, irrelevant, or meaningless to be graded."
        });
        continue;
      }

      const evalSystemPrompt = `
You are an expert DSA technical evaluator.
Evaluate the candidate's answer to a single follow-up question during a technical interview.

Candidate's Code Context:
${codeSubmissionsText}

Question: ${q.question}
Category: ${q.category}
Expected Concepts/Keywords: ${JSON.stringify(q.expectedConcepts || [])}

Candidate's Answer:
"${ans}"

Evaluate the answer based on:
1. correctnessScore (0 to 100): How technically accurate and correct is the answer? Does it cover the expected concepts and address the question?
2. depthScore (0 to 100): Does it show deep computer science and data structures depth (e.g. complexity bounds, memory)?
3. communicationScore (0 to 100): Is it clear, precise, and well-explained without wordiness?
4. optimizationScore (0 to 100): Does it correctly address efficiency, performance, and big-O optimization?
5. confidence ("high" | "medium" | "low"): Rate the candidate's assertiveness and explanation confidence.

Return ONLY a valid JSON object in this format:
{
  "correctnessScore": 85,
  "depthScore": 75,
  "communicationScore": 80,
  "optimizationScore": 90,
  "confidence": "high",
  "feedback": "Provide 1 sentence of concise feedback."
}
`;
      try {
        const aiResponse = await askAi([{ role: "system", content: evalSystemPrompt }], true);
        const parsed = parseAiJson(aiResponse);
        results.push({
          questionId: q.questionId,
          question: q.question,
          category: q.category,
          difficulty: q.difficulty,
          expectedConcepts: q.expectedConcepts,
          correctnessScore: typeof parsed.correctnessScore === 'number' ? parsed.correctnessScore : parseInt(parsed.correctnessScore) || 0,
          depthScore: typeof parsed.depthScore === 'number' ? parsed.depthScore : parseInt(parsed.depthScore) || 0,
          communicationScore: typeof parsed.communicationScore === 'number' ? parsed.communicationScore : parseInt(parsed.communicationScore) || 0,
          optimizationScore: typeof parsed.optimizationScore === 'number' ? parsed.optimizationScore : parseInt(parsed.optimizationScore) || 0,
          confidence: parsed.confidence || "low",
          feedback: parsed.feedback || "Evaluated successfully."
        });
      } catch (err) {
        console.error(`AI evaluation failed for question ${q.questionId}:`, err);
        results.push({
          questionId: q.questionId,
          question: q.question,
          category: q.category,
          difficulty: q.difficulty,
          expectedConcepts: q.expectedConcepts,
          correctnessScore: 20,
          depthScore: 20,
          communicationScore: 20,
          optimizationScore: 20,
          confidence: "low",
          feedback: "Could not automatically grade response."
        });
      }
    }

    results.forEach((res, idx) => {
      const dbQ = interview.followUpQuestions.find(fq => fq.questionId === res.questionId);
      if (dbQ) {
        dbQ.correctnessScore = res.correctnessScore;
        dbQ.depthScore = res.depthScore;
        dbQ.communicationScore = res.communicationScore;
        dbQ.optimizationScore = res.optimizationScore;
        dbQ.confidence = res.confidence;
        dbQ.feedback = res.feedback;
      }

      totalCorrectness += res.correctnessScore;
      totalDepth += res.depthScore;
      totalCommunication += res.communicationScore;
      totalOptimization += res.optimizationScore;

      let confVal = 0;
      if (res.confidence === "high") confVal = 100;
      else if (res.confidence === "medium") confVal = 50;
      totalConfidenceNum += confVal;

      const ans = (answers[idx] || "").trim();
      if (checkIsGibberish(ans)) {
        invalidCount++;
      }
    });

    const count = results.length;
    let avgCorrectness = totalCorrectness / count;
    let avgDepth = totalDepth / count;
    let avgCommunication = totalCommunication / count;
    let avgOptimization = totalOptimization / count;
    let avgConfidence = totalConfidenceNum / count;

    // Apply Word Count / Answer Length Penalty
    if (invalidCount >= 3) {
      // Severe penalty if 3 or more answers are gibberish/short
      avgCorrectness *= 0.15;
      avgDepth *= 0.15;
      avgCommunication *= 0.15;
      avgOptimization *= 0.15;
      avgConfidence *= 0.15;
    } else if (invalidCount > 0) {
      // Proportional penalty: 30% reduction per invalid answer
      const multiplier = 1 - (invalidCount * 0.3);
      avgCorrectness *= multiplier;
      avgDepth *= multiplier;
      avgCommunication *= multiplier;
      avgOptimization *= multiplier;
      avgConfidence *= multiplier;
    }

    avgCorrectness = Math.round(avgCorrectness);
    avgDepth = Math.round(avgDepth);
    avgCommunication = Math.round(avgCommunication);
    avgOptimization = Math.round(avgOptimization);
    avgConfidence = Math.round(avgConfidence);

    // Map aggregated results to MongoDB finalEvaluation schema
    interview.finalEvaluation = {
      communicationScore: avgCommunication,
      problemSolvingScore: Math.round((avgCorrectness + avgDepth) / 2),
      optimizationScore: avgOptimization,
      dsaKnowledge: avgDepth,
      clarity: avgCommunication,
      confidence: avgConfidence,
      correctness: avgCorrectness,
      technicalDepth: avgDepth,
      optimizationUnderstanding: avgOptimization,
      isEvaluated: true,
      overallRecommendation: ""
    };

    // Generate final overall recommendation using LLM based on per-question evaluation breakdown
    const perQuestionSummaryText = results.map((res, idx) => {
      return `Question ${idx + 1}: ${res.question}
Candidate's Answer: "${answers[idx] || ""}"
Correctness: ${res.correctnessScore}/100
Depth: ${res.depthScore}/100
Communication: ${res.communicationScore}/100
Optimization: ${res.optimizationScore}/100
Confidence: ${res.confidence}
Feedback: ${res.feedback}
`;
    }).join("\n\n");

    const recommendationPrompt = `
You are an expert DSA technical interviewer.
Write a professional, concise overall recommendation summary (maximum 3 sentences) explaining the candidate's strengths, areas for improvement, and a final technical verdict.

Here is the per-question evaluation breakdown:
${perQuestionSummaryText}

Return ONLY the recommendation text. Do not wrap in markdown, quotes, or JSON.
`;

    try {
      const recResponse = await askAi([{ role: "system", content: recommendationPrompt }], false);
      interview.finalEvaluation.overallRecommendation = recResponse.trim();
    } catch (e) {
      console.error("AI recommendation failed:", e);
      interview.finalEvaluation.overallRecommendation = "Candidate completed the follow-up round. " + (invalidCount >= 3 ? "A significant portion of their responses were invalid or incoherent, reflecting poor communication and problem-solving skills." : "Evaluation details are available in the question breakdown.");
    }

    const updatePayloadFinal = {
      followUpAnswers: interview.followUpAnswers,
      followUpQuestions: interview.followUpQuestions,
      finalEvaluation: interview.finalEvaluation
    };

    await CodingInterview.updateOne({ _id: interview._id }, { $set: updatePayloadFinal });
    res.json(interview);
  } catch (error) {
    if (error.name === 'VersionError') {
      return res.status(400).json({ message: "This evaluation has already been processed." });
    }
    console.error("Submit final evaluation error:", error);
    res.status(500).json({ message: "Failed to evaluate answers" });
  }
};

export const getCodingInterviewReport = async (req, res) => {
  try {
    const interview = await CodingInterview.findById(req.params.id);
    if (!interview) {
      return res.status(404).json({ message: "Coding interview report not found" });
    }

    res.json(interview);
  } catch (error) {
    console.error("Get report error:", error);
    res.status(500).json({ message: "Failed to load report details" });
  }
};

export const getCodingInterviews = async (req, res) => {
  try {
    const history = await CodingInterview.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .select("company language difficulty score status createdAt");
    res.json(history);
  } catch (error) {
    console.error("Get history error:", error);
    res.status(500).json({ message: "Failed to fetch interview history" });
  }
};

export const checkJudge0Health = async (req, res) => {
  const providers = getJudge0Providers();
  const report = [];

  for (const provider of providers) {
    let status = "offline";
    let error = null;
    let availableLanguages = [];

    try {
      const response = await axios.get(`${provider.baseUrl}/languages`, {
        headers: provider.headers,
        timeout: 3000
      });
      if (response.status === 200) {
        status = "online";
        availableLanguages = Array.isArray(response.data)
          ? response.data.slice(0, 5).map((l) => l.name)
          : [];
      }
    } catch (err) {
      error = err.message;
    }

    report.push({
      name: provider.name,
      baseUrl: provider.baseUrl,
      status,
      error,
      availableLanguages
    });
  }

  res.json({
    timestamp: new Date(),
    providers: report
  });
};

