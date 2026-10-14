import type { TraceResult } from '../types';
import type { WorkerRequest, WorkerResponse } from './pyodide.worker';

export type RuntimeStatus = 'loading' | 'ready' | 'running' | 'error';

/** 單次執行的牆鐘時間上限；超過就砍掉 Worker 重建（MAX_STEPS 擋不住的單行超大運算）。 */
const RUN_TIMEOUT_MS = 10_000;

type Pending = { resolve: (r: TraceResult) => void; reject: (e: Error) => void; timer: number };

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
    this.setStatus('ready');
    if (msg.type === 'result') p.resolve(JSON.parse(msg.json) as TraceResult);
    else p.reject(new Error(msg.message));
  }

  async run(code: string, call: string): Promise<TraceResult> {
    await this.ready;
    const id = this.nextId++;
    this.setStatus('running');
    return new Promise<TraceResult>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(id);
        this.worker.terminate();
        this.spawn();
        reject(new Error(`Execution took longer than ${RUN_TIMEOUT_MS / 1000}s and was stopped. The Python runtime is restarting…`));
      }, RUN_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer });
      this.worker.postMessage({ type: 'run', id, code, call } satisfies WorkerRequest);
    });
  }
}

export const runner = new PythonRunner();
