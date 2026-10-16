/// JavaScript 追蹤器在獨立 Worker 中執行：使用者的無窮迴圈不會卡住畫面，必要時主執行緒可以直接 terminate 重建。
import type { WorkerRequest, WorkerResponse } from '../workerRuntime';
import { traceJs } from './tracer';

const ctx = self as unknown as Worker;
const post = (msg: WorkerResponse) => ctx.postMessage(msg);

ctx.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  if (req.type !== 'run') return;
  try {
    post({ type: 'result', id: req.id, json: JSON.stringify(traceJs(req.code, req.call, req.maxSteps)) });
  } catch (err) {
    post({ type: 'run-error', id: req.id, message: String(err) });
  }
};

// 不需要下載任何東西，載入後就能執行
post({ type: 'ready' });
