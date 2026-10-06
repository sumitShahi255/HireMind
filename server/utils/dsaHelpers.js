import crypto from "crypto";

export const escapeControlCharsInJson = (jsonStr) => {
  let result = "";
  let inString = false;
  let escape = false;
  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];
    if (escape) {
      result += char;
      escape = false;
      continue;
    }
    if (char === "\\") {
      result += char;
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      result += char;
      continue;
    }
    
    if (inString) {
      const code = char.charCodeAt(0);
      if (code < 32) {
        if (char === "\n") result += "\\n";
        else if (char === "\r") result += "\\r";
        else if (char === "\t") result += "\\t";
        else {
          const hex = code.toString(16).padStart(4, "0");
          result += `\\u${hex}`;
        }
      } else {
        result += char;
      }
    } else {
      result += char;
    }
  }
  return result;
};

export const parseAiJson = (text) => {
  if (!text) return null;
  let clean = text.trim();
  
  const firstBrace = clean.indexOf("{");
  const firstBracket = clean.indexOf("[");
  let jsonStart = -1;
  let jsonEnd = -1;
  
  if (firstBrace !== -1 && firstBracket !== -1) {
    jsonStart = Math.min(firstBrace, firstBracket);
  } else if (firstBrace !== -1) {
    jsonStart = firstBrace;
  } else if (firstBracket !== -1) {
    jsonStart = firstBracket;
  }
  
  if (jsonStart !== -1) {
    const isArray = clean[jsonStart] === "[";
    jsonEnd = isArray ? clean.lastIndexOf("]") : clean.lastIndexOf("}");
    if (jsonEnd > jsonStart) {
      clean = clean.substring(jsonStart, jsonEnd + 1);
    }
  }
  
  try {
    return JSON.parse(clean);
  } catch (directError) {
    try {
      const escaped = escapeControlCharsInJson(clean);
      return JSON.parse(escaped);
    } catch (escapedError) {
      console.error("parseAiJson error:", directError.message, "Escaped error:", escapedError.message);
      
      const codeBlockStart = text.indexOf("```json");
      if (codeBlockStart !== -1) {
        let segment = text.substring(codeBlockStart + 7);
        const codeBlockEnd = segment.indexOf("```");
        if (codeBlockEnd !== -1) {
          segment = segment.substring(0, codeBlockEnd).trim();
          try {
            return JSON.parse(segment);
          } catch (segError) {
            try {
              return JSON.parse(escapeControlCharsInJson(segment));
            } catch (e) {
              console.error("parseAiJson segment fallback error:", e.message);
            }
          }
        }
      }
      throw directError;
    }
  }
};

export const normalizeTitle = (title = "") => {
  return String(title)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

export const getMd5Hash = (title, topic, pattern) => {
  const content = normalizeTitle(`${title || ""}${topic || ""}${pattern || ""}`);
  return crypto.createHash("md5").update(content).digest("hex");
};

export const getQuestionHash = (title, topic, difficulty) => {
  const norm = (str) => (str || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();
  return crypto
    .createHash("sha256")
    .update(norm(title) + norm(topic) + norm(difficulty))
    .digest("hex");
};

export const isDuplicateQuestion = (
  title,
  pattern,
  topic,
  coreAlgorithm,
  existingTitles = [],
  existingPatterns = [],
  existingHashes = [],
  existingAlgorithms = []
) => {
  const normTitle = normalizeTitle(title);
  const normPattern = normalizeTitle(pattern);
  const normAlgo = normalizeTitle(coreAlgorithm);
  const hash = getMd5Hash(title, topic, pattern);

  if (existingHashes.includes(hash)) return true;

  if (normTitle) {
    const titleDup = existingTitles.some((existing) => {
      const normExisting = normalizeTitle(existing);
      return (
        normTitle === normExisting ||
        normTitle.includes(normExisting) ||
        normExisting.includes(normTitle)
      );
    });
    if (titleDup) return true;
  }

  if (normPattern) {
    const patternDup = existingPatterns.some((existing) => {
      const normExisting = normalizeTitle(existing);
      return (
        normPattern === normExisting ||
        normPattern.includes(normExisting) ||
        normExisting.includes(normPattern)
      );
    });
    if (patternDup) return true;
  }

  if (normAlgo) {
    const algoDup = existingAlgorithms.some((existing) => {
      const normExisting = normalizeTitle(existing);
      return (
        normAlgo === normExisting ||
        normAlgo.includes(normExisting) ||
        normExisting.includes(normAlgo)
      );
    });
    if (algoDup) return true;
  }

  return false;
};

export const validateCompanyTopic = (questionTopic, allowedTopics) => {
  if (!allowedTopics || allowedTopics.length === 0) return true;
  const normQTopic = normalizeTitle(questionTopic);
  return allowedTopics.some((topic) =>
    normQTopic.includes(normalizeTitle(topic)) ||
    normalizeTitle(topic).includes(normQTopic)
  );
};

export const getCodeTemplateForLanguage = (language, sigObj) => {
  const l = (language || "").toLowerCase();

  if (l.includes("python")) {
    let sig = (sigObj.python || "def solve(self):").trim();
    if (sig.includes("class Solution")) {
      return sig;
    }
    if (sig.includes("\n")) {
      sig = sig.split("\n")[0].trim();
    }
    if (!sig.endsWith(":")) {
      sig += ":";
    }
    return `class Solution:\n    ${sig}\n        # Write code here\n        pass`;
  }

  if (l.includes("javascript") || l.includes("node") || l.includes("js")) {
    let sig = (sigObj.javascript || "solve() {").trim();
    if (sig.includes("class Solution")) {
      return sig;
    }
    sig = sig.replace(/^\s*function\s+/, "");
    if (sig.includes("\n")) {
      sig = sig.split("\n")[0].trim();
    }
    if (!sig.endsWith("{")) {
      sig += " {";
    }
    return `class Solution {\n    ${sig}\n        // Write code here\n        \n    }\n}`;
  }

  if (l.includes("java")) {
    let sig = (sigObj.java || "public void solve() {").trim();
    if (sig.includes("class Solution")) {
      return sig;
    }
    if (sig.includes("\n")) {
      sig = sig.split("\n")[0].trim();
    }
    if (!sig.endsWith("{")) {
      sig += " {";
    }
    return `class Solution {\n    ${sig}\n        // Write code here\n        \n    }\n}`;
  }

  if (l.includes("c++") || l.includes("gcc") || l.includes("cpp")) {
    let sig = (sigObj.cpp || "void solve() {").trim();
    if (sig.includes("class Solution")) {
      return sig;
    }
    if (sig.includes("\n")) {
      sig = sig.split("\n")[0].trim();
    }
    if (!sig.endsWith("{")) {
      sig += " {";
    }
    return `class Solution {\npublic:\n    ${sig}\n        // Write code here\n        \n    }\n};`;
  }

  // default to C
  let sig = (sigObj.c || "void solve() {").trim();
  if (sig.includes("\n") && sig.includes("#include")) {
    return sig;
  }
  if (sig.includes("\n")) {
    sig = sig.split("\n")[0].trim();
  }
  if (!sig.endsWith("{")) {
    sig += " {";
  }
  return `${sig}\n    // Write code here\n    \n}`;
};
