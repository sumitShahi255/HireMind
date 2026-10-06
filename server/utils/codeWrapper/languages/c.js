import { IN_PLACE_METHODS } from "../constants.js";
import { getQuestionTemplate, parseInputsForParams, isLinkedListParam, isTreeParam, isCycleQuestion, isTreeSerializationQuestion } from "../shared.js";
import { parseInputAssignments } from "../helpers.js";

export const generateCWrapper = (code, input, question, language) => {
  let isClassDesign = false;
  let classMethods = [];
  let classArgs = [];
  const assignments = parseInputAssignments(input);
  if (assignments.length >= 2) {
      try {
          const p1 = JSON.parse(assignments[0].val);
          const p2 = JSON.parse(assignments[1].val);
          if (Array.isArray(p1) && Array.isArray(p2) && p1.length === p2.length && typeof p1[0] === 'string') {
              isClassDesign = true;
              classMethods = p1;
              classArgs = p2;
          }
      } catch(e) {}
  }
  const template = getQuestionTemplate(question, language, code);
  let methodName = null;
  let paramsStr = "";
  let returnType = "";
      
  const cRegexes = [
    /([a-zA-Z0-9_*\s]+?)\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*\{/g,
  ];

      const cFunctions = {};
      for (const regex of cRegexes) {
        const matches = [...template.matchAll(regex)];
        for (const m of matches) {
          const rType = m[1].trim();
          const name = m[2].trim();
          if (!["if", "for", "while", "switch", "return"].includes(name)) {
            const pStr = m[3] || "";
            const paramPairs = pStr.split(",").map(p => p.trim()).filter(p => p !== "");
            const paramTypes = paramPairs.map(p => p.replace(/\s+[a-zA-Z0-9_]+$/, "").trim());
            cFunctions[name.toLowerCase()] = { name, rType, paramTypes };
            
            if (!methodName) {
                returnType = rType;
                methodName = name;
                paramsStr = pStr;
            }
          }
        }
      }
      if (!methodName && !isClassDesign) return null;

      const paramPairs = paramsStr.split(",").map(p => p.trim()).filter(p => p !== "");
      
      // For C, if there are pointers or 'Size' arguments, local generation is incredibly complex
      // because JSON inputs don't map 1:1 to C function signatures (e.g., numsSize is missing in JSON).
      const hasPointers = paramPairs.some(p => p.includes("*"));
      const hasSizeArgs = paramPairs.some(p => p.toLowerCase().includes("size"));
      const returnPointer = returnType.includes("*");

      const isSerDeser = isTreeSerializationQuestion(question);

      if (!isClassDesign && !isSerDeser && (hasPointers || hasSizeArgs || returnPointer)) {
          return null; 
      }

      const paramNames = paramPairs.map(p => p.split(/\s+/).pop());
      const paramTypes = paramPairs.map(p => p.replace(/\s+[a-zA-Z0-9_]+$/, "").trim());

      const parsed = parseInputsForParams(input, paramNames, question, methodName);
      const callArgs = [];
      let declarations = "";

      const toCLiteral = (valStr, type) => {
        let s = (valStr || "").trim();
        if (s === "null") {
          if (type.includes("ListNode") || type.includes("TreeNode") || type.includes("*")) return "NULL";
          return "0";
        }
        if (s.startsWith("[")) {
          s = s.replace(/\[/g, "{").replace(/\]/g, "}");
          s = s.replace(/\bnull\b/g, "-2147483648"); 
          if (type.includes("char")) {
            s = s.replace(/"/g, "'");
          }
          return s;
        }
        if (type.includes("char") && s.startsWith('"') && s.endsWith('"') && s.length === 3) {
          return "'" + s.slice(1, -1) + "'";
        }
        if (s === "true") return "true";
        if (s === "false") return "false";
        return s;
      };

      if (!isClassDesign) {
          try {
            parsed.forEach((arg, idx) => {
              const varName = arg.name || paramNames[idx] || ("arg_" + idx);
              const type = paramTypes[idx] || "int";
              const val = toCLiteral(arg.val, type);
              if (isLinkedListParam(varName) || type.includes("ListNode")) {
                let safeVal = val;
                if (safeVal === "{}" || safeVal === "NULL") safeVal = "{0}"; 
                declarations += "    int " + varName + "_raw[] = " + safeVal + ";\n";
                declarations += "    int " + varName + "_size = " + (val === "{}" || val === "NULL" ? "0" : "sizeof(" + varName + "_raw)/sizeof(" + varName + "_raw[0])") + ";\n";
                declarations += "    struct ListNode* " + varName + " = buildList(" + varName + "_raw, " + varName + "_size);\n";
              } else if (isTreeParam(varName) || type.includes("TreeNode")) {
                let safeVal = val;
                if (safeVal === "{}" || safeVal === "NULL") safeVal = "{0}";
                declarations += "    int " + varName + "_raw[] = " + safeVal + ";\n";
                declarations += "    int " + varName + "_size = " + (val === "{}" || val === "NULL" ? "0" : "sizeof(" + varName + "_raw)/sizeof(" + varName + "_raw[0])") + ";\n";
                declarations += "    struct TreeNode* " + varName + " = buildTree(" + varName + "_raw, " + varName + "_size);\n";
              } else {
                declarations += "    " + type + " " + varName + " = " + val + ";\n";
              }
              callArgs.push(varName);
            });
          } catch (e) {
            return null;
          }

          for (let i = parsed.length; i < paramNames.length; i++) {
            const varName = paramNames[i];
            const type = paramTypes[i] || "int";
            declarations += "    " + type + " " + varName + " = 0;\n";
            callArgs.push(varName);
          }
      }

      let cCallLogic = "";
      if (isClassDesign) {
          let classTestCode = `    printf("[");\n`;
          let objType = "";
          let objVar = "obj";
          
          let constructorFunc = Object.values(cFunctions).find(f => f.name.toLowerCase().endsWith("create"));
          if (!constructorFunc && classMethods.length > 0) {
              constructorFunc = Object.values(cFunctions).find(f => f.name.toLowerCase().includes(classMethods[0].toLowerCase()));
          }
          
          if (constructorFunc) {
              objType = constructorFunc.rType;
              classTestCode = `    ${objType} ${objVar} = NULL;\n` + classTestCode;
          }
          
          for (let i = 0; i < classMethods.length; i++) {
              const method = classMethods[i];
              const args = classArgs[i];
              classTestCode += `    {\n`;
              
              if (i > 0) classTestCode += `        printf(",");\n`;
              
              let targetFunc = null;
              let mLower = method.toLowerCase();
              if (i === 0) {
                  targetFunc = constructorFunc;
              } else {
                  targetFunc = Object.values(cFunctions).find(f => f.name.toLowerCase().endsWith(mLower));
              }
              
              if (!targetFunc) {
                  classTestCode += `        printf("null");\n`;
                  classTestCode += `    }\n`;
                  continue;
              }
              
              let cArgs = [];
              if (i > 0) cArgs.push(`${objVar}`);
              
              for (let j = 0; j < args.length; j++) {
                  const typeIndex = (i === 0) ? j : j + 1;
                  const type = targetFunc.paramTypes[typeIndex] || "int";
                  const val = toCLiteral(JSON.stringify(args[j]), type);
                  const varName = `arg_${j}`;
                  classTestCode += `        ${type} ${varName} = ${val};\n`;
                  cArgs.push(varName);
              }
              
              if (i === 0) {
                  classTestCode += `        ${objVar} = ${targetFunc.name}(${cArgs.join(", ")});\n`;
                  classTestCode += `        printf("null");\n`;
              } else {
                  if (targetFunc.rType.includes("void")) {
                      classTestCode += `        ${targetFunc.name}(${cArgs.join(", ")});\n`;
                      classTestCode += `        printf("null");\n`;
                  } else if (targetFunc.rType.includes("double") || targetFunc.rType.includes("float")) {
                      classTestCode += `        printDouble((double)${targetFunc.name}(${cArgs.join(", ")}));\n`;
                  } else if (targetFunc.rType.includes("char") && targetFunc.rType.includes("*")) {
                      classTestCode += `        char* res = ${targetFunc.name}(${cArgs.join(", ")});\n`;
                      classTestCode += `        if (res == NULL) printf("null");\n`;
                      classTestCode += `        else printf("\\"%s\\"", res);\n`;
                  } else if (targetFunc.rType.includes("bool")) {
                      classTestCode += `        printf(${targetFunc.name}(${cArgs.join(", ")}) ? "true" : "false");\n`;
                  } else {
                      classTestCode += `        printf("%d", (int)${targetFunc.name}(${cArgs.join(", ")}));\n`;
                  }
              }
              classTestCode += `    }\n`;
          }
          classTestCode += `    printf("]\\n");\n`;
          
          const freeFunc = Object.values(cFunctions).find(f => f.name.toLowerCase().endsWith("free"));
          if (freeFunc) {
              classTestCode += `    ${freeFunc.name}(${objVar});\n`;
          }
          
          cCallLogic = classTestCode;
      } else if (isSerDeser) {
          const firstArg = callArgs[0] || "NULL";
          cCallLogic = `    char* serialized = serialize(${firstArg});\n    struct TreeNode* ans = deserialize(serialized);\n    stringifyTree(ans);\n`;
      } else {
          const voidCall = methodName + "(" + callArgs.join(', ') + ");\n    printf(\"[]\\\\n\");";
          const returnCall = returnType + " result = " + methodName + "(" + callArgs.join(', ') + ");\n" +
            "    if (sizeof(result) == sizeof(double) || sizeof(result) == sizeof(float)) {\n" +
            "        printDouble((double)result);\n        printf(\"\\\\n\");\n" +
            "    } else {\n" +
            "        printf(\"%d\\\\n\", (int)result);\n" +
            "    }";
          const isInPlace = IN_PLACE_METHODS.includes(methodName?.toLowerCase() || "") || 
            returnType.includes("void") ||
            question?.problemStatement?.toLowerCase().includes("in-place");
          cCallLogic = isInPlace ? voidCall : returnCall;
      }

      const strippedCode = code.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");
      const hasListNode = /struct\s+ListNode\s*\{/.test(strippedCode);
      const hasTreeNode = /struct\s+TreeNode\s*\{/.test(strippedCode);

      const cListNode = "struct ListNode {\n" +
                        "    int val;\n" +
                        "    struct ListNode *next;\n" +
                        "};\n";

      const cTreeNode = "struct TreeNode {\n" +
                        "    int val;\n" +
                        "    struct TreeNode *left;\n" +
                        "    struct TreeNode *right;\n" +
                        "};\n";

      const wrapper = `
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>
#include <limits.h>
#include <math.h>

${hasListNode ? "" : cListNode}
${hasTreeNode ? "" : cTreeNode}

struct ListNode* buildList(int* arr, int size) {
    if (size == 0) return NULL;
    struct ListNode* head = (struct ListNode*)malloc(sizeof(struct ListNode));
    head->val = arr[0]; head->next = NULL;
    struct ListNode* curr = head;
    for (int i = 1; i < size; i++) {
        curr->next = (struct ListNode*)malloc(sizeof(struct ListNode));
        curr->next->val = arr[i]; curr->next->next = NULL;
        curr = curr->next;
    }
    return head;
}

struct TreeNode* buildTree(int* arr, int size) {
    if (size == 0 || arr[0] == -2147483648) return NULL;
    struct TreeNode* root = (struct TreeNode*)malloc(sizeof(struct TreeNode));
    root->val = arr[0]; root->left = NULL; root->right = NULL;
    struct TreeNode** queue = (struct TreeNode**)malloc((size + 1) * sizeof(struct TreeNode*));
    int head = 0, tail = 0;
    queue[tail++] = root;
    int i = 1;
    while (head < tail && i < size) {
        struct TreeNode* curr = queue[head++];
        if (curr != NULL) {
            if (i < size && arr[i] != -2147483648) {
                curr->left = (struct TreeNode*)malloc(sizeof(struct TreeNode));
                curr->left->val = arr[i]; curr->left->left = NULL; curr->left->right = NULL;
                queue[tail++] = curr->left;
            }
            i++;
            if (i < size && arr[i] != -2147483648) {
                curr->right = (struct TreeNode*)malloc(sizeof(struct TreeNode));
                curr->right->val = arr[i]; curr->right->left = NULL; curr->right->right = NULL;
                queue[tail++] = curr->right;
            }
            i++;
        }
    }
    free(queue);
    return root;
}

void stringifyTree(struct TreeNode* root) {
    if (!root) {
        printf("[]\\n");
        return;
    }
    int capacity = 10000;
    struct TreeNode** queue = (struct TreeNode**)malloc(capacity * sizeof(struct TreeNode*));
    int head = 0, tail = 0;
    queue[tail++] = root;
    
    int* res = (int*)malloc(capacity * sizeof(int));
    int res_size = 0;
    
    while (head < tail) {
        struct TreeNode* curr = queue[head++];
        if (curr) {
            res[res_size++] = curr->val;
            queue[tail++] = curr->left;
            queue[tail++] = curr->right;
        } else {
            res[res_size++] = -2147483648;
        }
    }
    
    while (res_size > 0 && res[res_size - 1] == -2147483648) {
        res_size--;
    }
    
    printf("[");
    for (int i = 0; i < res_size; i++) {
        if (res[i] == -2147483648) printf("null");
        else printf("%d", res[i]);
        if (i < res_size - 1) printf(",");
    }
    printf("]\\n");
    free(queue);
    free(res);
}

void printDouble(double d) {
    char buf[100];
    snprintf(buf, sizeof(buf), "%.5f", d);
    int len = strlen(buf);
    while(len > 0 && buf[len-1] == '0') {
        buf[len-1] = '\\0';
        len--;
    }
    if (len > 0 && buf[len-1] == '.') {
        buf[len] = '0';
        buf[len+1] = '\\0';
    }
    printf("%s", buf);
}

${code}

int main() {
${declarations}
${cCallLogic}
    return 0;
}
`;
  return wrapper.trim();
};