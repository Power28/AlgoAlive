import type { ExecutionStep } from '../types';
import { charItems, isGrid, isSequence, valueKey } from './pyValue';

/** stepIndex → 變數名 → 每個格子的穩定 key。 */
export type CellKeyMap = Record<string, string[]>[];

/**
 * 為每一步的 list 格子指定「身分」key，讓 framer-motion 能把交換 / 排序畫成格子移動，
 * 而不是原地換數字。
 *
 * 規則：
 * - 長度相同、且變動位置上的值只是彼此重新排列（如 swap、sort）→ 依值配對，key 跟著值走。
 * - 長度相同但是覆寫（nums[i] = 5）→ 保留位置 key，只閃爍該格。
 * - 長度改變（append / pop / insert）→ 依值配對，優先保留原位置。
 */
export function computeCellKeys(steps: ExecutionStep[]): CellKeyMap {
  let counter = 0;
  const gen = () => `c${counter++}`;
  const last = new Map<string, { keys: string[]; vals: string[] }>();

  return steps.map((step) => {
    const map: Record<string, string[]> = {};
    for (const [name, v] of Object.entries(step.variables)) {
      // 字串也可能被畫成字元格子，一併給 key
      const items = isSequence(v) ? v.items : v.type === 'str' && v.value.length >= 2 ? charItems(v.value) : null;
      if (!items) continue;
      const vals = items.map(valueKey);
      const id = `${step.depth}:${step.funcName}:${name}`;
      const prev = last.get(id);
      const keys = prev ? matchKeys(prev, vals, gen) : vals.map(gen);
      map[name] = keys;
      last.set(id, { keys, vals });
    }
    return map;
  });
}

function matchKeys(prev: { keys: string[]; vals: string[] }, vals: string[], gen: () => string): string[] {
  if (prev.vals.length === vals.length) {
    const diffs = vals.flatMap((v, i) => (v === prev.vals[i] ? [] : [i]));
    if (diffs.length === 0) return prev.keys.slice();
    const before = diffs.map((i) => prev.vals[i]).sort();
    const after = diffs.map((i) => vals[i]).sort();
    const isPermutation = diffs.length >= 2 && before.every((v, i) => v === after[i]);
    if (!isPermutation) return prev.keys.slice();
  }

  // 依值配對：先保留「同位置同值」，再為其他格子找最近的同值舊格子
  const used = new Array<boolean>(prev.vals.length).fill(false);
  const keys: (string | null)[] = vals.map((v, i) => {
    if (i < prev.vals.length && prev.vals[i] === v) {
      used[i] = true;
      return prev.keys[i];
    }
    return null;
  });
  return keys.map((k, i) => {
    if (k) return k;
    let best = -1;
    for (let j = 0; j < prev.vals.length; j++) {
      if (!used[j] && prev.vals[j] === vals[i] && (best < 0 || Math.abs(j - i) < Math.abs(best - i))) best = j;
    }
    if (best >= 0) {
      used[best] = true;
      return prev.keys[best];
    }
    return gen();
  });
}

/** stepIndex → grid 變數名 → [列][欄] 每一格的穩定 key */
export type GridKeyMap = Record<string, string[][]>[];

/**
 * 二維格子的格子身分：與一維相同的規則套用到攤平後的格子。
 * 變動的格子只是彼此重新排列（旋轉、轉置、交換）時，key 跟著值走，畫面上就會看到格子移動；
 * 被覆寫成新值時保留位置 key，只在原地閃爍。
 */
export function computeGridKeys(steps: ExecutionStep[]): GridKeyMap {
  let counter = 0;
  const gen = () => `g${counter++}`;
  const last = new Map<string, { shape: number[]; keys: string[]; vals: string[] }>();

  return steps.map((step) => {
    const map: Record<string, string[][]> = {};
    for (const [name, v] of Object.entries(step.variables)) {
      if (!isGrid(v) || v.type !== 'list') continue;
      const rows = v.items.map((row) => ('items' in row ? row.items : []));
      const shape = rows.map((r) => r.length);
      const vals = rows.flat().map(valueKey);
      const id = `${step.depth}:${step.funcName}:${name}`;
      const prev = last.get(id);
      const sameShape = prev && prev.shape.length === shape.length && prev.shape.every((n, i) => n === shape[i]);
      const flat = prev && sameShape ? matchKeys(prev, vals, gen) : prev ? matchKeys({ keys: prev.keys, vals: prev.vals }, vals, gen) : vals.map(gen);
      last.set(id, { shape, keys: flat, vals });
      let k = 0;
      map[name] = shape.map((n) => flat.slice(k, (k += n)));
    }
    return map;
  });
}
