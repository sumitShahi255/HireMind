import { IN_PLACE_METHODS } from "../constants.js";
import { getQuestionTemplate, parseInputsForParams, isLinkedListParam, isLinkedListArrayParam, isTreeParam, isCycleQuestion, isTreeSerializationQuestion } from "../shared.js";
import { parseInputAssignments } from "../helpers.js";

export const generateJavaWrapper = (code, input, question, language) => {
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
      
      const javaRegexes = [
        /(?:public\s+|private\s+|protected\s+|static\s+)*([a-zA-Z0-9_<>[\],\s]+?)\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*\{/g,
      ];
      
      const classMethodSignatures = {};
      for (const regex of javaRegexes) {
        const matches = [...template.matchAll(regex)];
        for (const m of matches) {
          let rType = m[1].trim();
          const name = m[2].trim();
          
          rType = rType.replace(/^(?:(?:public|private|protected|static)\b\s*)+/g, "").trim();

          if (!["class", "interface", "if", "for", "while", "switch"].includes(name)) {
            const pStr = m[3] || "";
            const paramPairs = pStr.split(",").map(p => p.trim()).filter(p => p !== "");
            const paramTypes = paramPairs.map(p => p.replace(/\s+[a-zA-Z0-9_]+$/, "").trim());
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

      const toJavaLiteral = (valStr, type) => {
        let s = (valStr || "").trim();
        if (s === "null") {
          if (type === "int" || type === "long" || type === "double" || type === "float" || type === "short" || type === "byte") return "0";
          if (type === "boolean") return "false";
          if (type === "char") return "'\\0'";
          return "null";
        }
        if (s.startsWith("[")) {
          s = s.replace(/\[/g, "{").replace(/\]/g, "}");
          
          if (type.includes("List")) {
             throw new Error("Java List literals too complex, fallback to LLM");
          }
          if (type.includes("TreeNode")) {
            s = s.replace(/\bnull\b/g, "null"); 
            return `new Integer[] ${s}`; 
          }
          if (type.includes("ListNode")) {
            if (type.includes("[]")) {
              return `new int[][] ${s}`;
            }
            return `new int[] ${s}`;
          }
          const baseType = type.replace(/\[\]/g, "");
          let brackets = type.match(/\[\]/g);
          let arraySuffix = brackets ? brackets.join("") : "[]";
          return `new ${baseType}${arraySuffix} ${s}`;
        }
        if (type.includes("char") && s.startsWith('"') && s.endsWith('"') && s.length === 3) {
          return `'${s.slice(1, -1)}'`;
        }
        if (type.includes("float")) return `${s}f`;
        if (type.includes("long")) {
           if (!s.endsWith("L") && !s.endsWith("l")) return `${s}L`;
        }
        return s;
      };

      const paramPairs = paramsStr.split(",").map(p => p.trim()).filter(p => p !== "");
      const paramNames = paramPairs.map(p => p.split(/\s+/).pop());
      const paramTypes = paramPairs.map(p => p.replace(/\s+[a-zA-Z0-9_]+$/, "").trim());

      const parsed = parseInputsForParams(input, paramNames, question, methodName);
      const callArgs = [];
      let declarations = "";

      if (!isClassDesign) {
          try {
            parsed.forEach((arg, idx) => {
              const varName = arg.name || paramNames[idx] || `arg_${idx}`;
              const type = paramTypes[idx] || "Object";
              const val = toJavaLiteral(arg.val, type);
              
              if (isLinkedListArrayParam(varName) || type.includes("ListNode[]")) {
                declarations += `        int[][] ${varName}_raw = ${val};\n`;
                declarations += `        ListNode[] ${varName} = new ListNode[${varName}_raw != null ? ${varName}_raw.length : 0];\n`;
                declarations += `        if (${varName}_raw != null) {\n`;
                declarations += `            for (int _i = 0; _i < ${varName}_raw.length; _i++) {\n`;
                declarations += `                ${varName}[_i] = buildList(${varName}_raw[_i]);\n`;
                declarations += `            }\n`;
                declarations += `        }\n`;
              } else if (isLinkedListParam(varName) || type.includes("ListNode")) {
                declarations += `        int[] ${varName}_raw = ${val};\n`;
                declarations += `        ListNode ${varName} = buildList(${varName}_raw);\n`;
              } else if (isTreeParam(varName) || type.includes("TreeNode")) {
                declarations += `        Integer[] ${varName}_raw = ${val};\n`;
                declarations += `        TreeNode ${varName} = buildTree(${varName}_raw);\n`;
              } else {
                declarations += `        ${type} ${varName} = ${val};\n`;
              }
              callArgs.push(varName);
            });
          } catch(e) {
            return null;
          }

          for (let i = parsed.length; i < paramNames.length; i++) {
            const varName = paramNames[i];
            const type = paramTypes[i] || "Object";
            declarations += `        ${type} ${varName} = null;\n`;
            callArgs.push(varName);
          }
      }

      const isInPlace = IN_PLACE_METHODS.includes(methodName?.toLowerCase() || "") || 
        returnType.includes("void") ||
        question?.problemStatement?.toLowerCase().includes("in-place");
      const firstArg = callArgs[0] || "null";

      const strippedCode = code.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");
      const hasListNode = strippedCode.includes("class ListNode");
      const hasTreeNode = strippedCode.includes("class TreeNode");

      const isSerDeser = isTreeSerializationQuestion(question);
      let javaCallLogic = "";
      if (isClassDesign) {
          let classTestCode = `        StringBuilder __res_sb = new StringBuilder("[");\n`;
          let objName = "obj";
          classTestCode += `        ${classMethods[0]} ${objName} = null;\n`;
          for (let i = 0; i < classMethods.length; i++) {
             const method = classMethods[i];
             const args = classArgs[i];
             classTestCode += `        {\n`;
             
             if (i > 0) classTestCode += `            __res_sb.append(",");\n`;
             
             const sig = classMethodSignatures[method] || { returnType: "void", paramTypes: [] };
             let cArgs = [];
             
             for (let j = 0; j < args.length; j++) {
                 const type = sig.paramTypes[j] || "Object";
                 const val = toJavaLiteral(JSON.stringify(args[j]), type);
                 const varName = `arg_${j}`;
                 
                 if (type.includes("ListNode[]")) {
                     classTestCode += `            int[][] ${varName}_raw = ${val};\n`;
                     classTestCode += `            ListNode[] ${varName} = new ListNode[${varName}_raw != null ? ${varName}_raw.length : 0];\n`;
                     classTestCode += `            if (${varName}_raw != null) {\n`;
                     classTestCode += `                for (int _i = 0; _i < ${varName}_raw.length; _i++) {\n`;
                     classTestCode += `                    ${varName}[_i] = buildList(${varName}_raw[_i]);\n`;
                     classTestCode += `                }\n`;
                     classTestCode += `            }\n`;
                 } else if (type.includes("ListNode")) {
                     classTestCode += `            int[] ${varName}_raw = ${val};\n`;
                     classTestCode += `            ListNode ${varName} = buildList(${varName}_raw);\n`;
                 } else if (type.includes("TreeNode")) {
                     classTestCode += `            Integer[] ${varName}_raw = ${val};\n`;
                     classTestCode += `            TreeNode ${varName} = buildTree(${varName}_raw);\n`;
                 } else {
                     classTestCode += `            ${type} ${varName} = ${val};\n`;
                 }
                 cArgs.push(varName);
             }
             
             if (i === 0) {
                 classTestCode += `            ${objName} = new ${method}(${cArgs.join(", ")});\n`;
                 classTestCode += `            __res_sb.append("null");\n`;
             } else {
                 if (sig.returnType.includes("void")) {
                     classTestCode += `            ${objName}.${method}(${cArgs.join(", ")});\n`;
                     classTestCode += `            __res_sb.append("null");\n`;
                 } else {
                     classTestCode += `            __res_sb.append(stringify(${objName}.${method}(${cArgs.join(", ")})));\n`;
                 }
             }
             classTestCode += `        }\n`;
          }
          classTestCode += `        __res_sb.append("]");\n`;
          classTestCode += `        System.out.println(__res_sb.toString());\n`;
          javaCallLogic = classTestCode;
      } else if (isSerDeser) {
          javaCallLogic = `        Codec ser = new Codec();\n        Codec deser = new Codec();\n        TreeNode ans = deser.deserialize(ser.serialize(${firstArg}));\n        System.out.println(stringify(ans));\n`;
      } else {
          javaCallLogic = isInPlace ? 
              `        Solution sol = new Solution();\n        sol.${methodName}(${callArgs.join(', ')});\n        System.out.println(stringify(${firstArg}));\n` :
              `        Solution sol = new Solution();\n        Object result = sol.${methodName}(${callArgs.join(', ')});\n        System.out.println(stringify(result));\n`;
      }

      const javaListNode = "class ListNode {\n" +
                           "    int val;\n" +
                           "    ListNode next;\n" +
                           "    ListNode() {}\n" +
                           "    ListNode(int val) { this.val = val; }\n" +
                           "    ListNode(int val, ListNode next) { this.val = val; this.next = next; }\n" +
                           "}\n";

      const javaTreeNode = "class TreeNode {\n" +
                           "    int val;\n" +
                           "    TreeNode left;\n" +
                           "    TreeNode right;\n" +
                           "    TreeNode() {}\n" +
                           "    TreeNode(int val) { this.val = val; }\n" +
                           "    TreeNode(int val, TreeNode left, TreeNode right) {\n" +
                           "        this.val = val;\n" +
                           "        this.left = left;\n" +
                           "        this.right = right;\n" +
                           "    }\n" +
                           "}\n";

      let processedCode = code.replace(/^\s*import\s+[\w\.\*]+;\s*$/gm, '');
      if (isSerDeser) {
          processedCode = processedCode.replace(/(?<!static\s+)(?:public\s+)?class\s+Codec\b/g, 'static class Codec');
          processedCode = processedCode.replace(/(?<!static\s+)(?:public\s+)?class\s+TreeNode\b/g, 'static class TreeNode');
      } else if (isClassDesign && classMethods.length > 0) {
          const className = classMethods[0];
          processedCode = processedCode.replace(new RegExp(`(?<!static\\s+)(?:public\\s+)?class\\s+${className}\\b`), `static class ${className}`);
      } else {
          processedCode = processedCode.replace(/(?<!static\s+)(?:public\s+)?class\s+Solution\b/, 'static class Solution');
      }

      const wrapper = `
import java.util.*;
import java.io.*;
import java.math.*;

${hasListNode ? "" : javaListNode}

${hasTreeNode ? "" : javaTreeNode}

public class Main {
    public static ListNode buildList(int[] arr) {
        if (arr == null || arr.length == 0) return null;
        ListNode head = new ListNode(arr[0]);
        ListNode curr = head;
        for (int i = 1; i < arr.length; i++) {
            curr.next = new ListNode(arr[i]);
            curr = curr.next;
        }
        return head;
    }

    public static TreeNode buildTree(Integer[] arr) {
        if (arr == null || arr.length == 0 || arr[0] == null) return null;
        TreeNode root = new TreeNode(arr[0]);
        Queue<TreeNode> q = new LinkedList<>();
        q.add(root);
        int i = 1;
        while (!q.isEmpty() && i < arr.length) {
            TreeNode curr = q.poll();
            if (curr != null) {
                if (i < arr.length && arr[i] != null) {
                    curr.left = new TreeNode(arr[i]);
                    q.add(curr.left);
                }
                i++;
                if (i < arr.length && arr[i] != null) {
                    curr.right = new TreeNode(arr[i]);
                    q.add(curr.right);
                }
                i++;
            }
        }
        return root;
    }

    public static String stringify(ListNode head) {
        if (head == null) return "[]";
        StringBuilder sb = new StringBuilder();
        sb.append("[");
        ListNode curr = head;
        while (curr != null) {
            sb.append(curr.val);
            if (curr.next != null) sb.append(",");
            curr = curr.next;
        }
        sb.append("]");
        return sb.toString();
    }

    public static String stringify(TreeNode root) {
        if (root == null) return "[]";
        List<String> res = new ArrayList<>();
        Queue<TreeNode> q = new LinkedList<>();
        q.add(root);
        while (!q.isEmpty()) {
            TreeNode curr = q.poll();
            if (curr != null) {
                res.add(String.valueOf(curr.val));
                q.add(curr.left);
                q.add(curr.right);
            } else {
                res.add("null");
            }
        }
        while (res.size() > 0 && res.get(res.size() - 1).equals("null")) {
            res.remove(res.size() - 1);
        }
        return "[" + String.join(",", res) + "]";
    }

    public static String stringify(Object obj) {
        if (obj == null) return "null";
        if (obj instanceof String) return "\\\"" + obj + "\\\"";
        if (obj instanceof ListNode) return stringify((ListNode) obj);
        if (obj instanceof TreeNode) return stringify((TreeNode) obj);
        if (obj.getClass().isArray()) {
            if (obj instanceof int[]) return Arrays.toString((int[]) obj).replace(" ", "");
            if (obj instanceof double[]) return Arrays.toString((double[]) obj).replace(" ", "");
            if (obj instanceof boolean[]) return Arrays.toString((boolean[]) obj).replace(" ", "");
            if (obj instanceof char[]) return Arrays.toString((char[]) obj).replace(" ", "");
            if (obj instanceof long[]) return Arrays.toString((long[]) obj).replace(" ", "");
            if (obj instanceof int[][]) return Arrays.deepToString((Object[]) obj).replace(" ", "");
            if (obj instanceof String[]) {
                String[] arr = (String[]) obj;
                List<String> res = new ArrayList<>();
                for (String s : arr) res.add("\\\"" + s + "\\\"");
                return "[" + String.join(",", res) + "]";
            }
            return Arrays.deepToString((Object[]) obj).replace(" ", "");
        }
        return obj.toString();
    }

${processedCode}

    public static void main(String[] args) {
${declarations}
${javaCallLogic}
    }
}
`;
  return wrapper.trim();
};