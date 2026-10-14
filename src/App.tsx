import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Loader2, Play, TriangleAlert, Zap } from 'lucide-react';
import { CodeEditor } from './components/CodeEditor';
import { Controls } from './components/Controls';
import { Visualizer } from './components/Visualizer';
import { EXAMPLES } from './examples';
import { usePlayback } from './hooks/usePlayback';
import { computeCellKeys } from './lib/cellKeys';
import { runner, type RuntimeStatus } from './runtime/runner';
import type { TraceResult } from './types';

export default function App() {
  const [exampleId, setExampleId] = useState(EXAMPLES[0].id);
  const [code, setCode] = useState(EXAMPLES[0].code);
  const [call, setCall] = useState(EXAMPLES[0].call);
  const [trace, setTrace] = useState<TraceResult | null>(null);
  const [stale, setStale] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [status, setStatus] = useState<RuntimeStatus>(runner.status);
  const [statusDetail, setStatusDetail] = useState<string>();

  useEffect(
    () =>
      runner.onStatus((s, detail) => {
        setStatus(s);
        setStatusDetail(detail);
      }),
    [],
  );

  const steps = trace?.steps ?? [];
  const cellKeys = useMemo(() => computeCellKeys(steps), [steps]);
  const playback = usePlayback(steps.length, trace);
  const step = steps[playback.index];
  const prevStep = playback.index > 0 ? steps[playback.index - 1] : undefined;

  const visualize = useCallback(async () => {
    setRunError(null);
    try {
      const result = await runner.run(code, call);
      setTrace(result);
      setStale(false);
    } catch (err) {
      setTrace(null);
      setRunError(err instanceof Error ? err.message : String(err));
    }
  }, [code, call]);

  const loadExample = (id: string) => {
    const ex = EXAMPLES.find((e) => e.id === id)!;
    setExampleId(id);
    setCode(ex.code);
    setCall(ex.call);
    setTrace(null);
    setRunError(null);
  };

  // 鍵盤快捷鍵：焦點不在輸入框 / 編輯器時才生效
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, .monaco-editor') || !steps.length) return;
      if (e.key === 'ArrowRight') playback.next();
      else if (e.key === 'ArrowLeft') playback.prev();
      else if (e.key === ' ') playback.togglePlay();
      else if (e.key === 'Home') playback.seek(0);
      else if (e.key === 'End') playback.seek(playback.last);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playback, steps.length]);

  const busy = status === 'loading' || status === 'running';
  const error = trace?.error;
  // 沒有任何步驟的錯誤（例如 SyntaxError）直接標在編輯器上
  const errorLine = error && (!step || step.event !== 'line') ? error.line : null;

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-ink-700 bg-ink-850 px-4">
        <div className="flex items-center gap-2">
          <img src="./favicon.svg" alt="" className="size-7" />
          <div className="leading-tight">
            <div className="text-[15px] font-bold tracking-tight">
              Algo<span className="text-brand">Alive</span>
            </div>
            <div className="hidden text-[11px] text-ink-400 sm:block">Bring your LeetCode algorithms to life</div>
          </div>
        </div>

        <nav className="scrollbar-thin ml-4 flex min-w-0 gap-1 overflow-x-auto">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.id}
              onClick={() => loadExample(ex.id)}
              className={`shrink-0 rounded-md px-3 py-1.5 text-left text-xs transition ${
                ex.id === exampleId ? 'bg-ink-700 text-ink-100' : 'text-ink-400 hover:bg-ink-800 hover:text-ink-100'
              }`}
            >
              <span className="font-mono text-brand">{ex.number}.</span> {ex.title}
              <span className="ml-2 rounded bg-ink-600/60 px-1.5 py-px text-[10px] text-ink-300">{ex.tag}</span>
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <RuntimeBadge status={status} detail={statusDetail} />
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-2 bg-ink-950 p-2 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* 左：程式碼 + 測資 */}
        <section className="flex min-h-[420px] flex-col overflow-hidden rounded-lg border border-ink-700 bg-ink-850">
          <PanelTitle>
            Code <span className="text-ink-400">· Python 3</span>
          </PanelTitle>
          <div className="min-h-0 flex-1">
            <CodeEditor
              value={code}
              onChange={(v) => {
                setCode(v);
                if (trace) setStale(true);
              }}
              currentLine={step?.lineNumber}
              prevLine={prevStep?.lineNumber}
              errorLine={errorLine}
              onRun={visualize}
            />
          </div>
          <div className="border-t border-ink-700 p-3">
            <label className="mb-1.5 block text-[11px] tracking-wide text-ink-400 uppercase">Test call</label>
            <div className="flex gap-2">
              <input
                value={call}
                onChange={(e) => {
                  setCall(e.target.value);
                  if (trace) setStale(true);
                }}
                onKeyDown={(e) => e.key === 'Enter' && visualize()}
                spellCheck={false}
                className="min-w-0 flex-1 rounded-md border border-ink-600 bg-ink-900 px-3 py-2 font-mono text-sm outline-none focus:border-brand"
                placeholder="twoSum([2, 7, 11, 15], 9)"
              />
              <button
                onClick={visualize}
                disabled={busy || status === 'error'}
                className="flex shrink-0 items-center gap-2 rounded-md bg-ok px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
                title="Visualize (Ctrl+Enter)"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
                Visualize
              </button>
            </div>
          </div>
        </section>

        {/* 右：動畫 */}
        <section className="flex min-h-[420px] flex-col overflow-hidden rounded-lg border border-ink-700 bg-ink-850">
          <PanelTitle>
            Visualization
            {step && (
              <span className="ml-auto flex items-center gap-2 font-mono text-[11px] normal-case">
                <span className="text-ink-300">
                  {step.funcName}()
                  {step.depth > 1 && <span className="text-ink-400"> · depth {step.depth}</span>}
                </span>
                <span className="rounded bg-ink-700 px-1.5 py-px text-brand">line {step.lineNumber}</span>
                <EventChip event={step.event} />
              </span>
            )}
          </PanelTitle>

          {stale && (
            <div className="border-b border-brand/30 bg-brand/10 px-4 py-1.5 text-xs text-brand">
              Code or input changed — press Visualize to refresh the trace.
            </div>
          )}

          <div className="scrollbar-thin min-h-0 flex-1 overflow-auto p-5">
            {runError && <ErrorBox message={runError} />}
            {error && <ErrorBox message={error.message} line={error.line} timeout={error.timeout} />}
            {step ? (
              <Visualizer step={step} prev={prevStep} cellKeys={cellKeys[playback.index] ?? {}} />
            ) : (
              !error && !runError && <EmptyState status={status} />
            )}
            {trace && !error && playback.index === playback.last && trace.returnValue && (
              <div className="mt-6 text-xs text-ink-400">Execution finished.</div>
            )}
          </div>

          {step && step.stdout && (
            <div className="max-h-28 shrink-0 overflow-auto border-t border-ink-700 bg-ink-900 px-4 py-2">
              <div className="mb-1 text-[11px] tracking-wide text-ink-400 uppercase">stdout</div>
              <pre className="font-mono text-xs whitespace-pre-wrap text-ink-300">{step.stdout}</pre>
            </div>
          )}

          <Controls
            index={playback.index}
            last={playback.last}
            playing={playback.playing}
            speed={playback.speed}
            disabled={!steps.length}
            onSeek={playback.seek}
            onPrev={playback.prev}
            onNext={playback.next}
            onTogglePlay={playback.togglePlay}
            onSpeed={playback.setSpeed}
          />
        </section>
      </main>
    </div>
  );
}

