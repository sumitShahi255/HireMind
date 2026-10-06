export { encode, decode, normalize, normalizeOutput, parseInputAssignments } from "./helpers.js";
export { getLanguageId, IN_PLACE_METHODS, getLanguageKey } from "./constants.js";
export { getEffectiveLanguage, isLinkedListParam, isTreeParam, isCycleQuestion, getQuestionTemplate } from "./shared.js";

import { generateLocalWrapper } from "./localGenerator.js";
import { generateWithLLM } from "./llmGenerator.js";

export const wrapCodeForExecution = async (code, language, input, question) => {
  try {
    const localWrapper = generateLocalWrapper(code, language, input, question);
    if (localWrapper) {
      return localWrapper;
    }

    return await generateWithLLM(code, language, input, question);
  } catch (error) {
    console.error("wrapCodeForExecution failed, falling back to raw code:", error);
    return code;
  }
};
