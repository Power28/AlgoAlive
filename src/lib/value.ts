import type { DictValue, Heap, HeapObject, Value, SequenceValue } from '../types';
import type { ValueFormat } from '../languages/types';
import { pythonFormat } from '../languages/python/format';

export const isSequence = (v: Value): v is SequenceValue =>
  v.type === 'list' || v.type === 'tuple' || v.type === 'deque';
export const isSet = (v: Value): v is SequenceValue => v.type === 'set';
export const isDict = (v: Value): v is DictValue => v.type === 'dict';
export const isScalar = (v: Value) => !isSequence(v) && !isSet(v) && !isDict(v) && v.type !== 'ref';

/** 結構相等比較用的穩定字串鍵。 */
export const valueKey = (v: Value | undefined) => (v === undefined ? '' : JSON.stringify(v));

export function intValue(v: Value | undefined): number | null {
  return v && v.type === 'int' && typeof v.value === 'number' ? v.value : null;
}

/**
 * 值的文字表示。字面值的寫法由語言決定（目前只有 Python 的 repr）；
 * 加入其他語言時，由 trace 所屬語言的 Language.format 傳入。
 */
export function formatValue(v: Value, heap?: Heap, format: ValueFormat = pythonFormat): string {
  const f = (x: Value) => formatValue(x, heap, format);
  const more = (n?: number) => (n ? `, …+${n}` : '');
  switch (v.type) {
    case 'none':
      return format.none;
    case 'bool':
      return format.bool(v.value);
    case 'int':
      return String(v.value);
    case 'float':
      return format.float(v.value);
    case 'str':
      return format.str(v.value);
    case 'list':
    case 'deque':
    case 'tuple':
    case 'set':
      if (v.index && v.length !== undefined) {
        // 大陣列只送出部分格子：省略的區段寫成 …
        const parts: string[] = [];
        let prev = -1;
        v.index.forEach((r, k) => {
          if (r > prev + 1) parts.push('…');
          parts.push(f(v.items[k]));
          prev = r;
        });
        if (prev < v.length - 1) parts.push('…');
        return format.container(v.type, parts, '');
      }
      return format.container(v.type, v.items.map(f), more(v.truncated));
    case 'dict':
      if (v.index && v.length !== undefined) {
        // 大的 dict 只送出部分項目：省略的區段寫成 …
        const parts: string[] = [];
        let prev = -1;
        v.index.forEach((r, k) => {
          if (r > prev + 1) parts.push('…');
          parts.push(`${f(v.entries[k][0])}: ${f(v.entries[k][1])}`);
          prev = r;
        });
        if (prev < v.length - 1) parts.push('…');
        return format.container('dict', parts, '');
      }
      return format.container('dict', v.entries.map(([k, x]) => `${f(k)}: ${f(x)}`), more(v.truncated));
    case 'repr':
      return v.value;
    case 'ref':
      return formatRef(v.id, v.cls, heap, format);
  }
}

/** 格子內的精簡顯示：字串不加引號（改用顏色區分）、無限大顯示為 ∞。 */
export function formatCell(v: Value, heap?: Heap, format: ValueFormat = pythonFormat): string {
  // 容器中的節點：顯示成 (val)
  if (v.type === 'ref') {
    const val = heap?.[v.id]?.fields.val;
    return val ? `(${formatCell(val, undefined, format)})` : v.cls;
  }
  if (v.type === 'str') return v.value;
  if (v.type === 'float' && typeof v.value === 'string') {
    if (v.value === 'inf') return '∞';
    if (v.value === '-inf') return '-∞';
  }
  if (v.type === 'bool') return v.value ? 'T' : 'F';
  return formatValue(v, heap, format);
}

/** 字串拆成字元格子用的 items。 */
export const charItems = (s: string): Value[] => [...s].map((ch) => ({ type: 'str', value: ch }));

const GRID_MAX = 40;

