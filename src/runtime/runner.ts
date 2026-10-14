import type { TraceResult } from '../types';
import type { WorkerRequest, WorkerResponse } from './pyodide.worker';

export type RuntimeStatus = 'loading' | 'ready' | 'running' | 'error';

/** 單次執行的牆鐘時間上限；超過就砍掉 Worker 重建（MAX_STEPS 擋不住的單行超大運算）。 */
const RUN_TIMEOUT_MS = 10_000;

type Pending = { resolve: (r: TraceResult) => void; reject: (e: Error) => void; timer: number; background: boolean };

export interface RunOptions {
  /** 背景執行（例如教學動畫）：不改變執行狀態，主畫面的「視覺化」按鈕不會因此變成忙碌中 */
  background?: boolean;
}

/** 管理 Pyodide Worker 的生命週期與請求對應。 */
export class PythonRunner {
  private worker!: Worker;
  private ready!: Promise<void>;
  private pending = new Map<number, Pending>();
  private nextId = 1;
  private listeners = new Set<(s: RuntimeStatus, detail?: string) => void>();
  status: RuntimeStatus = 'loading';

  constructor() {
    this.spawn();
  }

  onStatus(fn: (s: RuntimeStatus, detail?: string) => void) {
    this.listeners.add(fn);
    fn(this.status);
    return () => void this.listeners.delete(fn);
  }

  private setStatus(s: RuntimeStatus, detail?: string) {
    this.status = s;
    this.listeners.forEach((fn) => fn(s, detail));
  }

  private spawn() {
    this.setStatus('loading');
    this.worker = new Worker(new URL('./pyodide.worker.ts', import.meta.url), { type: 'module' });
    this.ready = new Promise((resolve, reject) => {
      this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const msg = e.data;
        if (msg.type === 'ready') {
          this.setStatus('ready');
          resolve();
        } else if (msg.type === 'init-error') {
          this.setStatus('error', msg.message);
          reject(new Error(msg.message));
        } else {
          this.settle(msg);
        }
      };
    });
    this.ready.catch(() => {});
  }

  private settle(msg: Extract<WorkerResponse, { id: number }>) {
    const p = this.pending.get(msg.id);
    if (!p) return;
    this.pending.delete(msg.id);
    clearTimeout(p.timer);
    // 還有前景執行在跑時維持 running
    if (!p.background && ![...this.pending.values()].some((x) => !x.background)) this.setStatus('ready');
    if (msg.type === 'result') p.resolve(JSON.parse(msg.json) as TraceResult);
    else p.reject(new Error(msg.message));
  }

  async run(code: string, call: string, { background = false }: RunOptions = {}): Promise<TraceResult> {
    await this.ready;
    const id = this.nextId++;
    if (!background) this.setStatus('running');
    return new Promise<TraceResult>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(id);
        this.worker.terminate();
        // Worker 重建後，排在它後面、還沒回應的其他執行也不會有結果了，一併結束
        for (const [otherId, other] of this.pending) {
          clearTimeout(other.timer);
          other.reject(new Error('The Python runtime was restarted. Please run again.'));
          this.pending.delete(otherId);
        }
        this.spawn();
        reject(new Error(`Execution took longer than ${RUN_TIMEOUT_MS / 1000}s and was stopped. The Python runtime is restarting…`));
      }, RUN_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer, background });
      this.worker.postMessage({ type: 'run', id, code, call } satisfies WorkerRequest);
    });
  }
}

export const runner = new PythonRunner();
