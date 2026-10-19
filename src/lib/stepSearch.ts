import { createContext, useContext } from 'react';
import type { ExecutionStep, Heap, Value } from '../types';
// 與 lib/value 的 valueKey 相同；不 import，讓 Node 可以直接執行這個檔案做測試
const valueKey = (v: Value) => JSON.stringify(v);

/** 每一行在哪些步驟「即將執行」（只算 line 事件；由小到大） */
export function lineVisits(steps: ExecutionStep[]): Map<number, number[]> {
  const out = new Map<number, number[]>();
  steps.forEach((s, i) => {
    if (s.event !== 'line') return;
    const list = out.get(s.lineNumber);
    if (list) list.push(i);
    else out.set(s.lineNumber, [i]);
  });
  return out;
}

/** 目前步驟之後（dir = 1）或之前（dir = -1）最近的一個；走到底就從另一端繞回來 */
export function nearest(indexes: number[], from: number, dir: 1 | -1): number | null {
  if (!indexes.length) return null;
  if (dir === 1) return indexes.find((i) => i > from) ?? indexes[0];
  for (let k = indexes.length - 1; k >= 0; k--) if (indexes[k] < from) return indexes[k];
  return indexes[indexes.length - 1];
}

/** 這一步是這一行的第幾次執行（1 起算；不是 line 事件時為 null） */
export function visitNumber(visits: number[] | undefined, index: number): number | null {
  if (!visits) return null;
  const k = visits.indexOf(index);
  return k < 0 ? null : k + 1;
}

const MAX_NODES = 200;

/** 變數的內容：一般值直接比較；指向節點的變數連同走得到的節點一起比較（鏈結串列反轉、樹的修改也算改變） */
function contentKey(v: Value, heap: Heap | undefined): string {
  if (v.type !== 'ref' || !heap) return valueKey(v);
  const seen = new Set<string>();
  const parts: string[] = [];
  const stack = [v.id];
  while (stack.length && seen.size < MAX_NODES) {
    const id = stack.pop()!;
    if (seen.has(id) || !heap[id]) continue;
    seen.add(id);
    const fields = heap[id].fields;
    parts.push(`${id}:${JSON.stringify(fields)}`);
    for (const f of Object.values(fields)) collectRefs(f, stack);
  }
  return parts.join('|');
}

function collectRefs(v: Value, out: string[]) {
  if (v.type === 'ref') out.push(v.id);
  else if ('items' in v) v.items.forEach((x) => collectRefs(x, out));
  else if (v.type === 'dict') v.entries.forEach(([, x]) => collectRefs(x, out));
}

/** 變數在哪些步驟改變（出現或值和上一步不同；由小到大） */
export function changeSteps(steps: ExecutionStep[], name: string): number[] {
  const out: number[] = [];
  let prev: string | undefined;
  steps.forEach((s, i) => {
    const v = s.variables[name];
    const key = v === undefined ? undefined : contentKey(v, s.heap);
    if (key !== undefined && key !== prev) out.push(i);
    prev = key;
  });
  return out;
}

/** 視覺化裡的變數名稱：點一下跳到這個變數下一次改變（Shift：上一次） */
export interface VarJump {
  /** 變數在整段執行中改變的步驟（沒有這個變數時為空） */
  changes: (name: string) => number[];
  /** 已經算過的結果（還沒算過時為 undefined） */
  cached: (name: string) => number[] | undefined;
  jump: (name: string, dir: 1 | -1) => void;
}

export const VarJumpContext = createContext<VarJump | null>(null);
export const useVarJump = () => useContext(VarJumpContext);