/** list 的每一列都是只含純量的 list → 以 2D 格子顯示（DP 表、grid BFS…）。 */
export function isGrid(v: Value): boolean {
  if (v.type !== 'list' || v.items.length === 0 || v.items.length > GRID_MAX) return false;
  return v.items.every(
    (row) => row.type === 'list' && row.items.length <= GRID_MAX && row.items.every(isScalar),
  );
}

/** 給 UI 標籤用的簡短型別名稱。 */
export function typeLabel(v: Value): string {
  if (v.type === 'dict' && v.cls) return v.cls;
  if (v.type === 'repr') return v.cls ?? 'object';
  if (v.type === 'ref') return v.cls;
  if (v.type === 'none') return pythonFormat.noneType;
  return v.type;
}

export type NodeKind = 'list' | 'tree' | 'graph' | 'trie' | 'object';

const GRAPH_FIELDS = /^(neighbors|neighbours|children|adj|adjacent|edges|nbrs)$/i;
/** 字典樹：子節點放在以字元為 key 的 dict 裡 */
const TRIE_FIELDS = /^(children|child|next|links|nodes|kids)$/i;

/** 依欄位判斷節點種類：有 next → 鏈結串列；有 left / right → 二元樹；有節點清單（neighbors…）→ 圖。 */
export function nodeKind(obj: HeapObject): NodeKind {
  const f = obj.fields;
  if ('left' in f || 'right' in f) return 'tree';
  for (const [name, v] of Object.entries(f)) {
    if (v.type === 'dict' && TRIE_FIELDS.test(name) && v.entries.every(([, x]) => x.type === 'ref')) return 'trie';
  }
  if ('next' in f) return 'list';
  for (const [name, v] of Object.entries(f)) {
    const items = 'items' in v ? v.items : null;
    if (items && (GRAPH_FIELDS.test(name) || (items.length > 0 && items.every((x) => x.type === 'ref')))) return 'graph';
  }
  return 'object';
}

/** 欄位指向的另一個節點 id（不是節點或不在 heap 中則為 null） */
export function refTarget(v: Value | undefined, heap: Heap): string | null {
  return v?.type === 'ref' && heap[v.id] ? v.id : null;
}

const MAX_CHAIN = 30;

function formatRef(id: string, cls: string, heap: Heap | undefined, format: ValueFormat): string {
  const obj = heap?.[id];
  if (!heap || !obj) return `${cls}(…)`;
  const kind = nodeKind(obj);
  if (kind === 'list') {
    // 1 → 2 → 3，遇到環標示 ↺
    const vals: string[] = [];
    const seen = new Set<string>();
    let cur: string | null = id;
    while (cur && !seen.has(cur) && vals.length < MAX_CHAIN) {
      seen.add(cur);
      vals.push(formatCell(heap[cur].fields.val ?? { type: 'none' }, undefined, format));
      cur = refTarget(heap[cur].fields.next, heap);
    }
    return vals.join(' → ') + (cur ? (seen.has(cur) ? ' ↺' : ' → …') : '');
  }
  if (kind === 'tree') {
    // LeetCode 層序表示法，去掉尾端的 null
    const out: string[] = [];
    const queue: (string | null)[] = [id];
    const seen = new Set<string>();
    while (queue.length && out.length < 63) {
      const cur = queue.shift()!;
      if (!cur || seen.has(cur)) {
        out.push('null');
        continue;
      }
      seen.add(cur);
      out.push(formatCell(heap[cur].fields.val ?? { type: 'none' }, undefined, format));
      queue.push(refTarget(heap[cur].fields.left, heap), refTarget(heap[cur].fields.right, heap));
    }
    while (out.at(-1) === 'null') out.pop();
    return `[${out.join(', ')}]`;
  }
  if (kind === 'trie') return obj.cls;
  if (kind === 'graph') {
    const val = obj.fields.val;
    return `${obj.cls}(${val ? formatCell(val, undefined, format) : ''})`;
  }
  const fields = Object.entries(obj.fields).map(([k, x]) => `${k}=${x.type === 'ref' ? `${x.cls}(…)` : formatValue(x, undefined, format)}`);
  return `${obj.cls}(${fields.join(', ')})`;
}
