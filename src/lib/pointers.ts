import type { PyValue } from '../types';
import { intValue } from './pyValue';

/** 常見的索引 / 指針變數名稱。 */
const POINTER_NAMES = new Set([
  'i', 'j', 'k', 'l', 'r', 'm', 'left', 'right', 'lo', 'hi', 'low', 'high', 'mid',
  'slow', 'fast', 'start', 'end', 'begin', 'stop', 'p', 'q', 'p1', 'p2', 'ptr', 'idx', 'index',
  'head', 'tail', 'cur', 'curr', 'pos', 'read', 'write', 'insert_pos', 'w',
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
assign(['mid', 'm', 'k', 'cur', 'curr', 'pos', 'idx', 'index'], '#2cbb5d');
const PALETTE = ['#b07cff', '#ff6ec7', '#00c2c7', '#ef4743', '#e3c34d'];

export function pointerColor(name: string): string {
  if (FIXED_COLORS[name]) return FIXED_COLORS[name];
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export interface Pointer {
  name: string;
  index: number;
  color: string;
}

/**
 * 找出指向某個長度為 length 的序列的指針。
 * index === length 也接受（常見的「已越界 / 結束」狀態），畫在最後一格右邊。
 */
export function pointersFor(variables: Record<string, PyValue>, length: number): Pointer[] {
  const out: Pointer[] = [];
  for (const [name, v] of Object.entries(variables)) {
    const n = intValue(v);
    if (n === null || !isPointerName(name)) continue;
    if (n >= 0 && n <= length) out.push({ name, index: n, color: pointerColor(name) });
  }
  return out;
}
