// JavaScript 教學範例的共用工具：讀取 src/tutorials 中的 JavaScript 範例，並依前端 jsFormat 的規則格式化回傳值
//
// 範例有兩種：id 為 js… 的 JavaScript 範例（language: 'javascript'），以及 Python 範例中的 js: { code, call, expected } 版本
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TUTORIALS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'tutorials');

const unescape = (s) => s.replace(/\\(.)/g, '$1');
/** TS 樣板字串中的程式碼：還原 \` 與 \$ */
const sourceOf = (s) => s.replace(/\\`/g, '`').replace(/\\\$/g, '$');
const FIELDS = String.raw`code: \x60(.*?)\x60,\s*call: '((?:[^'\\]|\\.)*)',\s*expected: '((?:[^'\\]|\\.)*)',`;
const MAIN = new RegExp(FIELDS, 's');
const VARIANT = new RegExp(String.raw`js: \{\s*` + FIELDS, 's');

/** [{ id, key, file, code, call, expected, start, end }]；key 是 js1 或 lc206@js；start / end 是 expected 值在檔案中的位置 */
export function loadJsExamples() {
  const out = [];
  for (const file of fs.readdirSync(TUTORIALS_DIR).filter((f) => f.endsWith('.ts'))) {
    const src = fs.readFileSync(path.join(TUTORIALS_DIR, file), 'utf8');
    const ids = [...src.matchAll(/id: '((?:lc|js)\d+)'/g)];
    ids.forEach((m, i) => {
      // 每個範例的範圍：到下一個範例 id 為止
      const chunk = src.slice(m.index, ids[i + 1]?.index ?? src.length);
      const id = m[1];
      const found = (id.startsWith('js') ? MAIN : VARIANT).exec(chunk);
      if (!found) return;
      const expectedAt = m.index + found.index + found[0].lastIndexOf(`'${found[3]}'`) + 1;
      out.push({
        id,
        key: id.startsWith('js') ? id : `${id}@js`,
        file,
        code: sourceOf(found[1]),
        call: unescape(found[2]),
        expected: unescape(found[3]),
        start: expectedAt,
        end: expectedAt + found[3].length,
      });
    });
  }
  return out;
}

const int = (v) => (v?.type === 'int' || v?.type === 'float' ? v.value : undefined);

/** 從 heap 走訪鏈結串列的值 */
export function chain(ref, heap) {
  const out = [];
  let cur = ref?.type === 'ref' ? ref.id : null;
  while (cur && heap[cur] && out.length < 20) {
    out.push(int(heap[cur].fields.val));
    cur = heap[cur].fields.next?.type === 'ref' ? heap[cur].fields.next.id : null;
  }
  return out;
}

/** 與 src/lib/value.ts 的 formatValue（src/languages/javascript/format.ts）相同的格式化 */
export function fmt(v, heap = {}) {
  const f = (x) => fmt(x, heap);
  const cell = (x) => (x?.type === 'str' ? x.value : f(x));
  switch (v.type) {
    case 'none':
      return 'null';
    case 'bool':
      return String(v.value);
    case 'int':
      return String(v.value);
    case 'float':
      return typeof v.value === 'string' ? { inf: 'Infinity', '-inf': '-Infinity', nan: 'NaN' }[v.value] : String(v.value);
    case 'str':
      return JSON.stringify(v.value);
    case 'list': {
      if (!v.index) return `[${v.items.map(f).join(', ')}]`;
      // 大陣列只送出部分格子：省略的區段寫成 …（與前端相同）
      const parts = [];
      let prev = -1;
      v.index.forEach((r, k) => {
        if (r > prev + 1) parts.push('…');
        parts.push(f(v.items[k]));
        prev = r;
      });
      if (prev < v.length - 1) parts.push('…');
      return `[${parts.join(', ')}]`;
    }
    case 'set':
      return `Set {${v.items.map(f).join(', ')}}`;
    case 'dict':
      return `{${v.entries.map(([k, x]) => `${f(k)}: ${f(x)}`).join(', ')}}`;
    case 'repr':
      return v.value;
    case 'ref': {
      const obj = heap[v.id];
      if (!obj) return `${v.cls}(…)`;
      if ('next' in obj.fields) {
        // 與前端相同：1 → 2 → 3，遇到環標示 ↺
        const vals = [];
        const seen = new Set();
        let cur = v.id;
        while (cur && heap[cur] && !seen.has(cur) && vals.length < 30) {
          seen.add(cur);
          vals.push(cell(heap[cur].fields.val ?? { type: 'none' }));
          cur = heap[cur].fields.next?.type === 'ref' ? heap[cur].fields.next.id : null;
        }
        return vals.join(' → ') + (cur ? (seen.has(cur) ? ' ↺' : ' → …') : '');
      }
      if ('left' in obj.fields || 'right' in obj.fields) {
        const out = [];
        const queue = [v.id];
        while (queue.length && out.length < 63) {
          const id = queue.shift();
          if (!id) {
            out.push('null');
            continue;
          }
          out.push(cell(heap[id].fields.val));
          const kid = (k) => (heap[id].fields[k]?.type === 'ref' ? heap[id].fields[k].id : null);
          queue.push(kid('left'), kid('right'));
        }
        while (out.at(-1) === 'null') out.pop();
        return `[${out.join(', ')}]`;
      }
      if (Object.values(obj.fields).some((x) => 'items' in x && x.items.every((y) => y.type === 'ref'))) {
        const val = obj.fields.val;
        return `${obj.cls}(${val ? cell(val) : ''})`;
      }
      return `${obj.cls}(…)`;
    }
  }
  return '?';
}
