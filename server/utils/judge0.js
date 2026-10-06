import axios from "axios";
import { encode, decode, getLanguageId } from "./codeWrapper/index.js";

export const STATUS_MAP = {
  1: "In Queue",
  2: "Processing",
  3: "Accepted",
  4: "Wrong Answer",
  5: "Time Limit Exceeded",
  6: "Compilation Error",
  7: "Runtime Error (SIGSEGV)",
  8: "Runtime Error (SIGXFSZ)",
  9: "Runtime Error (SIGFPE)",
  10: "Runtime Error (SIGABRT)",
  11: "Runtime Error (NZEC)",
  12: "Runtime Error (Other)",
  13: "Internal Error",
  14: "Exec Format Error"
};

export const getJudge0Providers = () => {
  const apiKey = process.env.RAPID_API_KEY;
  const providers = [];

  if (apiKey) {
    providers.push({
      name: "RapidAPI Judge0",
      baseUrl: "https://judge0-ce.p.rapidapi.com",
      headers: {
        "x-rapidapi-key": apiKey,
        "x-rapidapi-host": "judge0-ce.p.rapidapi.com",
        "Content-Type": "application/json"
      }
    });
  } else {
    providers.push({
      name: "Local Docker Judge0",
      baseUrl: process.env.LOCAL_JUDGE0_URL || "http://localhost:2358",
      headers: {}
    });
  }

  return providers;
};

export const executeOnJudge0 = async (sourceCode, language, input) => {
  const langId = getLanguageId(language);
  const providers = getJudge0Providers();

  let finalSourceCode = sourceCode;
  if (langId === 71 && !sourceCode.includes("from __future__ import annotations")) {
    finalSourceCode = "from __future__ import annotations\n" + sourceCode;
  }

  let token = null;
  let activeProvider = null;

  for (const provider of providers) {
    try {
      const response = await axios.post(
        `${provider.baseUrl}/submissions?base64_encoded=true`,
        {
          source_code: encode(finalSourceCode),
          language_id: langId,
          stdin: encode(input || ""),
          cpu_time_limit: 2,
          wall_time_limit: 5,
          memory_limit: 128000,
          ...(langId === 54 ? { compiler_options: "-std=c++17 -Werror=return-type" } : langId === 50 ? { compiler_options: "-Werror=return-type" } : {})
        },
        {
          headers: provider.headers,
          timeout: 5000
        }
      );
      if (response.data && response.data.token) {
        token = response.data.token;
        activeProvider = provider;
        break;
      }
    } catch (err) {
      console.warn(`Failed to submit to ${provider.name}: ${err.message}. Trying next provider...`);
    }
  }

  if (!token || !activeProvider) {
    throw new Error("Failed to submit to any Judge0 provider");
  }

  let attempts = 0;
  const maxAttempts = 20;
  let result = null;

  while (attempts < maxAttempts) {
    attempts++;
    try {
      const getRes = await axios.get(
        `${activeProvider.baseUrl}/submissions/${token}?base64_encoded=true`,
        {
          headers: activeProvider.headers,
          timeout: 5000
        }
      );

      const statusId = getRes.data.status?.id;
      if (statusId > 2) {
        result = getRes.data;
        break;
      }
    } catch (err) {
      console.warn(`Polling status failed (attempt ${attempts}): ${err.message}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (!result) {
    throw new Error("Code execution timed out in Judge0 queue");
  }

  const statusId = result.status?.id;
  const mappedStatus = STATUS_MAP[statusId] || result.status?.description || "Unknown";

  return {
    stdout: decode(result.stdout) || "",
    stderr: decode(result.stderr || result.compile_output) || "",
    compile_output: decode(result.compile_output) || "",
    exitCode: statusId === 3 ? 0 : 1,
    runTime: result.time ? Math.floor(parseFloat(result.time) * 1000) : 0,
    memory: result.memory || 0,
    status: mappedStatus,
    passed: statusId === 3
  };
};

export const executeBatchOnJudge0 = async (wrappedSubmissions, language) => {
  const langId = getLanguageId(language);
  const providers = getJudge0Providers();

  const submissions = wrappedSubmissions.map((sub) => {
    let finalSourceCode = sub.sourceCode;
    if (langId === 71 && !finalSourceCode.includes("from __future__ import annotations")) {
      finalSourceCode = "from __future__ import annotations\n" + finalSourceCode;
    }
    return {
      source_code: encode(finalSourceCode),
      language_id: langId,
      stdin: encode(sub.input || ""),
      cpu_time_limit: 2,
      wall_time_limit: 5,
      memory_limit: 128000,
      ...(langId === 54 ? { compiler_options: "-std=c++17 -Werror=return-type" } : langId === 50 ? { compiler_options: "-Werror=return-type" } : {})
    };
  });

  let tokens = null;
  let activeProvider = null;

  for (const provider of providers) {
    try {
      const response = await axios.post(
        `${provider.baseUrl}/submissions/batch?base64_encoded=true`,
        { submissions },
        {
          headers: provider.headers,
          timeout: 5000
        }
      );
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        tokens = response.data.map((item) => item.token);
        activeProvider = provider;
        break;
      }
    } catch (err) {
      console.warn(`Failed to submit batch to ${provider.name}: ${err.message}. Trying next provider...`);
    }
  }

  if (!tokens || !activeProvider) {
    throw new Error("Failed to submit batch to any Judge0 provider");
  }

  let attempts = 0;
  const maxAttempts = 20;
  let finishedResults = null;

  while (attempts < maxAttempts) {
    attempts++;
    try {
      const getRes = await axios.get(
        `${activeProvider.baseUrl}/submissions/batch?tokens=${tokens.join(",")}&base64_encoded=true`,
        {
          headers: activeProvider.headers,
          timeout: 5000
        }
      );

      const batchSubmissions = getRes.data?.submissions;
      if (batchSubmissions && Array.isArray(batchSubmissions)) {
        const allFinished = batchSubmissions.every((sub) => sub.status?.id > 2);
        if (allFinished) {
          const tokenMap = {};
          batchSubmissions.forEach(sub => {
            tokenMap[sub.token] = sub;
          });
          finishedResults = tokens.map(token => tokenMap[token] || batchSubmissions[0]);
          break;
        }
      }
    } catch (err) {
      console.warn(`Polling batch status failed (attempt ${attempts}): ${err.message}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (!finishedResults) {
    throw new Error("Code execution batch timed out in Judge0 queue");
  }

  return finishedResults.map((result) => {
    const statusId = result.status?.id;
    const mappedStatus = STATUS_MAP[statusId] || result.status?.description || "Unknown";

    return {
      stdout: decode(result.stdout) || "",
      stderr: decode(result.stderr || result.compile_output) || "",
      compile_output: decode(result.compile_output) || "",
      exitCode: statusId === 3 ? 0 : 1,
      runTime: result.time ? Math.floor(parseFloat(result.time) * 1000) : 0,
      memory: result.memory || 0,
      status: mappedStatus,
      passed: statusId === 3
    };
  });
};