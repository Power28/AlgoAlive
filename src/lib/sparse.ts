import type { SequenceValue, Value } from '../types';

/** 大陣列只送出部分格子時，中間省略的部分以一格「…」表示 */
export const GAP: Value = { type: 'repr', value: '…', cls: 'gap' };
export const isGap = (v: Value | undefined) => v?.type === 'repr' && v.cls === 'gap';

export const isSparse = (v: Value | undefined): v is SequenceValue & { index: number[]; length: number } =>
  !!v && 'items' in v && Array.isArray(v.index) && typeof v.length === 'number';

export interface SparseView {
  /** 畫面上的格子（省略的部分是一格 GAP） */
  items: Value[];
  /** 每一格的真實索引；GAP 為 -1 */
  real: number[];
  /** 完整長度 */
  length: number;
  /** 真實索引 → 畫面上的第幾格；沒有送出的位置為 null（等於長度時是最後面的 end 格） */
  toPos: (index: number) => number | null;
  /** 真實索引的值（沒有送出時為 undefined） */
  at: (index: number) => Value | undefined;
}

/** 把稀疏的陣列展開成連續的格子，省略的區段插入「…」 */
export function expandSparse(v: SequenceValue & { index: number[]; length: number }): SparseView {
  const items: Value[] = [];
  const real: number[] = [];
  const pos = new Map<number, number>();
  const byIndex = new Map<number, Value>();
  let prev = -1;
  v.index.forEach((r, k) => {
    if (r > prev + 1) {
      items.push(GAP);
      real.push(-1);
    }
    pos.set(r, items.length);
    byIndex.set(r, v.items[k]);
    items.push(v.items[k]);
    real.push(r);
    prev = r;
  });
  if (prev < v.length - 1) {
    items.push(GAP);
    real.push(-1);
  }
  return {
    items,
    real,
    length: v.length,
    toPos: (index) => (index === v.length ? items.length : (pos.get(index) ?? null)),
    at: (index) => byIndex.get(index),
  };
}

/** 一組真實索引換算成畫面上的位置（沒有送出的就略過） */
export function toPositions(indexes: Set<number> | undefined, view: SparseView): Set<number> | undefined {
  if (!indexes) return undefined;
  const out = new Set<number>();
  for (const i of indexes) {
    const p = view.toPos(i);
    if (p !== null) out.add(p);
  }
  return out;
}
