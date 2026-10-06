export const IN_PLACE_METHODS = [
  "sortcolors", "rotate", "movezeroes", "reversestring", "nextpermutation", "merge"
];

export const getLanguageId = (language) => {
  const cleanLang = (language || "").toLowerCase().trim();
  if (/javascript|node\.?js|\bjs\b/i.test(cleanLang)) return 63;
  if (cleanLang.includes("c++") || cleanLang.includes("cpp")) return 54;
  if (cleanLang.includes("java")) return 62;
  if (cleanLang === "c") return 50;
  if (cleanLang.includes("python")) return 71;
  return null;
};

export const getLanguageKey = (language) => {
  const lang = (language || "").toLowerCase();
  if (lang.includes("c++") || lang.includes("cpp")) return "cpp";
  if (lang === "c") return "c";
  if (lang.includes("java") && !lang.includes("javascript")) return "java";
  if (lang.includes("python")) return "python";
  if (lang.includes("javascript") || lang.includes("node") || lang === "js") return "javascript";
  return null;
};
