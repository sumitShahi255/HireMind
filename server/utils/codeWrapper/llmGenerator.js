import { askAi } from "../../services/groq.service.js";

export const generateWithLLM = async (code, language, input, question) => {
  let prompt = `You are a test-runner generator.
We have a user-submitted coding solution written in ${language}:
\`\`\`${language}
${code}
\`\`\`

The testcase input to parse/use is:
${input}

Please write a complete, self-contained, compilation-ready ${language} program.
Your code must:
1. You MUST place all necessary library imports at the VERY TOP of the generated file, ABSOLUTELY BEFORE any user code or classes. For C++, you MUST start your program exactly with '#include <bits/stdc++.h>' on the very first line, followed by 'using namespace std;' on the next line. This MUST be done before defining the user's class. For Java, import java.util.*, java.io.*, java.math.*, java.util.stream.*. For C, include <stdio.h>, <stdlib.h>, <string.h>, <math.h>, <limits.h>, <stdbool.h>, <ctype.h>, <assert.h>, <stddef.h>. For Python, import math, collections, heapq, bisect, typing, sys, re, itertools, functools, json.
2. Define the user's class(es)/methods below the imports and keep the user's implementation EXACTLY as is. You are STRICTLY FORBIDDEN from fixing, completing, or adding logic to the user's function. If their function is empty, leave it empty. DO NOT implement the solution for them. Do NOT wrap their code in an extra 'class Solution' if it doesn't already have one.
3. You MUST explicitly generate the main entry point to execute the code (e.g. if python: under \`if __name__ == '__main__':\`, if cpp/c: \`int main() { ... }\`, if javascript/node: main top-level execution block). Do not just output the user's class.
   - For Java, you MUST create a completely separate \`public class Main { public static void main(String[] args) { ... } }\`. Do NOT put the main method inside the user's class. Do NOT use any package declarations (e.g. \`package ...;\`).
   - For Java, if the user's code defines a public class (e.g. \`public class Solution\` or \`public class MedianFinder\`), you MUST remove the \`public\` modifier so it becomes package-private. This is because Java only allows one public class per file, which must be \`Main\`.
   - Do NOT read from standard input (stdin) using input(), sys.stdin, Scanner, cin, or readline.
   - Instead, directly initialize the input variable(s) with the parsed values representing the testcase input literal in the source code itself. IMPORTANT: When initializing arrays/vectors in C++, C, or Java that contain 'null' elements (e.g. for trees), you MUST replace 'null' with a sentinel integer like -2147483648, or use nullable types (like Integer[] in Java), to prevent compilation errors. Adjust your helper methods to check for this sentinel value.
   - If the input represents arrays, matrices, trees (level-order serialized), or linked lists, write helper code/functions to build the appropriate structures from the initialized literals. IMPORTANT FOR TREES: The tree input array uses LeetCode's level-order serialization. You MUST write a BFS (queue-based) tree builder. DO NOT use the simple 2*i+1 / 2*i+2 array index formula, as it is completely WRONG for LeetCode format (it fails when null nodes omit their children in the array). IMPORTANT: The system ALREADY provides the definitions for 'ListNode' and 'TreeNode' globally. You MUST NOT define 'ListNode' or 'TreeNode' yourself. To avoid compilation redefinition errors, you MUST completely REMOVE or COMMENT OUT any existing definitions of ListNode, TreeNode, or other helper structures from the user's submitted code in your final output. Just use them assuming they exist.
   - CRITICAL SYSTEM DIRECTIVE: If the target language is JavaScript or Python, you are STRICTLY FORBIDDEN from using C/C++/Java type declarations (like 'int', 'float', 'String', 'boolean'). You are STRICTLY FORBIDDEN from defining 'class ListNode' or 'class TreeNode' in your generated code. The system WILL CRASH if you write 'int val;' or define these classes. DO NOT DEFINE THEM. Assume they exist.
   - Instantiate the user's class (e.g. Solution, MedianFinder, etc.) / invoke the function with the initialized arguments.
   - Print the returned result to stdout. For list, arrays, or binary tree return values, format them stringified (e.g. print [1, 2], or true/false for booleans). IMPORTANT: Arrays and matrices MUST be printed as strictly JSON-formatted arrays with square brackets and commas (e.g., [[1,2],[3,4]]). DO NOT print space-separated elements. IMPORTANT: If the function is designed to modify an argument in-place (e.g. it returns void or None, or the problem statement specifies an in-place modification like Sort Colors), you MUST print the modified input array/argument to stdout instead of printing the None/void return value. For level-order serialized binary tree output lists, you MUST strip all trailing 'null'/'None' elements from the list before printing (e.g. print [4, 7, 2, 9, 6, 3, 1] instead of [4, 7, 2, 9, 6, 3, 1, null, null]).
   - IMPORTANT FOR CLASS DESIGN PROBLEMS: 
     - If the input consists of an array of method names (e.g., ["ClassName", "method1"]) and an array of arguments, you MUST instantiate the class, call each method in sequence, collect all return values into an array (use 'null' or 'None' for void/constructors), and print this array strictly formatted as a JSON array (e.g., [null, 10]).
     - However, if the input is just a comma-separated sequence of method calls (e.g., \`addNum(1),addNum(2),findMedian()\`), you MUST execute them in order and print ONLY the return value of the VERY LAST method call. Do NOT print an array in this case.
   - Do NOT print any extra description text to stdout (like "Output is:").

Return ONLY the raw source code of the complete program. Do not wrap in markdown or backticks. Do not include explanations.`;

  const messages = [{ role: "system", content: prompt }];
  const response = await askAi(messages, false);
  let cleanCode = response.trim();
  if (cleanCode.startsWith("```")) {
    const lines = cleanCode.split("\n");
    if (lines[0].startsWith("```")) {
      lines.shift();
    }
    if (lines.length > 0 && lines[lines.length - 1].startsWith("```")) {
      lines.pop();
    }
    cleanCode = lines.join("\n").trim();
  }
  cleanCode = cleanCode.replace(/^`+|`+$/g, "").trim();

  const lines = cleanCode.split("\n");
  if (lines.length > 0) {
    const firstLine = lines[0].trim().toLowerCase();
    if (
      firstLine === "python" ||
      firstLine === "javascript" ||
      firstLine === "js" ||
      firstLine === "java" ||
      firstLine === "cpp" ||
      firstLine === "c" ||
      firstLine === "c++"
    ) {
      lines.shift();
      cleanCode = lines.join("\n").trim();
    }
  }
  const strippedCode = cleanCode.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");

  const lang = (language || "").toLowerCase();
  if (lang.includes("c++") || lang.includes("cpp")) {
    const hasListNode = strippedCode.includes("struct ListNode") || strippedCode.includes("class ListNode");
    const hasTreeNode = strippedCode.includes("struct TreeNode") || strippedCode.includes("class TreeNode");
    
    let cppHeadersAndStructs = `#include <bits/stdc++.h>\nusing namespace std;\n\n#ifndef null\n#define null -2147483648\n#endif\n\n`;
    
    if (!hasListNode) {
      cppHeadersAndStructs += `struct ListNode {
    int val;
    ListNode *next;
    ListNode() : val(0), next(nullptr) {}
    ListNode(int x) : val(x), next(nullptr) {}
    ListNode(int x, ListNode *next) : val(x), next(next) {}
};

`;
    }
    
    if (!hasTreeNode) {
      cppHeadersAndStructs += `struct TreeNode {
    int val;
    TreeNode *left;
    TreeNode *right;
    TreeNode() : val(0), left(nullptr), right(nullptr) {}
    TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
    TreeNode(int x, TreeNode *left, TreeNode *right) : val(x), left(left), right(right) {}
};

`;
    }
    if (cleanCode.includes("<bits/stdc++.h>")) {
      cleanCode = cleanCode.replace(/#include\s*<bits\/stdc\+\+\.h>/g, "");
    }
    if (cleanCode.includes("using namespace std;")) {
      cleanCode = cleanCode.replace(/using\s+namespace\s+std;/g, "");
    }
    cleanCode = cppHeadersAndStructs + cleanCode.trim();
  } else if (lang.includes("java")) {
    const hasListNode = strippedCode.includes("class ListNode");
    const hasTreeNode = strippedCode.includes("class TreeNode");
    
    let javaStructs = "\n";
    
    if (!hasListNode) {
      javaStructs += `class ListNode {
    int val;
    ListNode next;
    ListNode() {}
    ListNode(int val) { this.val = val; }
    ListNode(int val, ListNode next) { this.val = val; this.next = next; }
}
`;
    }
    
    if (!hasTreeNode) {
      javaStructs += `class TreeNode {
    int val;
    TreeNode left;
    TreeNode right;
    TreeNode() {}
    TreeNode(int val) { this.val = val; }
    TreeNode(int val, TreeNode left, TreeNode right) {
        this.val = val;
        this.left = left;
        this.right = right;
    }
}
`;
    }
    cleanCode = cleanCode.trim() + javaStructs;
  } else if (lang === "c") {
    const hasListNode = strippedCode.includes("struct ListNode");
    const hasTreeNode = strippedCode.includes("struct TreeNode");
    
    let cStructs = `
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <limits.h>
#include <stdbool.h>
#include <ctype.h>
#include <assert.h>
#include <stddef.h>

#ifndef null
#define null -2147483648
#endif

`;
    
    if (!hasListNode) {
      cStructs += `struct ListNode {
    int val;
    struct ListNode *next;
};
`;
    }
    
    if (!hasTreeNode) {
      cStructs += `struct TreeNode {
    int val;
    struct TreeNode *left;
    struct TreeNode *right;
};
`;
    }
    cleanCode = cStructs + cleanCode.trim();
  } else if (lang.includes("javascript") || lang.includes("node") || lang === "js") {
    // Remove LLM hallucinated Java syntax
    cleanCode = cleanCode.replace(/\b(?:int|float|double|String|boolean)\s+[a-zA-Z0-9_]+\s*;/g, "");
    // Remove hallucinated classes so we don't redefine them
    cleanCode = cleanCode.replace(/class\s+ListNode\s*\{[^}]+\}/g, "");
    cleanCode = cleanCode.replace(/class\s+TreeNode\s*\{[^}]+\}/g, "");

    const jsStructs = `
function ListNode(val, next) {
    this.val = (val === undefined ? 0 : val);
    this.next = (next === undefined ? null : next);
}
function TreeNode(val, left, right) {
    this.val = (val === undefined ? 0 : val);
    this.left = (left === undefined ? null : left);
    this.right = (right === undefined ? null : right);
}
`;
    cleanCode = jsStructs + cleanCode.trim();
  } else if (lang.includes("python")) {
    cleanCode = cleanCode.replace(/class\s+ListNode\s*:[^}]+(?=class|def|if|$)/g, "");
    cleanCode = cleanCode.replace(/class\s+TreeNode\s*:[^}]+(?=class|def|if|$)/g, "");
    const pyStructs = `
class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right
`;
    cleanCode = pyStructs + cleanCode.trim();
  }

  return cleanCode;
};
