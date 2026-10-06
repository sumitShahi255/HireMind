export const encode = (str) =>
  Buffer.from(str || "").toString("base64");

export const decode = (str) =>
  str ? Buffer.from(str, "base64").toString() : "";

export const normalize = (value) =>
  String(value || "")
    .replace(/\r\n/g, "\n")
    .trim();

export const normalizeOutput = (str) => {
  let clean = normalize(str);
  if (!clean) return "";

  const tokens = [];
  clean = clean.replace(/(["'])(?:(?=(\\?))\2.)*?\1/g, (match) => {
    tokens.push(match.slice(1, -1)); 
    return `__STR_TOKEN_${tokens.length - 1}__`;
  });

  clean = clean.toLowerCase();
  clean = clean.replace(/\bnone\b/g, "null");
  clean = clean.replace(/\s+/g, "");

  clean = clean.replace(/(\.\d*?[1-9])0+(?=[^\d]|$)/g, '$1');
  clean = clean.replace(/\.0+(?=[^\d]|$)/g, '');

  tokens.forEach((token, idx) => {
    clean = clean.replace(`__str_token_${idx}__`, token);
  });

  if (clean.startsWith("[") && clean.endsWith("]")) {
    try {
      const content = clean.slice(1, -1);
      const items = content.split(",").map(item => item.trim());
      while (items.length > 0) {
        const last = items[items.length - 1];
        if (last === "null" || last === "") {
          items.pop();
        } else {
          break;
        }
      }
      return "[" + items.join(",") + "]";
    } catch (e) { }
  }

  return clean;
};

export const parseInputAssignments = (inputStr) => {
  let cleanInput = (inputStr || "").trim();

  try {
    const parsedArray = JSON.parse(cleanInput);
    if (Array.isArray(parsedArray)) {
      if (parsedArray.length === 1 && typeof parsedArray[0] === 'string' && parsedArray[0].includes('=')) {
        cleanInput = parsedArray[0];
      } else {
        return parsedArray.map((item) => {
          return { name: null, val: typeof item === 'object' ? JSON.stringify(item) : String(item) };
        });
      }
    }
  } catch (e) {
    if (cleanInput.startsWith('["') && cleanInput.endsWith('"]')) {
      cleanInput = cleanInput.substring(2, cleanInput.length - 2).trim();
    } else if (cleanInput.startsWith("['") && cleanInput.endsWith("']")) {
      cleanInput = cleanInput.substring(2, cleanInput.length - 2).trim();
    } else if (cleanInput.startsWith('[') && cleanInput.endsWith(']')) {
      const inner = cleanInput.substring(1, cleanInput.length - 1).trim();
      if ((inner.startsWith('"') && inner.endsWith('"')) || (inner.startsWith("'") && inner.endsWith("'"))) {
        cleanInput = inner.substring(1, inner.length - 1).trim();
      }
    }
  }

  const assignments = [];
  let bracketDepth = 0;
  let braceDepth = 0;
  let parenDepth = 0;
  let inDoubleQuote = false;
  let inSingleQuote = false;
  let current = "";
  
  for (let i = 0; i < cleanInput.length; i++) {
    const c = cleanInput[i];
    
    if (c === '"' && cleanInput[i - 1] !== '\\' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
    } else if (c === "'" && cleanInput[i - 1] !== '\\' && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
    }

    if (!inDoubleQuote && !inSingleQuote) {
      if (c === '[') bracketDepth++;
      else if (c === ']') bracketDepth--;
      else if (c === '{') braceDepth++;
      else if (c === '}') braceDepth--;
      else if (c === '(') parenDepth++;
      else if (c === ')') parenDepth--;
    }

    if ((c === ',' || c === '\n') && bracketDepth === 0 && braceDepth === 0 && parenDepth === 0 && !inDoubleQuote && !inSingleQuote) {
      if (current.trim()) assignments.push(current.trim());
      current = "";
    } else {
      current += c;
    }
  }
  if (current.trim()) {
    assignments.push(current.trim());
  }

  if (assignments.length === 1 && !assignments[0].includes('=')) {
    const text = assignments[0];
    if (text.includes(' ')) {
      const spaceSplit = [];
      let currentPart = "";
      let inDQ = false;
      let inSQ = false;
      let bDepth = 0;
      let braceDepth = 0;
      let pDepth = 0;
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === '"' && text[i - 1] !== '\\' && !inSQ) inDQ = !inDQ;
        else if (c === "'" && text[i - 1] !== '\\' && !inDQ) inSQ = !inSQ;
        if (!inDQ && !inSQ) {
          if (c === '[') bDepth++;
          else if (c === ']') bDepth--;
          else if (c === '{') braceDepth++;
          else if (c === '}') braceDepth--;
          else if (c === '(') pDepth++;
          else if (c === ')') pDepth--;
        }
        if (c === ' ' && bDepth === 0 && braceDepth === 0 && pDepth === 0 && !inDQ && !inSQ) {
          if (currentPart.trim()) spaceSplit.push(currentPart.trim());
          currentPart = "";
        } else {
          currentPart += c;
        }
      }
      if (currentPart.trim()) spaceSplit.push(currentPart.trim());
      if (spaceSplit.length > 1) {
        return spaceSplit.map(val => ({ name: null, val }));
      }
    }
  }

  const filtered = assignments.filter(a => a.length > 0);

  return filtered.map(a => {
    const eqIdx = a.indexOf('=');
    if (eqIdx !== -1) {
      const name = a.substring(0, eqIdx).trim();
      const val = a.substring(eqIdx + 1).trim();
      return { name, val };
    } else {
      return { name: null, val: a.trim() };
    }
  });
};
