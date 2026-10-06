import { IN_PLACE_METHODS } from "../constants.js";
import { getQuestionTemplate, parseInputsForParams, isLinkedListParam, isLinkedListArrayParam, isTreeParam, isCycleQuestion, isTreeSerializationQuestion } from "../shared.js";
import { parseInputAssignments } from "../helpers.js";

export const generateCppWrapper = (code, input, question, language) => {
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
      
      const cppRegexes = [
        /(?:virtual\s+)?([a-zA-Z0-9_<>:,\s*&]+?)\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*(?:const)?\s*\{/g,
      ];
      
      const classMethodSignatures = {};
      for (const regex of cppRegexes) {
        const matches = [...template.matchAll(regex)];
        for (const m of matches) {
          const rType = m[1].trim();
          if (rType === "," || rType.endsWith(",")) continue;
          
          const name = m[2].trim();
          if (!["public", "private", "class", "struct", "if", "for", "while", "switch"].includes(name)) {
            const pStr = m[3] || "";
            const paramPairs = pStr.split(",").map(p => p.trim()).filter(p => p !== "");
            const paramTypes = paramPairs.map(p => p.replace(/\s+[a-zA-Z0-9_]+$/, "").replace(/&/g, "").trim());
            classMethodSignatures[name] = { returnType: rType, paramTypes };
            
            if (!methodName && rType !== "") {
              returnType = rType;
              methodName = name;
              paramsStr = pStr;
            }
          }
        }
      }
      if (!methodName && !isClassDesign) return null;

      const toCppLiteral = (valStr, type) => {
        let s = (valStr || "").trim();
        if (s === "null") {
          if (type.includes("ListNode") || type.includes("TreeNode")) return "nullptr";
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
          return `'${s.slice(1, -1)}'`;
        }
        return s;
      };

      const paramPairs = paramsStr.split(",").map(p => p.trim()).filter(p => p !== "");
      const paramNames = paramPairs.map(p => p.split(/\s+/).pop().replace(/^[*&]+/, ""));
      const paramTypes = paramPairs.map(p => p.replace(/\s+[a-zA-Z0-9_]+$/, "").replace(/&/g, "").trim());

      const parsed = parseInputsForParams(input, paramNames, question, methodName);
      const callArgs = [];
      let declarations = "";

      if (!isClassDesign) {
          try {
            parsed.forEach((arg, idx) => {
              const varName = arg.name || paramNames[idx] || `arg_${idx}`;
              const type = paramTypes[idx] || "auto";
              const val = toCppLiteral(arg.val, type);
              
              if (isLinkedListArrayParam(varName) || type.includes("vector<ListNode*>")) {
                declarations += `    vector<vector<int>> ${varName}_raw = ${val};\n`;
                declarations += `    vector<ListNode*> ${varName};\n`;
                declarations += `    for (auto& arr : ${varName}_raw) {\n`;
                declarations += `        ${varName}.push_back(buildList(arr));\n`;
                declarations += `    }\n`;
              } else if (isLinkedListParam(varName) || type.includes("ListNode")) {
                declarations += `    vector<int> ${varName}_raw = ${val};\n`;
                declarations += `    ListNode* ${varName} = buildList(${varName}_raw);\n`;
              } else if (isTreeParam(varName) || type.includes("TreeNode")) {
                declarations += `    vector<int> ${varName}_raw = ${val};\n`;
                declarations += `    TreeNode* ${varName} = buildTree(${varName}_raw);\n`;
              } else {
                declarations += `    ${type} ${varName} = ${val};\n`;
              }
              callArgs.push(varName);
            });
          } catch (e) {
            return null;
          }

          for (let i = parsed.length; i < paramNames.length; i++) {
            const varName = paramNames[i];
            const type = paramTypes[i] || "auto";
            declarations += `    ${type} ${varName};\n`;
            callArgs.push(varName);
          }
      }

      const isInPlace = IN_PLACE_METHODS.includes(methodName?.toLowerCase() || "") || 
        returnType.includes("void") ||
        question?.problemStatement?.toLowerCase().includes("in-place");
      const firstArg = callArgs[0] || "nullptr";

      const strippedCode = code.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");
      const hasListNode = strippedCode.includes("struct ListNode") || strippedCode.includes("class ListNode");
      const hasTreeNode = strippedCode.includes("struct TreeNode") || strippedCode.includes("class TreeNode");

      const isSerDeser = isTreeSerializationQuestion(question);
      let cppCallLogic = "";
      if (isClassDesign) {
          let classTestCode = `    string __res_str = "[";\n`;
          let objName = "obj";
          classTestCode += `    ${classMethods[0]}* ${objName} = nullptr;\n`;
          for (let i = 0; i < classMethods.length; i++) {
             const method = classMethods[i];
             const args = classArgs[i];
             classTestCode += `    {\n`;
             
             if (i > 0) classTestCode += `        __res_str += ",";\n`;
             
             const sig = classMethodSignatures[method] || { returnType: "void", paramTypes: [] };
             let cArgs = [];
             
             for (let j = 0; j < args.length; j++) {
                 const type = sig.paramTypes[j] || "auto";
                 const val = toCppLiteral(JSON.stringify(args[j]), type);
                 const varName = `arg_${j}`;
                 
                 if (type.includes("vector<ListNode*>")) {
                     classTestCode += `        vector<vector<int>> ${varName}_raw = ${val};\n`;
                     classTestCode += `        vector<ListNode*> ${varName};\n`;
                     classTestCode += `        for (auto& arr : ${varName}_raw) { ${varName}.push_back(buildList(arr)); }\n`;
                 } else if (type.includes("ListNode")) {
                     classTestCode += `        vector<int> ${varName}_raw = ${val};\n`;
                     classTestCode += `        ListNode* ${varName} = buildList(${varName}_raw);\n`;
                 } else if (type.includes("TreeNode")) {
                     classTestCode += `        vector<int> ${varName}_raw = ${val};\n`;
                     classTestCode += `        TreeNode* ${varName} = buildTree(${varName}_raw);\n`;
                 } else {
                     classTestCode += `        ${type} ${varName} = ${val};\n`;
                 }
                 cArgs.push(varName);
             }
             
             if (i === 0) {
                 classTestCode += `        ${objName} = new ${method}(${cArgs.join(", ")});\n`;
                 classTestCode += `        __res_str += "null";\n`;
             } else {
                 if (sig.returnType.includes("void")) {
                     classTestCode += `        ${objName}->${method}(${cArgs.join(", ")});\n`;
                     classTestCode += `        __res_str += "null";\n`;
                 } else {
                     classTestCode += `        __res_str += stringify(${objName}->${method}(${cArgs.join(", ")}));\n`;
                 }
             }
             classTestCode += `    }\n`;
          }
          classTestCode += `    __res_str += "]";\n`;
          classTestCode += `    cout << __res_str << endl;\n`;
          cppCallLogic = classTestCode;
      } else if (isSerDeser) {
          cppCallLogic = `    Codec ser;\n    Codec deser;\n    TreeNode* ans = deser.deserialize(ser.serialize(${firstArg}));\n    cout << stringify(ans) << endl;\n`;
      } else {
          cppCallLogic = isInPlace ? 
              `    Solution sol;\n    sol.${methodName}(${callArgs.join(', ')});\n    cout << stringify(${firstArg}) << endl;\n` :
              `    Solution sol;\n    auto result = sol.${methodName}(${callArgs.join(', ')});\n    cout << stringify(result) << endl;\n`;
      }

      const cppListNode = "struct ListNode {\n" +
                          "    int val;\n" +
                          "    ListNode *next;\n" +
                          "    ListNode() : val(0), next(nullptr) {}\n" +
                          "    ListNode(int x) : val(x), next(nullptr) {}\n" +
                          "    ListNode(int x, ListNode *next) : val(x), next(next) {}\n" +
                          "};\n";

      const cppTreeNode = "struct TreeNode {\n" +
                          "    int val;\n" +
                          "    TreeNode *left;\n" +
                          "    TreeNode *right;\n" +
                          "    TreeNode() : val(0), left(nullptr), right(nullptr) {}\n" +
                          "    TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}\n" +
                          "    TreeNode(int x, TreeNode *left, TreeNode *right) : val(x), left(left), right(right) {}\n" +
                          "};\n";

      const wrapper = `
#include <bits/stdc++.h>
using namespace std;

${hasListNode ? "" : cppListNode}

${hasTreeNode ? "" : cppTreeNode}

ListNode* buildList(vector<int>& arr) {
    if (arr.empty()) return nullptr;
    ListNode* head = new ListNode(arr[0]);
    ListNode* curr = head;
    for (size_t i = 1; i < arr.size(); i++) {
        curr->next = new ListNode(arr[i]);
        curr = curr->next;
    }
    return head;
}

TreeNode* buildTree(vector<int>& arr) {
    if (arr.empty()) return nullptr;
    TreeNode* root = new TreeNode(arr[0]);
    queue<TreeNode*> q;
    q.push(root);
    size_t i = 1;
    while (!q.empty() && i < arr.size()) {
        TreeNode* curr = q.front();
        q.pop();
        if (curr) {
            if (i < arr.size() && arr[i] != -2147483648) {
                curr->left = new TreeNode(arr[i]);
                q.push(curr->left);
            }
            i++;
            if (i < arr.size() && arr[i] != -2147483648) {
                curr->right = new TreeNode(arr[i]);
                q.push(curr->right);
            }
            i++;
        }
    }
    return root;
}

string stringify(ListNode* head) {
    string res = "[";
    ListNode* curr = head;
    while (curr) {
        res += to_string(curr->val);
        if (curr->next) res += ",";
        curr = curr->next;
    }
    res += "]";
    return res;
}

string stringify(TreeNode* root) {
    if (!root) return "[]";
    vector<string> res;
    queue<TreeNode*> q;
    q.push(root);
    while (!q.empty()) {
        TreeNode* curr = q.front();
        q.pop();
        if (curr) {
            res.push_back(to_string(curr->val));
            q.push(curr->left);
            q.push(curr->right);
        } else {
            res.push_back("null");
        }
    }
    while (!res.empty() && res.back() == "null") {
        res.pop_back();
    }
    string s = "[";
    for (size_t i = 0; i < res.size(); i++) {
        s += res[i];
        if (i < res.size() - 1) s += ",";
    }
    s += "]";
    return s;
}

template<typename T>
string stringify(vector<T>& arr) {
    string res = "[";
    for (size_t i = 0; i < arr.size(); i++) {
        res += stringify(arr[i]); 
        if (i < arr.size() - 1) res += ",";
    }
    res += "]";
    return res;
}

template<>
string stringify(vector<int>& arr) {
    string res = "[";
    for (size_t i = 0; i < arr.size(); i++) {
        res += to_string(arr[i]);
        if (i < arr.size() - 1) res += ",";
    }
    res += "]";
    return res;
}

template<>
string stringify(vector<string>& arr) {
    string res = "[";
    for (size_t i = 0; i < arr.size(); i++) {
        res += "\\\"" + arr[i] + "\\\"";
        if (i < arr.size() - 1) res += ",";
    }
    res += "]";
    return res;
}

template<typename T>
string stringify(T val) {
    return to_string(val);
}

string stringify(double val) {
    string s = to_string(val);
    s.erase(s.find_last_not_of('0') + 1, string::npos);
    if (s.back() == '.') s += "0";
    return s;
}

string stringify(float val) {
    return stringify((double)val);
}

template<>
string stringify(string val) {
    return "\\\"" + val + "\\\"";
}

template<>
string stringify(bool val) {
    return val ? "true" : "false";
}

${code}

int main() {
${declarations}
${cppCallLogic}
    return 0;
}
`;
  return wrapper.trim();
};