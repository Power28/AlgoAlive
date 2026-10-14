import type { PyValue } from '../types';
import { intValue } from './pyValue';
import { consistentOffset, type IndexMap } from './indexing';

/** 常見的索引 / 指針變數名稱。 */
const POINTER_NAMES = new Set([
  'i', 'j', 'l', 'r', 'left', 'right', 'lo', 'hi', 'low', 'high', 'mid',
  'slow', 'fast', 'start', 'end', 'begin', 'stop', 'p', 'q', 'p1', 'p2', 'ptr', 'idx', 'index',
  'head', 'tail', 'cur', 'curr', 'pos', 'read', 'write', 'insert_pos',
]);
const POINTER_PATTERN = /(^|_)(idx|index|ptr|pointer|pos|left|right|start|end|slow|fast|lo|hi)$/i;

export const isPointerName = (name: string) => POINTER_NAMES.has(name) || POINTER_PATTERN.test(name);

/** 一對可以構成「視窗」的指針名稱：[左, 右]。 */
export const WINDOW_PAIRS: [string, string][] = [
  ['left', 'right'], ['l', 'r'], ['lo', 'hi'], ['low', 'high'], ['start', 'end'],
  ['window_start', 'window_end'], ['begin', 'end'],
];

const FIXED_COLORS: Record<string, string> = {};
const assign = (names: string[], color: string) => names.forEach((n) => (FIXED_COLORS[n] = color));
assign(['left', 'l', 'lo', 'low', 'slow', 'i', 'start', 'begin', 'p1', 'p', 'read', 'head'], '#ffa116');
assign(['right', 'r', 'hi', 'high', 'fast', 'j', 'end', 'stop', 'p2', 'q', 'write', 'tail'], '#0a84ff');
assign(['mid', 'm', 'k', 'cur', 'curr', 'pos', 'idx', 'index', 'node'], '#2cbb5d');
// 鏈結串列 / 樹常見的節點變數
assign(['root', 'dummy', 'l1', 'list1'], '#ffa116');
assign(['l2', 'list2'], '#00c2c7');
assign(['prev', 'parent'], '#b07cff');
assign(['nxt', 'next_node', 'temp', 'tmp'], '#ff6ec7');
const PALETTE = ['#b07cff', '#ff6ec7', '#00c2c7', '#ef4743', '#e3c34d'];

export function pointerColor(name: string): string {
  if (FIXED_COLORS[name]) return FIXED_COLORS[name];
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export interface Pointer {
  name: string;
  /** 顯示文字；變數一律帶位移使用時為 "i-1" 之類 */
  label: string;
  index: number;
  color: string;
}

/**
 * 找出指向序列 seqName（長度 length）的指針。
 * - 程式碼中寫了 `seqName[x]` 的變數 x 一定算
 * - 名稱像指針、且在程式碼中「沒有」被拿去索引任何容器的變數（例如二分搜尋的 lo / hi），
 *   也掛到可能相關的序列上；但只用常數索引的容器（`stack[-1]`、`heap[0]`）除外
 * index === length 也接受（常見的「已越界 / 結束」狀態），畫在最後一格右邊。
 */
export function pointersFor(
  variables: Record<string, PyValue>,
  seqName: string,
  length: number,
  indexMap: IndexMap,
  exclude: Set<string> = new Set(),
): Pointer[] {
  const info = indexMap.get(seqName);
  const used = info?.dims[0];
  const constantOnly = !!info && (!used || used.size === 0);
  const usedAnywhere = new Set<string>();
  for (const i of indexMap.values()) for (const dim of i.dims) for (const v of dim?.keys() ?? []) usedAnywhere.add(v);

  const out: Pointer[] = [];
  for (const [name, v] of Object.entries(variables)) {
    const n = intValue(v);
    if (n === null || name === seqName) continue;
    const direct = used?.has(name) ?? false;
    // exclude：已經在 2D 格子上標示的座標變數，不再靠名稱猜測掛到 1D 序列
    const loose = !constantOnly && !exclude.has(name) && isPointerName(name) && !usedAnywhere.has(name);
    if (!direct && !loose) continue;
    const offset = consistentOffset(used?.get(name));
    const index = n + offset;
    const label = offset ? `${name}${offset > 0 ? '+' : ''}${offset}` : name;
    if (index >= 0 && index <= length) out.push({ name, label, index, color: pointerColor(name) });
  }
  return out;
}
