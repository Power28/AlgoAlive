import type { ExecutionStep, TermLocation } from '../types';

/** 畫面上要加框的位置 */
export interface Marks {
  vars: Set<string>;
  /** 序列的某格："name:index" */
  cells: Set<string>;
  /** grid 的某格："name:row:col" */
  gridCells: Set<string>;
  refs: Set<string>;
}

const emptyMarks = (): Marks => ({ vars: new Set(), cells: new Set(), gridCells: new Set(), refs: new Set() });

function addLoc(m: Marks, loc: TermLocation | undefined) {
  if (!loc) return;
  if (loc.ref) m.refs.add(loc.ref);
  else if (loc.var && loc.col !== undefined && loc.index !== undefined) m.gridCells.add(`${loc.var}:${loc.index}:${loc.col}`);
  else if (loc.var && loc.index !== undefined) m.cells.add(`${loc.var}:${loc.index}`);
  else if (loc.var) m.vars.add(loc.var);
}

/**
 * 這一步「讀取」與「寫入」的位置：
 * - reads：條件式的比較運算元、計算式右邊用到的變數 / 格子 / 節點
 * - writes：計算結果要寫入的目標（例如 mid、dp[i]）
 */
export function stepMarks(step: ExecutionStep): { reads: Marks; writes: Marks } {
  const reads = emptyMarks();
  const writes = emptyMarks();
  if (step.event !== 'line') return { reads, writes };
  for (const part of step.condition?.parts ?? []) {
    if (part.skipped) continue;
    for (const term of part.terms ?? []) addLoc(reads, term.loc);
  }
  for (const term of step.calc?.terms ?? []) addLoc(reads, term.loc);
  addLoc(writes, step.calc?.targetLoc);
  return { reads, writes };
}

/** 某個序列中被標記的格子索引 */
export const cellsOf = (m: Marks, name: string) =>
  new Set([...m.cells].filter((k) => k.startsWith(`${name}:`)).map((k) => Number(k.slice(name.length + 1))));

/** 某個 grid 中被標記的格子 "row:col" */
export const gridCellsOf = (m: Marks, name: string) =>
  new Set([...m.gridCells].filter((k) => k.startsWith(`${name}:`)).map((k) => k.slice(name.length + 1)));

/** 讀取：紫色虛線；寫入：青色實線 */
export const READ_COLOR = '#c084fc';
export const WRITE_COLOR = '#22d3ee';

/** motion 元件不會清掉 undefined 的 style，所以沒有標記時明確給 none */
export function markOutline(read: boolean, write = false) {
  if (write) return { outline: `2px solid ${WRITE_COLOR}`, outlineOffset: 3 };
  if (read) return { outline: `2px dashed ${READ_COLOR}`, outlineOffset: 3 };
  return { outline: 'none', outlineOffset: 0 };
}
