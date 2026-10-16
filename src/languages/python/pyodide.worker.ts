/// Pyodide 在獨立 Worker 中執行，避免 Python 執行時卡住 UI；
/// 若真的卡死（例如單行內的超大運算），主執行緒可直接 terminate 重建。
import tracerSource from './tracer.py?raw';

export const PYODIDE_VERSION = '0.26.2';
const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

export type WorkerRequest = { type: 'run'; id: number; code: string; call: string };
export type WorkerResponse =
  | { type: 'ready' }
  | { type: 'init-error'; message: string }
  | { type: 'result'; id: number; json: string }
  | { type: 'run-error'; id: number; message: string };

interface PyodideAPI {
  runPython(code: string): unknown;
  globals: { get(name: string): (...args: unknown[]) => string };
}

const ctx = self as unknown as Worker;
const post = (msg: WorkerResponse) => ctx.postMessage(msg);

let runTrace: ((code: string, call: string) => string) | null = null;

async function init() {
  try {
    const mod = await import(/* @vite-ignore */ `${PYODIDE_URL}pyodide.mjs`);
    const pyodide: PyodideAPI = await mod.loadPyodide({ indexURL: PYODIDE_URL });
    pyodide.runPython(tracerSource);
    const fn = pyodide.globals.get('algoalive_run');
    runTrace = (code, call) => fn(code, call);
    post({ type: 'ready' });
  } catch (err) {
    post({ type: 'init-error', message: String(err) });
  }
}

ctx.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  if (req.type !== 'run') return;
  if (!runTrace) {
    post({ type: 'run-error', id: req.id, message: 'Python runtime is not ready yet' });
    return;
  }
  try {
    post({ type: 'result', id: req.id, json: runTrace(req.code, req.call) });
  } catch (err) {
    post({ type: 'run-error', id: req.id, message: String(err) });
  }
};

init();