function PanelTitle({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-10 shrink-0 items-center gap-1 border-b border-ink-700 px-4 text-xs font-semibold tracking-wide text-ink-100 uppercase">
      {children}
    </div>
  );
}

function EventChip({ event }: { event: 'line' | 'return' | 'exception' }) {
  const map = {
    line: ['next to run', 'bg-ink-700 text-ink-300'],
    return: ['return', 'bg-ok/20 text-ok'],
    exception: ['exception', 'bg-err/20 text-err'],
  } as const;
  const [label, cls] = map[event];
  return <span className={`rounded px-1.5 py-px ${cls}`}>{label}</span>;
}

function RuntimeBadge({ status, detail }: { status: RuntimeStatus; detail?: string }) {
  if (status === 'loading')
    return (
      <span className="flex items-center gap-1.5 text-xs text-ink-400">
        <Loader2 size={14} className="animate-spin" /> Loading Python…
      </span>
    );
  if (status === 'error')
    return (
      <span className="flex items-center gap-1.5 text-xs text-err" title={detail}>
        <TriangleAlert size={14} /> Runtime failed to load
      </span>
    );
  return (
    <span className="flex items-center gap-1.5 text-xs text-ok">
      <Zap size={14} /> Pyodide ready
    </span>
  );
}

function ErrorBox({ message, line, timeout }: { message: string; line?: number | null; timeout?: boolean }) {
  return (
    <div className="mb-5 flex items-start gap-2 rounded-lg border border-err/40 bg-err/10 px-3 py-2 text-sm text-err">
      <TriangleAlert size={16} className="mt-0.5 shrink-0" />
      <div>
        <div className="font-mono">{message}</div>
        {line ? <div className="mt-0.5 text-xs text-err/80">at line {line}</div> : null}
        {timeout && <div className="mt-0.5 text-xs text-err/80">Showing the steps recorded before the limit.</div>}
      </div>
    </div>
  );
}

function EmptyState({ status }: { status: RuntimeStatus }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-ink-400">
      <div className="flex gap-2">
        {[3, 8, 11, 2].map((n, i) => (
          <div
            key={i}
            className={`flex size-11 items-center justify-center rounded-md border font-mono text-sm ${
              i === 0 || i === 3 ? 'border-brand/60 text-ink-100' : 'border-ink-600'
            }`}
          >
            {n}
          </div>
        ))}
      </div>
      <p className="max-w-sm text-sm">
        {status === 'loading'
          ? 'Downloading the Python runtime (first load takes a few seconds)…'
          : 'Write a Python function, set the test call, then press Visualize (Ctrl+Enter) to watch it run step by step.'}
      </p>
    </div>
  );
}
