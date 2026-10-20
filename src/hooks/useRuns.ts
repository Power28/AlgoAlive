import { useCallback, useEffect, useState } from 'react';
import type { LanguageRuntime, RuntimeStatus } from '../languages/types';
import { DEFAULT_STEP_LIMIT } from '../lib/stepLimit';
import type { TraceResult } from '../types';
import type { Tab } from './useTabs';

/** 每個頁籤各自的執行結果（只存在記憶體中） */
export interface Run {
  trace: TraceResult | null;
  /** 執行當下的程式碼，用來分析索引與指針；與目前的程式碼不同時，畫面上的動畫就是舊的 */
  code: string;
  /** 執行當下的測試呼叫 */
  call: string;
  /** 這次執行的步數上限（到達上限後可以繼續追蹤更多步） */
  maxSteps: number;
  error: string | null;
}

export type Staleness = 'code' | 'call' | 'both' | null;

/** 動畫是不是舊的：比較目前與上次執行時的程式碼、測資（改回原樣就不算修改） */
function staleness(run: Run | undefined, code: string, call: string): Staleness {
  if (!run?.trace) return null;
  const codeChanged = run.code !== code;
  const callChanged = run.call !== call;
  return codeChanged && callChanged ? 'both' : codeChanged ? 'code' : callChanged ? 'call' : null;
}

const EMPTY_STEPS: TraceResult['steps'] = [];

/** 執行環境的狀態（載入中 / 就緒 / 執行中 / 失敗）與失敗原因 */
export function useRuntimeStatus(runtime: LanguageRuntime) {
  const [status, setStatus] = useState<RuntimeStatus>(runtime.status);
  const [detail, setDetail] = useState<string>();
  useEffect(
    () =>
      runtime.onStatus((s, d) => {
        setStatus(s);
        setDetail(d);
      }),
    [runtime],
  );
  return { status, detail };
}

/** 目前頁籤的執行結果：執行、以其他測資或更多步數重新執行、動畫是不是舊的 */
export function useRuns(active: Tab, runtime: LanguageRuntime) {
  const [runs, setRuns] = useState<Record<string, Run>>({});
  const run = runs[active.id];
  const trace = run?.trace ?? null;
  const steps = trace?.steps ?? EMPTY_STEPS;

  /** 以指定的測資執行（一鍵修正測試呼叫時，新的測資還沒反映到 active） */
  const runWith = useCallback(
    async (call: string, maxSteps: number = DEFAULT_STEP_LIMIT) => {
      const { id, code } = active;
      setRuns((r) => ({ ...r, [id]: { trace: r[id]?.trace ?? null, code: r[id]?.code ?? code, call: r[id]?.call ?? call, maxSteps: r[id]?.maxSteps ?? maxSteps, error: null } }));
      try {
        const result = await runtime.run(code, call, { maxSteps });
        setRuns((r) => ({ ...r, [id]: { trace: result, code, call, maxSteps, error: null } }));
      } catch (err) {
        setRuns((r) => ({ ...r, [id]: { trace: null, code, call, maxSteps, error: err instanceof Error ? err.message : String(err) } }));
      }
    },
    [active, runtime],
  );
  const visualize = useCallback(() => runWith(active.call), [runWith, active.call]);
  /** 關閉頁籤時一併丟掉它的執行結果 */
  const forget = useCallback((id: string) => setRuns(({ [id]: _removed, ...rest }) => rest), []);

  return { run, trace, steps, stale: staleness(run, active.code, active.call), runWith, visualize, forget };
}
