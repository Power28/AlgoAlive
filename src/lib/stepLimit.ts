import type { ExecutionStep } from '../types';

/** 預設的步數上限，以及到達上限時可以繼續追蹤到的步數（最多 5,000 步，與追蹤器的 MAX_STEPS_LIMIT 相同） */
export const STEP_LIMITS = [500, 2000, 5000] as const;
export const DEFAULT_STEP_LIMIT = STEP_LIMITS[0];

/** 目前的上限之後的下一個上限；已經是最大時為 null */
export function nextStepLimit(current: number): number | null {
  return STEP_LIMITS.find((n) => n > current) ?? null;
}

/**
 * 找出狀態完全相同的兩個步驟（同一行、同樣的呼叫堆疊、變數與物件）。
 * 程式是確定性的：同樣的狀態之後一定會走出同樣的路，所以一旦重複就是無窮迴圈。
 * print / console.log 的輸出不算在狀態內（無窮迴圈中一直印東西，輸出會越來越長）。
 */
export function findRepeatedState(steps: ExecutionStep[]): { first: number; second: number } | null {
  const seen = new Map<string, number>();
  for (const step of steps) {
    if (step.event !== 'line') continue;
    const key = JSON.stringify([step.lineNumber, step.depth, step.stack, step.variables, step.heap ?? null, step.stackRefs ?? null]);
    const first = seen.get(key);
    if (first !== undefined) return { first, second: step.stepIndex };
    seen.set(key, step.stepIndex);
  }
  return null;
}
