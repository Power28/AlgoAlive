import type { DictValue, Heap, HeapObject, PyValue, SequenceValue } from '../types';

export const isSequence = (v: PyValue): v is SequenceValue =>
  v.type === 'list' || v.type === 'tuple' || v.type === 'deque';
export const isSet = (v: PyValue): v is SequenceValue => v.type === 'set';
export const isDict = (v: PyValue): v is DictValue => v.type === 'dict';
export const isScalar = (v: PyValue) => !isSequence(v) && !isSet(v) && !isDict(v) && v.type !== 'ref';

/** 結構相等比較用的穩定字串鍵。 */
export const valueKey = (v: PyValue | undefined) => (v === undefined ? '' : JSON.stringify(v));

export function intValue(v: PyValue | undefined): number | null {
  return v && v.type === 'int' && typeof v.value === 'number' ? v.value : null;
}

/** 依 Python repr 規則格式化值。 */
export function formatPy(v: PyValue, heap?: Heap): string {
  const f = (x: PyValue) => formatPy(x, heap);
  const more = (n?: number) => (n ? `, …+${n}` : '');
  switch (v.type) {
    case 'none':
      return 'None';
    case 'bool':
      return v.value ? 'True' : 'False';
    case 'int':
      return String(v.value);
    case 'float':
      if (typeof v.value === 'string') return v.value === 'inf' || v.value === '-inf' || v.value === 'nan' ? `float('${v.value}')` : v.value;
      return Number.isInteger(v.value) ? v.value.toFixed(1) : String(v.value);
    case 'str':
      return `'${v.value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
    case 'list':
      return `[${v.items.map(f).join(', ')}${more(v.truncated)}]`;
    case 'deque':
      return `deque([${v.items.map(f).join(', ')}${more(v.truncated)}])`;
    case 'tuple':
      return v.items.length === 1 ? `(${f(v.items[0])},)` : `(${v.items.map(f).join(', ')}${more(v.truncated)})`;
    case 'set':
      return v.items.length === 0 ? 'set()' : `{${v.items.map(f).join(', ')}${more(v.truncated)}}`;
    case 'dict': {
      const body = v.entries.map(([k, x]) => `${f(k)}: ${f(x)}`).join(', ');
      return `{${body}${more(v.truncated)}}`;
    }
    case 'repr':
      return v.value;
    case 'ref':
      return formatRef(v.id, v.cls, heap);
  }
}

/** 格子內的精簡顯示：字串不加引號（改用顏色區分）、無限大顯示為 ∞。 */
export function formatCell(v: PyValue, heap?: Heap): string {
  // 容器中的節點：顯示成 (val)
  if (v.type === 'ref') {
    const val = heap?.[v.id]?.fields.val;
    return val ? `(${formatCell(val)})` : v.cls;
  }
  if (v.type === 'str') return v.value;
  if (v.type === 'float' && typeof v.value === 'string') {
    if (v.value === 'inf') return '∞';
    if (v.value === '-inf') return '-∞';
  }
  if (v.type === 'bool') return v.value ? 'T' : 'F';
  return formatPy(v, heap);
}

/** 字串拆成字元格子用的 items。 */
export const charItems = (s: string): PyValue[] => [...s].map((ch) => ({ type: 'str', value: ch }));

const GRID_MAX = 40;

/** list 的每一列都是只含純量的 list → 以 2D 格子顯示（DP 表、grid BFS…）。 */
export function isGrid(v: PyValue): boolean {
  if (v.type !== 'list' || v.items.length === 0 || v.items.length > GRID_MAX) return false;
  return v.items.every(
    (row) => row.type === 'list' && row.items.length <= GRID_MAX && row.items.every(isScalar),
  );
}

/** 給 UI 標籤用的簡短型別名稱。 */
export function typeLabel(v: PyValue): string {
  if (v.type === 'dict' && v.cls) return v.cls;
  if (v.type === 'repr') return v.cls ?? 'object';
  if (v.type === 'ref') return v.cls;
  if (v.type === 'none') return 'NoneType';
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
export function refTarget(v: PyValue | undefined, heap: Heap): string | null {
  return v?.type === 'ref' && heap[v.id] ? v.id : null;
}

const MAX_CHAIN = 30;

function formatRef(id: string, cls: string, heap?: Heap): string {
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
      vals.push(formatCell(heap[cur].fields.val ?? { type: 'none' }));
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
      out.push(formatCell(heap[cur].fields.val ?? { type: 'none' }));
      queue.push(refTarget(heap[cur].fields.left, heap), refTarget(heap[cur].fields.right, heap));
    }
    while (out.at(-1) === 'null') out.pop();
    return `[${out.join(', ')}]`;
  }
  if (kind === 'trie') return obj.cls;
  if (kind === 'graph') {
    const val = obj.fields.val;
    return `${obj.cls}(${val ? formatCell(val) : ''})`;
  }
  const fields = Object.entries(obj.fields).map(([k, x]) => `${k}=${x.type === 'ref' ? `${x.cls}(…)` : formatPy(x)}`);
  return `${obj.cls}(${fields.join(', ')})`;
}
