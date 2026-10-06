import { IN_PLACE_METHODS } from "../constants.js";
import { getQuestionTemplate, parseInputsForParams, isLinkedListParam, isLinkedListArrayParam, isTreeParam, isCycleQuestion, isTreeSerializationQuestion } from "../shared.js";
import { parseInputAssignments } from "../helpers.js";

export const valToPythonLiteral = (valStr) => {
  try {
    const parsed = JSON.parse(valStr);
    let str = JSON.stringify(parsed);
    str = str.replace(/([\[,:]\s*)true\b/g, "$1True");
    str = str.replace(/([\[,:]\s*)false\b/g, "$1False");
    str = str.replace(/([\[,:]\s*)null\b/g, "$1None");
    if (str === "true") return "True";
    if (str === "false") return "False";
    if (str === "null") return "None";
    return str;
  } catch (e) {
    return valStr
      .replace(/\btrue\b/g, "True")
      .replace(/\bfalse\b/g, "False")
      .replace(/\bnull\b/g, "None");
  }
};

export const generatePythonWrapper = (code, input, question, language) => {
  const template = getQuestionTemplate(question, language, code);
  let methodName = null;
  let paramsStr = "";
  const pyRegexes = [
    /def\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/g,
    /async\s+def\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/g
  ];
  for (const regex of pyRegexes) {
    const pyMatches = [...template.matchAll(regex)];
    for (const m of pyMatches) {
      const name = m[1];
      if (name !== "__init__") {
        methodName = name;
        paramsStr = m[2];
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
  let firstArg = "None";

  if (!isClassDesign) {
      const paramNames = paramsStr
        .split(",")
        .map(p => p.split(":")[0].trim())
        .filter(p => p !== "self" && p !== "");

      const parsed = parseInputsForParams(input, paramNames, question, methodName);

      parsed.forEach((arg, idx) => {
        const varName = arg.name || paramNames[idx] || `arg_${idx}`;
        const pyVal = valToPythonLiteral(arg.val);

        if (varName === "__cyclePos") {
          cyclePosName = varName;
          declarations += `${varName} = ${pyVal}\n`;
        } else if (isLinkedListArrayParam(varName)) {
          declarations += `${varName}_raw = ${pyVal}\n`;
          declarations += `${varName} = [build_list(arr) for arr in ${varName}_raw] if ${varName}_raw else []\n`;
          callArgs.push(varName);
        } else if (isLinkedListParam(varName)) {
          declarations += `${varName}_raw = ${pyVal}\n`;
          declarations += `${varName} = build_list(${varName}_raw)\n`;
          callArgs.push(varName);
        } else if (isTreeParam(varName)) {
          declarations += `${varName}_raw = ${pyVal}\n`;
          declarations += `${varName} = build_tree(${varName}_raw)\n`;
          callArgs.push(varName);
        } else {
          declarations += `${varName} = ${pyVal}\n`;
          callArgs.push(varName);
        }
      });

      for (let i = parsed.length; i < paramNames.length; i++) {
        const varName = paramNames[i];
        declarations += `${varName} = None\n`;
        callArgs.push(varName);
      }

      isInPlace = IN_PLACE_METHODS.includes(methodName?.toLowerCase() || "") || 
        template.includes("-> None") || template.includes("->None") ||
        question?.problemStatement?.toLowerCase().includes("in-place");

      firstArg = callArgs[0] || "None";
  }
  
  const isSerDeser = isTreeSerializationQuestion(question);

  const pyListNode = `class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next`;

  const pyTreeNode = `class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right`;

  const wrapper = `
import json
import sys
import math
import collections
import heapq
import bisect
import functools
from collections import *
from typing import *
from heapq import *
from bisect import *
from functools import *

${pyListNode}

def build_list(arr):
    if not arr: return None
    head = ListNode(arr[0])
    curr = head
    for val in arr[1:]:
        curr.next = ListNode(val)
        curr = curr.next
    return head

def create_cycle(head, pos):
    if pos is None or pos < 0:
        return head
    cycle_node = None
    curr = head
    idx = 0
    tail = None
    while curr:
        if idx == pos:
            cycle_node = curr
        tail = curr
        curr = curr.next
        idx += 1
    if tail and cycle_node:
        tail.next = cycle_node
    return head

def list_to_array(head):
    arr = []
    curr = head
    seen = set()
    while curr:
        if id(curr) in seen:
            break
        seen.add(id(curr))
        arr.append(curr.val)
        curr = curr.next
    return arr

${pyTreeNode}

def build_tree(arr):
    if not arr: return None
    root = TreeNode(arr[0])
    queue = collections.deque([root])
    i = 1
    while queue and i < len(arr):
        curr = queue.popleft()
        if curr:
            if i < len(arr) and arr[i] is not None:
                curr.left = TreeNode(arr[i])
                queue.append(curr.left)
            i += 1
            if i < len(arr) and arr[i] is not None:
                curr.right = TreeNode(arr[i])
                queue.append(curr.right)
            i += 1
    return root

def tree_to_array(root):
    if not root: return []
    res = []
    queue = collections.deque([root])
    while queue:
        curr = queue.popleft()
        if curr:
            res.append(curr.val)
            queue.append(curr.left)
            queue.append(curr.right)
        else:
            res.append(None)
    while res and res[-1] is None:
        res.pop()
    return res

class CustomEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, ListNode):
            return list_to_array(obj)
        if isinstance(obj, TreeNode):
            return tree_to_array(obj)
        return super().default(obj)

${code}

if __name__ == '__main__':
${isClassDesign ? `    methods_json = """${JSON.stringify(classMethods)}"""
    args_json = """${JSON.stringify(classArgs)}"""
    methods = json.loads(methods_json)
    args_list = json.loads(args_json)
    obj = None
    results = []
    for i in range(len(methods)):
        method = methods[i]
        args = args_list[i]
        if i == 0:
            ClassRef = globals().get(method)
            if ClassRef:
                obj = ClassRef(*args)
            results.append(None)
        else:
            if obj and hasattr(obj, method):
                func = getattr(obj, method)
                res = func(*args)
                results.append(res)
            else:
                results.append(None)
    print(json.dumps(results, cls=CustomEncoder, separators=(',', ':')))` : `    if 'Solution' in globals():
        sol = Solution()
    elif 'Codec' in globals():
        sol = Codec()
    else:
        sol = None
${declarations.split('\n').filter(l => l.trim()).map(l => '    ' + l).join('\n')}
${cyclePosName && callArgs[0] ? `    create_cycle(${callArgs[0]}, ${cyclePosName})\n` : ""}
${isInPlace ? 
`    if sol:
        sol.${methodName}(${callArgs.join(', ')})
    else:
        ${methodName}(${callArgs.join(', ')})
    print(json.dumps(${firstArg}, cls=CustomEncoder, separators=(',', ':')))`
: 
(isSerDeser ? 
`    ser = Codec()
    deser = Codec()
    ans = deser.deserialize(ser.serialize(${firstArg}))
    print(json.dumps(ans, cls=CustomEncoder, separators=(',', ':')))`
:
`    if sol:
        result = sol.${methodName}(${callArgs.join(', ')})
    else:
        result = ${methodName}(${callArgs.join(', ')})
    print(json.dumps(result, cls=CustomEncoder, separators=(',', ':')))`)}`}
`;
  return wrapper.trim();
};
