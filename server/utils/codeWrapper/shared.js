import { getLanguageKey } from "./constants.js";
import { parseInputAssignments } from "./helpers.js";

export const getEffectiveLanguage = (code, language) => {
  const lang = (language || "").toLowerCase().trim();
  if (lang === "c" && code) {
    const isCpp = code.includes("vector") ||
      code.includes("std::") ||
      code.includes("iostream") ||
      code.includes("class ") ||
      code.includes("public:") ||
      code.includes("unordered_") ||
      code.includes("map<") ||
      code.includes("set<") ||
      code.includes("using namespace");
    if (isCpp) {
      return "C++ (GCC)";
    }
  }
  return language;
};

export const isLinkedListParam = (name = "") => {
  const clean = name.toLowerCase();
  return clean === "head" || clean.includes("listnode") || clean.includes("linkedlist");
};

export const isLinkedListArrayParam = (name = "") => {
  const clean = name.toLowerCase();
  return clean === "lists" || clean.includes("listnodes") || clean.includes("linkedlists");
};

export const isTreeParam = (name = "") => {
  const clean = name.toLowerCase();
  return clean === "root" || clean.includes("treenode") || clean.includes("binarytree");
};

export const isTreeSerializationQuestion = (question) => {
  if (!question || !question.title) return false;
  return question.title === "Serialize and Deserialize Binary Tree";
};

export const isCycleQuestion = (question) => {
  if (!question || !question.problemStatement) return false;
  const lower = question.problemStatement.toLowerCase();
  return lower.includes("cycle") && lower.includes("linked list");
};

export const getQuestionTemplate = (question, language, fallbackCode) => {
  const langKey = getLanguageKey(language);
  return question?.codeTemplates?.[langKey] || question?.codeTemplate || fallbackCode || "";
};

export const parseInputsForParams = (inputStr, paramNames, question, methodName) => {
  const assignments = parseInputAssignments(inputStr);
  
  if (assignments.length === 1 && paramNames.length > 1 && assignments[0].name === null) {
      const valStr = assignments[0].val;
      let trimmed = valStr.trim();
      if (trimmed.startsWith("[") && trimmed.endsWith("]") && trimmed.includes(",")) {
          trimmed = trimmed.substring(1, trimmed.length - 1).trim();
          const items = [];
          let current = "";
          let depth = 0;
          for (let i = 0; i < trimmed.length; i++) {
              const c = trimmed[i];
              if (c === '[') depth++;
              else if (c === ']') depth--;
              if (c === ',' && depth === 0) {
                  items.push(current.trim());
                  current = "";
              } else {
                  current += c;
              }
          }
          if (current.trim()) items.push(current.trim());
          if (items.length === paramNames.length) {
              return items.map((val, idx) => ({ name: paramNames[idx], val }));
          }
      }
  }

  const parsed = new Array(paramNames.length).fill(null);
  let positionalIndex = 0;

  for (let i = 0; i < assignments.length; i++) {
    const a = assignments[i];
    if (a.name) {
      const idx = paramNames.indexOf(a.name);
      if (idx !== -1) {
        parsed[idx] = { name: a.name, val: a.val };
      } else {
        parsed.push({ name: a.name, val: a.val });
      }
    } else {
      while (positionalIndex < paramNames.length && parsed[positionalIndex] !== null) {
        positionalIndex++;
      }
      if (positionalIndex < paramNames.length) {
        parsed[positionalIndex] = { name: paramNames[positionalIndex], val: a.val };
        positionalIndex++;
      } else {
        parsed.push({ name: null, val: a.val });
      }
    }
  }

  for (let i = 0; i < parsed.length; i++) {
    if (parsed[i] === null) {
      if (i < paramNames.length) {
        parsed[i] = { name: paramNames[i], val: "null" };
      }
    }
  }

  return parsed;
};
