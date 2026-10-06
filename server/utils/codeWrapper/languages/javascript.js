import { IN_PLACE_METHODS } from "../constants.js";
import { getQuestionTemplate, parseInputsForParams, isLinkedListParam, isLinkedListArrayParam, isTreeParam, isCycleQuestion, isTreeSerializationQuestion } from "../shared.js";
import { parseInputAssignments } from "../helpers.js";

export const generateJSWrapper = (code, input, question, language) => {
  const template = getQuestionTemplate(question, language, code);
      let methodName = null;
      let paramsStr = "";
      
      const jsRegexes = [
        /(?:^|\s+)(?!if|for|while|switch|catch|function)(?:async\s+|static\s+|private\s+|public\s+)?([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*\{/g,
        /([a-zA-Z0-9_]+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>/g,
        /([a-zA-Z0-9_]+)\s*=\s*(?:async\s+)?([a-zA-Z0-9_]+)\s*=>/g,
        /([a-zA-Z0-9_]+)\s*=\s*(?:async\s+)?function\s*\(([^)]*)\)/g,
        /function\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/g
      ];

      const cleanTemplate = template.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");
      for (const regex of jsRegexes) {
        const matches = [...cleanTemplate.matchAll(regex)];
        for (const m of matches) {
          const name = m[1];
          if (!["constructor", "if", "for", "while", "switch", "catch", "TreeNode", "ListNode"].includes(name)) {
            methodName = name;
            paramsStr = m[2] || "";
            break;
          }
        }
        if (methodName) break;
      }

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

      if (!methodName && !isClassDesign) return null;

      const callArgs = [];
      let declarations = "";
      let cyclePosName = null;
      let isInPlace = false;
      let firstArg = "null";

      if (!isClassDesign) {
          const paramNames = paramsStr
            .split(",")
            .map(p => p.trim())
            .filter(p => p !== "");

          const parsed = parseInputsForParams(input, paramNames, question, methodName);

          parsed.forEach((arg, idx) => {
            const varName = arg.name || paramNames[idx] || `arg_${idx}`;
            const jsVal = arg.val;

            if (varName === "__cyclePos") {
              cyclePosName = varName;
              declarations += `const ${varName} = ${jsVal};\n`;
            } else if (isLinkedListArrayParam(varName)) {
              declarations += `const ${varName}_raw = ${jsVal};\n`;
              declarations += `const ${varName} = ${varName}_raw ? ${varName}_raw.map(arr => buildList(arr)) : [];\n`;
              callArgs.push(varName);
            } else if (isLinkedListParam(varName)) {
              declarations += `const ${varName}_raw = ${jsVal};\n`;
              declarations += `const ${varName} = buildList(${varName}_raw);\n`;
              callArgs.push(varName);
            } else if (isTreeParam(varName)) {
              declarations += `const ${varName}_raw = ${jsVal};\n`;
              declarations += `const ${varName} = buildTree(${varName}_raw);\n`;
              callArgs.push(varName);
            } else {
              declarations += `const ${varName} = ${jsVal};\n`;
              callArgs.push(varName);
            }
          });

          for (let i = parsed.length; i < paramNames.length; i++) {
            const varName = paramNames[i];
            declarations += `const ${varName} = null;\n`;
            callArgs.push(varName);
          }

          isInPlace = IN_PLACE_METHODS.includes(methodName?.toLowerCase() || "") || 
            question?.problemStatement?.toLowerCase().includes("in-place");
          firstArg = callArgs[0] || "null";
      }

      const isSerDeser = isTreeSerializationQuestion(question);
      const strippedCode = code.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");
      const hasListNode = strippedCode.includes("class ListNode") || strippedCode.includes("function ListNode");
      const hasTreeNode = strippedCode.includes("class TreeNode") || strippedCode.includes("function TreeNode");
      const hasQueue = strippedCode.includes("class Queue");
      const hasDeque = strippedCode.includes("class Deque");
      const hasPriorityQueue = strippedCode.includes("class PriorityQueue");

      const wrapper = `
${hasListNode ? "" : `function ListNode(val, next) {
    this.val = (val === undefined ? 0 : val);
    this.next = (next === undefined ? null : next);
}`}
function buildList(arr) {
    if (!arr || arr.length === 0) return null;
    const head = new ListNode(arr[0]);
    let curr = head;
    for (let i = 1; i < arr.length; i++) {
        curr.next = new ListNode(arr[i]);
        curr = curr.next;
    }
    return head;
}
function createCycle(head, pos) {
    if (pos === null || pos === undefined || pos < 0) return head;
    let cycleNode = null;
    let curr = head;
    let tail = null;
    let idx = 0;
    while (curr) {
        if (idx === pos) cycleNode = curr;
        tail = curr;
        curr = curr.next;
        idx++;
    }
    if (tail && cycleNode) tail.next = cycleNode;
    return head;
}
function listToArray(head) {
    const arr = [];
    let curr = head;
    const seen = new Set();
    while (curr && !seen.has(curr)) {
        seen.add(curr);
        arr.push(curr.val);
        curr = curr.next;
    }
    return arr;
}
${hasTreeNode ? "" : `function TreeNode(val, left, right) {
    this.val = (val === undefined ? 0 : val);
    this.left = (left === undefined ? null : left);
    this.right = (right === undefined ? null : right);
}`}
function buildTree(arr) {
    if (!arr || arr.length === 0) return null;
    const root = new TreeNode(arr[0]);
    const queue = [root];
    let front = 0;
    let i = 1;
    while (front < queue.length && i < arr.length) {
        const curr = queue[front++];
        if (curr) {
            if (i < arr.length && arr[i] !== null && arr[i] !== undefined) {
                curr.left = new TreeNode(arr[i]);
                queue.push(curr.left);
            }
            i++;
            if (i < arr.length && arr[i] !== null && arr[i] !== undefined) {
                curr.right = new TreeNode(arr[i]);
                queue.push(curr.right);
            }
            i++;
        }
    }
    return root;
}
function treeToArray(root) {
    if (!root) return [];
    const res = [];
    const queue = [root];
    let front = 0;
    while (front < queue.length) {
        const curr = queue[front++];
        if (curr) {
            res.push(curr.val);
            queue.push(curr.left);
            queue.push(curr.right);
        } else {
            res.push(null);
        }
    }
    while (res.length > 0 && res[res.length - 1] === null) {
        res.pop();
    }
    return res;
}
${hasQueue ? "" : `class Queue {
    constructor() {
        this.items = [];
        this.head = 0;
    }
    enqueue(item) {
        this.items.push(item);
    }
    dequeue() {
        if (this.isEmpty()) return undefined;
        const item = this.items[this.head++];
        if (this.head > 1000) {
            this.items = this.items.slice(this.head);
            this.head = 0;
        }
        return item;
    }
    front() {
        return this.isEmpty() ? undefined : this.items[this.head];
    }
    size() {
        return this.items.length - this.head;
    }
    isEmpty() {
        return this.items.length === this.head;
    }
}`}
${hasDeque ? "" : `class Deque {
    constructor() {
        this.items = [];
    }
    insertFront(item) {
        this.items.unshift(item);
    }
    insertLast(item) {
        this.items.push(item);
    }
    deleteFront() {
        return this.items.shift();
    }
    deleteLast() {
        return this.items.pop();
    }
    getFront() {
        return this.items[0];
    }
    getRear() {
        return this.items[this.items.length - 1];
    }
    isEmpty() {
        return this.items.length === 0;
    }
    size() {
        return this.items.length;
    }
}`}
${hasPriorityQueue ? "" : `class PriorityQueue {
    constructor(compare) {
        this.compare = compare || ((a, b) => a - b);
        this.heap = [];
    }
    size() { return this.heap.length; }
    isEmpty() { return this.size() === 0; }
    peek() { return this.front(); }
    front() { return this.isEmpty() ? null : this.heap[0]; }
    enqueue(value) {
        this.heap.push(value);
        this.bubbleUp(this.heap.length - 1);
    }
    dequeue() {
        if (this.isEmpty()) return null;
        const top = this.heap[0];
        const bottom = this.heap.pop();
        if (this.heap.length > 0) {
            this.heap[0] = bottom;
            this.sinkDown(0);
        }
        return top;
    }
    bubbleUp(idx) {
        let currentIdx = idx;
        const element = this.heap[currentIdx];
        while (currentIdx > 0) {
            const parentIdx = Math.floor((currentIdx - 1) / 2);
            const parent = this.heap[parentIdx];
            if (this.compare(element, parent) >= 0) break;
            this.heap[currentIdx] = parent;
            currentIdx = parentIdx;
        }
        this.heap[currentIdx] = element;
    }
    sinkDown(idx) {
        let currentIdx = idx;
        const length = this.heap.length;
        const element = this.heap[currentIdx];
        while (true) {
            let leftChildIdx = 2 * currentIdx + 1;
            let rightChildIdx = 2 * currentIdx + 2;
            let swapIdx = null;
            let leftChild, rightChild;
            if (leftChildIdx < length) {
                leftChild = this.heap[leftChildIdx];
                if (this.compare(leftChild, element) < 0) swapIdx = leftChildIdx;
            }
            if (rightChildIdx < length) {
                rightChild = this.heap[rightChildIdx];
                if ((swapIdx === null && this.compare(rightChild, element) < 0) || (swapIdx !== null && this.compare(rightChild, leftChild) < 0)) swapIdx = rightChildIdx;
            }
            if (swapIdx === null) break;
            this.heap[currentIdx] = this.heap[swapIdx];
            currentIdx = swapIdx;
        }
        this.heap[currentIdx] = element;
    }
}
class MinPriorityQueue extends PriorityQueue {
    constructor(options) {
        const priorityFn = (options && options.priority) ? options.priority : (x => typeof x === 'object' ? x.priority : x);
        super((a, b) => priorityFn(a) - priorityFn(b));
    }
    enqueue(element, priority) { super.enqueue(priority !== undefined ? { element, priority } : element); }
}
class MaxPriorityQueue extends PriorityQueue {
    constructor(options) {
        const priorityFn = (options && options.priority) ? options.priority : (x => typeof x === 'object' ? x.priority : x);
        super((a, b) => priorityFn(b) - priorityFn(a));
    }
    enqueue(element, priority) { super.enqueue(priority !== undefined ? { element, priority } : element); }
}`}

${code}

(function() {
    try {
${isClassDesign ? `
        const methods = ${JSON.stringify(classMethods)};
        const args = ${JSON.stringify(classArgs)};
        let obj = null;
        const results = [];
        for (let i = 0; i < methods.length; i++) {
            const method = methods[i];
            const arg = args[i];
            if (i === 0) {
                const ClassRef = eval(method);
                obj = new ClassRef(...arg);
                results.push(null);
            } else {
                if (obj && typeof obj[method] === 'function') {
                    let res = obj[method](...arg);
                    if (res === undefined) res = null;
                    if (res instanceof ListNode) res = listToArray(res);
                    if (res instanceof TreeNode) res = treeToArray(res);
                    results.push(res);
                } else {
                    results.push(null);
                }
            }
        }
        console.log(JSON.stringify(results));
` : declarations.split('\n').map(l => '        ' + l).join('\n') + "\n" + (cyclePosName && callArgs[0] ? `        createCycle(${callArgs[0]}, ${cyclePosName});\n` : "") + `
        let result;
        if (${isSerDeser ? 'true' : 'false'}) {
            if (typeof Codec !== 'undefined') {
                const ser = new Codec();
                if (typeof ser.serialize === 'function') {
                    result = new Codec().deserialize(ser.serialize(${firstArg}));
                } else if (typeof serialize === 'function' && typeof deserialize === 'function') {
                    result = deserialize(serialize(${firstArg}));
                }
            } else if (typeof serialize === 'function' && typeof deserialize === 'function') {
                result = deserialize(serialize(${firstArg}));
            }
        } else if (typeof Solution !== 'undefined') {
            const sol = new Solution();
            result = sol.${methodName}(${callArgs.join(', ')});
        } else if (typeof ${methodName} !== 'undefined') {
            result = ${methodName}(${callArgs.join(', ')});
        } else {
            throw new Error("Could not find class Solution or function ${methodName}");
        }
        if (result instanceof ListNode) {
            result = listToArray(result);
        } else if (result instanceof TreeNode) {
            result = treeToArray(result);
        }
        
        if (${isInPlace ? 'true' : 'false'}) {
            if (${firstArg} instanceof ListNode) {
                console.log(JSON.stringify(listToArray(${firstArg})));
            } else if (${firstArg} instanceof TreeNode) {
                console.log(JSON.stringify(treeToArray(${firstArg})));
            } else {
                console.log(JSON.stringify(${firstArg}));
            }
        } else {
            console.log(JSON.stringify(result !== undefined ? result : null));
        }
`}
    } catch (e) {
        console.error("Runtime Exception: " + e.message);
        process.exit(1);
    }
})();
`;
      return wrapper.trim();
};