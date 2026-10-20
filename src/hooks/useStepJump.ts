import { useCallback, useMemo, useRef } from 'react';
import { useT } from '../i18n';
import { changeSteps, lineVisits, nearest, visitNumber, type VarJump } from '../lib/stepSearch';
import type { ExecutionStep } from '../types';

interface Options {
  steps: ExecutionStep[];
  index: number;
  /** 動畫是舊的（程式碼已修改）：行號對不上，不提供點行號跳轉 */
  stale: boolean;
  setPlaying: (playing: boolean) => void;
  seek: (index: number) => void;
}

/** 步驟搜尋：點行號跳到下一次執行這一行、點變數名稱跳到它下一次改變（跳轉時停止播放） */
export function useStepJump({ steps, index, stale, setPlaying, seek }: Options) {
  const t = useT();
  const visits = useMemo(() => lineVisits(steps), [steps]);
  const indexRef = useRef(index);
  indexRef.current = index;

  const jumpTo = useCallback(
    (i: number | null) => {
      if (i === null) return;
      setPlaying(false);
      seek(i);
    },
    [setPlaying, seek],
  );

  /** 執行過的行與行號上的說明 */
  const jumpLines = useMemo(() => {
    if (stale || !steps.length) return undefined;
    return new Map([...visits].map(([line, list]) => [line, t('lineJumpHint', { line, n: list.length })]));
  }, [stale, steps.length, visits, t]);
  const jumpToLine = useCallback(
    (line: number, dir: 1 | -1) => jumpTo(nearest(visits.get(line) ?? [], indexRef.current, dir)),
    [visits, jumpTo],
  );

  // 每個變數的改變步驟只算一次（整段執行換掉時才重算）
  const varJump = useMemo<VarJump>(() => {
    const cache = new Map<string, number[]>();
    const changes = (name: string) => {
      let list = cache.get(name);
      if (!list) cache.set(name, (list = changeSteps(steps, name)));
      return list;
    };
    return { changes, cached: (name) => cache.get(name), jump: (name, dir) => jumpTo(nearest(changes(name), indexRef.current, dir)) };
  }, [steps, jumpTo]);

  /** 目前這一步是這一行的第幾次執行 / 共幾次 */
  const step = steps[index];
  const visit = step?.event === 'line' ? visitNumber(visits.get(step.lineNumber), index) : null;
  const visitTotal = step ? (visits.get(step.lineNumber)?.length ?? 0) : 0;

  return { jumpLines, jumpToLine, varJump, visit, visitTotal };
}
