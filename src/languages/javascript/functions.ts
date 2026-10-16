/**
 * JavaScript 測試呼叫的輔助：找出最外層的函式（function f(...)、var f = function(...)、const f = (...) =>），
 * 參數型別取自前面的 JSDoc（LeetCode 的 JavaScript 範本都有 @param {number[]} nums 這類註解）。
 */
import type { FuncDef } from '../types';

const DEFS = [
  /^function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/,
  /^(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function\s*[\w$]*\s*\(([^)]*)\)/,
  /^(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>/,
  /^(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*=>/,
];

export function findFunctions(code: string): FuncDef[] {
  const out: FuncDef[] = [];
  const lines = code.split('\n');
  lines.forEach((line, i) => {
    for (const re of DEFS) {
      const m = re.exec(line);
      if (!m) continue;
      // 前面緊接著的 /** … */：@param {型別} 名稱
      const types: Record<string, string> = {};
      let j = i - 1;
      while (j >= 0 && !lines[j].trim()) j--;
      if (j >= 0 && lines[j].trim().endsWith('*/')) {
        let k = j;
        while (k >= 0 && !lines[k].includes('/**')) k--;
        for (const p of lines.slice(Math.max(k, 0), j + 1).join('\n').matchAll(/@param\s+\{([^}]*)\}\s+\[?([A-Za-z_$][\w$]*)/g)) types[p[2]] = p[1].trim();
      }
      const params = m[2]
        .split(',')
        .map((p) => p.trim().replace(/=.*$/, '').replace(/^\.\.\./, '').trim())
        .filter(Boolean)
        .map((name) => ({ name, annotation: types[name] ?? '' }));
      out.push({ name: m[1], method: false, params });
      return;
    }
  });
  return out;
}

/** 依 JSDoc 型別（沒有時依參數名稱）給一個範例值 */
export function exampleValue(name: string, type: string): string {
  const t = type.replace(/\s+/g, '');
  if (/ListNode/.test(t) || (!t && /^(head|l1|l2|list1|list2)$/.test(name))) return '[1, 2, 3]';
  if (/TreeNode/.test(t) || (!t && /^root\d?$/.test(name))) return '[3, 9, 20, null, null, 15, 7]';
  if (/^(string\[\]\[\]|character\[\]\[\])$/.test(t)) return '[["a", "b"], ["c", "d"]]';
  if (/\[\]\[\]$/.test(t) || (!t && /grid|matrix|board|intervals/i.test(name))) return '[[1, 2], [3, 4]]';
  if (/^string\[\]$/.test(t) || (!t && /^(words|strs)$/.test(name))) return '["eat", "tea", "ate"]';
  if (/\[\]$/.test(t) || (!t && /^(nums|arr|height|prices|cost|coins)/i.test(name))) return '[1, 2, 3, 4]';
  if (t === 'string' || (!t && /^(s|t|word|text\d?|pattern)$/.test(name))) return '"abc"';
  if (t === 'boolean') return 'true';
  if (t === 'number' || /^(k|n|target|x|val|m)$/.test(name)) return name === 'target' ? '5' : '2';
  return '1';
}

/** 可以直接執行的範例呼叫：twoSum([1, 2, 3, 4], 5) */
export function exampleCall(f: FuncDef): string {
  return `${f.name}(${f.params.map((p) => exampleValue(p.name, p.annotation)).join(', ')})`;
}

/** 測試呼叫明顯對不上程式碼：空白，或寫成 name(...) 但 name 不是程式裡的函式 / 類別 */
export function callNeedsHelp(call: string, funcs: FuncDef[], code: string): boolean {
  if (!call.trim()) return true;
  const m = /^\s*([A-Za-z_$][\w$]*)\s*\(/.exec(call);
  if (!m) return false;
  const name = m[1];
  if (funcs.some((f) => f.name === name)) return false;
  if (new RegExp(`(?:function|class|var|let|const)\\s+${name.replace(/\$/g, '\\$')}\\b`).test(code)) return false;
  return !/^(console|buildList|buildTree|buildGraph|Math|JSON)$/.test(name);
}
