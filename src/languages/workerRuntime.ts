import type { TraceResult } from '../types';
import type { LanguageRuntime, RunOptions, RuntimeStatus } from './types';

/** 主執行緒與各語言 Worker 之間的訊息格式 */
export type WorkerRequest = { type: 'run'; id: number; code: string; call: string; maxSteps?: number };
export type WorkerResponse =
  | { type: 'ready' }
  | { type: 'init-error'; message: string }
  | { type: 'result'; id: number; json: string }
  | { type: 'run-error'; id: number; message: string };

/** 單次執行的牆鐘時間上限；超過就砍掉 Worker 重建（MAX_STEPS 擋不住的單行超大運算）。 */
const RUN_TIMEOUT_MS = 10_000;
/** 追蹤更多步時放寬逾時：超過預設 500 步的部分每步多 8ms（5,000 步約 46 秒） */
const timeoutFor = (maxSteps = 500) => RUN_TIMEOUT_MS + Math.max(0, maxSteps - 500) * 8;

type Pending = { resolve: (r: TraceResult) => void; reject: (e: Error) => void; timer: number; background: boolean };

/**
 * 在 Web Worker 中執行追蹤器：管理 Worker 的生命週期與請求對應。
 * 執行卡住（例如單行內的超大運算）時直接 terminate 重建，不會卡住畫面。
 */
export class WorkerRuntime implements LanguageRuntime {
  private worker!: Worker;
  private createWorker: () => Worker;
  /** 錯誤訊息中的執行環境名稱，例如 "Python" */
  private name: string;
  private ready!: Promise<void>;
  private pending = new Map<number, Pending>();
  private nextId = 1;
  private listeners = new Set<(s: RuntimeStatus, detail?: string) => void>();
  status: RuntimeStatus = 'loading';

  constructor(createWorker: () => Worker, name: string) {
    this.createWorker = createWorker;
    this.name = name;
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
    this.worker = this.createWorker();
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

  async run(code: string, call: string, { background = false, maxSteps }: RunOptions = {}): Promise<TraceResult> {
    const timeoutMs = timeoutFor(maxSteps);
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
          other.reject(new Error(`The ${this.name} runtime was restarted. Please run again.`));
          this.pending.delete(otherId);
        }
        this.spawn();
        reject(new Error(`Execution took longer than ${Math.round(timeoutMs / 1000)}s and was stopped. The ${this.name} runtime is restarting…`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer, background });
      this.worker.postMessage({ type: 'run', id, code, call, maxSteps } satisfies WorkerRequest);
    });
  }
}

