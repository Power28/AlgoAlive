import type { ExecutionStep } from '../types';

export interface ContextInfo {
  /** 有多層呼叫（遞迴或呼叫輔助函式）時才顯示呼叫堆疊 */
  stack: boolean;
  /** 有迴圈時才顯示迴圈列 */
  loops: boolean;
  /** frameKeys[stepIndex][depth]：每一層呼叫的唯一 key，讓新的呼叫重新播放進場動畫 */
  frameKeys: string[][];
}

/** 整段執行過程只算一次：要顯示哪些列（高度固定，避免播放時畫面跳動）、每次呼叫的身分 */
export function contextInfo(steps: ExecutionStep[]): ContextInfo {
  let stack = false;
  let loops = false;
  let counter = 0;
  let keys: string[] = [];
  const frameKeys = steps.map((step) => {
    const depth = step.stack?.length ?? 0;
    if (depth > 1) stack = true;
    if (step.loops?.length) loops = true;
    if (step.entered) keys = [...keys.slice(0, depth - 1), `f${counter++}`];
    else keys = keys.slice(0, depth);
    while (keys.length < depth) keys.push(`f${counter++}`);
    return keys;
  });
  return { stack, loops, frameKeys };
}
