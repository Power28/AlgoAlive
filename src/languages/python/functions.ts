/**
 * Python 測試呼叫的輔助：從程式碼找出可以測試的函式，產生可以直接執行的範例呼叫，
 * 並判斷目前的測試呼叫是否對得上程式碼裡的函式。
 */
import type { FuncDef } from '../types';

/** 找出最外層的函式，或 class Solution 的方法（有 Solution 時只取它的方法） */
export function findFunctions(code: string): FuncDef[] {
  const lines = code.split('\n');
  const top: FuncDef[] = [];
  const methods: FuncDef[] = [];
  let inSolution = false;
  let classIndent = -1;
  let methodIndent = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const indent = line.length - line.trimStart().length;
    const cls = /^class\s+([A-Za-z_]\w*)/.exec(line.trimStart());
    if (cls) {
      inSolution = cls[1] === 'Solution';
      classIndent = indent;
      methodIndent = -1;
      continue;
    }
    if (indent <= classIndent) inSolution = false;
    const def = /^def\s+([A-Za-z_]\w*)\s*\(/.exec(line.trimStart());
    if (!def || def[1].startsWith('_')) continue;
    const isTop = indent === 0;
    const isMethod = inSolution && indent > classIndent && (methodIndent < 0 || indent === methodIndent);
    if (!isTop && !isMethod) continue;
    if (isMethod) methodIndent = indent;
    // 參數可能跨行：從 "(" 掃到對應的 ")"
    const text = lines.slice(i).join('\n');
    const start = text.indexOf('(') + 1;
    let depth = 1;
    let end = start;
    while (end < text.length && depth > 0) {
      const ch = text[end];
      if (ch === '(' || ch === '[') depth++;
      else if (ch === ')' || ch === ']') depth--;
      end++;
    }
    const params = splitTopLevel(text.slice(start, end - 1))
      .map((p) => p.trim())
      .filter((p) => p && p !== 'self' && !p.startsWith('*') && p !== '/')
      .map((p) => {
        const [head] = p.split('=');
        const colon = head.indexOf(':');
        return colon < 0 ? { name: head.trim(), annotation: '' } : { name: head.slice(0, colon).trim(), annotation: head.slice(colon + 1).trim() };
      });
    (isMethod ? methods : top).push({ name: def[1], method: isMethod, params });
  }
  return methods.length ? methods : top;
}

function splitTopLevel(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '[' || ch === '(' || ch === '{') depth++;
    else if (ch === ']' || ch === ')' || ch === '}') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

/** 依型別標註（沒有時依參數名稱）給一個範例值 */
export function exampleValue(name: string, annotation: string): string {
  const a = annotation.replace(/\s+/g, '');
  const n = name.toLowerCase();
  if (/ListNode/.test(a) || (!a && /^(head|l1|l2|list1|list2)$/.test(name))) return '[1, 2, 3]';
  if (/TreeNode/.test(a) || (!a && /^root\d?$/.test(name))) return '[3, 9, 20, null, null, 15, 7]';
  if (/\bNode\b/.test(a)) return '[[2, 4], [1, 3], [2, 4], [1, 3]]';
  if (/List\[List\[str\]\]|list\[list\[str\]\]/.test(a)) return '[["a", "b"], ["c", "d"]]';
  if (/List\[List\[|list\[list\[/.test(a) || (!a && /grid|matrix|board|intervals/.test(n))) return '[[1, 2], [3, 4]]';
  if (/List\[str\]|list\[str\]/.test(a) || (!a && /^(words|strs)$/.test(name))) return '["eat", "tea", "ate"]';
  if (/List\[|list\[/.test(a) || (!a && /^(nums|arr|height|prices|cost|coins)/.test(n))) return '[1, 2, 3, 4]';
  if (/^str$/.test(a) || (!a && /^(s|t|word|text\d?|pattern)$/.test(name))) return '"abc"';
  if (/^bool$/.test(a)) return 'true';
  if (/^float$/.test(a)) return '1.5';
  if (/^int$/.test(a) || /^(k|n|target|x|val|m)$/.test(name)) return name === 'target' ? '5' : '2';
  return '1';
}

/** 可以直接執行的範例呼叫：twoSum(nums=[1, 2, 3, 4], target=5) */
export function exampleCall(f: FuncDef): string {
  return `${f.name}(${f.params.map((p) => `${p.name}=${exampleValue(p.name, p.annotation)}`).join(', ')})`;
}

/**
 * 目前的測試呼叫是否明顯對不上程式碼：空白，或寫成 name(...) 但 name 不是程式裡的函式。
 * LeetCode 的範例格式（nums = …）、設計題的兩個陣列、多行的寫法交給執行時再判斷。
 */
export function callNeedsHelp(call: string, funcs: FuncDef[], code: string): boolean {
  if (!call.trim()) return true;
  const m = /^\s*(?:Solution\(\)\.)?([A-Za-z_]\w*)\s*\(/.exec(call);
  if (!m) return false;
  const name = m[1];
  if (funcs.some((f) => f.name === name)) return false;
  // 設計題的類別、程式裡其他地方定義的名稱、內建的輔助函式
  if (new RegExp(`^\\s*(?:def|class)\\s+${name}\\b`, 'm').test(code)) return false;
  return !/^(print|build_list|build_tree|build_graph|len|sorted)$/.test(name);
}
