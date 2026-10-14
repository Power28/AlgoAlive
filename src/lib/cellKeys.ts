import type { ExecutionStep } from '../types';
import { charItems, isSequence, valueKey } from './pyValue';

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
