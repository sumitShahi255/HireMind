import { generatePythonWrapper } from "./languages/python.js";
import { generateJSWrapper } from "./languages/javascript.js";
import { generateCppWrapper } from "./languages/cpp.js";
import { generateJavaWrapper } from "./languages/java.js";
import { generateCWrapper } from "./languages/c.js";

export const generateLocalWrapper = (code, language, input, question) => {
  const lang = (language || "").toLowerCase();
  const isPython = lang.includes("python");
  const isJS = /javascript|node\.?js|\bjs\b/i.test(lang);
  const isCpp = lang.includes("c++") || lang.includes("cpp");
  const isC = lang === "c" || lang === "c language";
  const isJava = lang.includes("java");

  if (!isPython && !isJS && !isCpp && !isJava && !isC) return null;

  try {
    if (isPython) return generatePythonWrapper(code, input, question, language);
    if (isJS) return generateJSWrapper(code, input, question, language);
    if (isCpp) return generateCppWrapper(code, input, question, language);
    if (isJava) return generateJavaWrapper(code, input, question, language);
    if (isC) return generateCWrapper(code, input, question, language);
  } catch (err) {
    console.error("generateLocalWrapper error, falling back to LLM:", err);
    return null;
  }
  return null;
};
