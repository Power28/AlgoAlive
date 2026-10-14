import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { BookOpen, Code2, Languages, Loader2, Play, TriangleAlert, Zap } from 'lucide-react';
import { CodeEditor } from './components/CodeEditor';
import { Controls } from './components/Controls';
import { Library } from './components/Library';
import { TabBar } from './components/TabBar';
import { TutorialView } from './components/TutorialView';
import { Visualizer } from './components/Visualizer';
import { usePlayback } from './hooks/usePlayback';
import { BLANK_CALL, BLANK_CODE, tabFromExample, useTabs } from './hooks/useTabs';
import { useLang, useT } from './i18n';
import { computeCellKeys } from './lib/cellKeys';
import { analyzeIndexing } from './lib/indexing';
import { infoSlotHeight } from './lib/infoSlot';
import { contextInfo } from './lib/context';
import { lineHint } from './components/ConditionPanel';
import { runner, type RuntimeStatus } from './runtime/runner';
import { getTutorial, type Example, type Tutorial } from './tutorials';
import type { TraceResult } from './types';

/** 每個頁籤各自的執行結果（只存在記憶體中） */
interface Run {
  trace: TraceResult | null;
  /** 執行當下的程式碼，用來分析索引與指針 */
  code: string;
  error: string | null;
  stale: boolean;
}

const EMPTY_STEPS: TraceResult['steps'] = [];

export default function App() {
  const t = useT();
  const { lang, setLang } = useLang();
  const { tabs, active, select, update, add, close } = useTabs();
  const [runs, setRuns] = useState<Record<string, Run>>({});
  const [status, setStatus] = useState<RuntimeStatus>(runner.status);
  const [statusDetail, setStatusDetail] = useState<string>();
  const [leftMode, setLeftMode] = useState<'code' | 'guide'>('code');
  const [library, setLibrary] = useState<{ topicId?: string } | null>(null);

  useEffect(
    () =>
      runner.onStatus((s, detail) => {
        setStatus(s);
        setStatusDetail(detail);
      }),
    [],
  );

  const run = runs[active.id];
  const trace = run?.trace ?? null;
  const steps = trace?.steps ?? EMPTY_STEPS;
  const cellKeys = useMemo(() => computeCellKeys(steps), [steps]);
  const indexMap = useMemo(() => analyzeIndexing(run?.code ?? ''), [run?.code]);
  // 卡片欄位高度整段執行只算一次，播放時固定
  const slotHeight = useMemo(() => infoSlotHeight(steps) || undefined, [steps]);
  const context = useMemo(() => contextInfo(steps), [steps]);
  const playback = usePlayback(steps.length, trace);
  const step = steps[playback.index];
  const prevStep = playback.index > 0 ? steps[playback.index - 1] : undefined;
  const tutorial = getTutorial(active.tutorialId);

  const visualize = useCallback(async () => {
    const { id, code, call } = active;
    setRuns((r) => ({ ...r, [id]: { trace: r[id]?.trace ?? null, code: r[id]?.code ?? code, error: null, stale: r[id]?.stale ?? false } }));
    try {
      const result = await runner.run(code, call);
      setRuns((r) => ({ ...r, [id]: { trace: result, code, error: null, stale: false } }));
    } catch (err) {
      setRuns((r) => ({ ...r, [id]: { trace: null, code, error: err instanceof Error ? err.message : String(err), stale: false } }));
    }
  }, [active]);

  const editActive = (patch: { code?: string; call?: string }) => {
    update(active.id, patch);
    if (runs[active.id]?.trace) setRuns((r) => ({ ...r, [active.id]: { ...r[active.id], stale: true } }));
  };

  const closeTab = (id: string) => {
    close(id);
    setRuns(({ [id]: _removed, ...rest }) => rest);
  };

  const openExample = (example: Example, tu: Tutorial) => {
    add(tabFromExample(example, tu.id));
    setLibrary(null);
    setLeftMode('code');
  };

  // 鍵盤快捷鍵：焦點不在輸入框 / 編輯器、教學視窗未開啟時才生效
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (library || el.closest('input, textarea, button, .monaco-editor') || !steps.length) return;
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
  }, [playback, steps.length, library]);

  const busy = status === 'loading' || status === 'running';
  const error = trace?.error;
  // 沒有任何步驟的錯誤（例如 SyntaxError）直接標在編輯器上
  const errorLine = error && (!step || step.event !== 'line') ? error.line : null;

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-ink-700 bg-ink-850 px-3 sm:gap-3 sm:px-4">
        <div className="flex shrink-0 items-center gap-2">
          <img src="./favicon.svg" alt="" className="size-7" />
          <div className="hidden leading-tight sm:block">
            <div className="text-[15px] font-bold tracking-tight">
              Algo<span className="text-brand">Alive</span>
            </div>
            <div className="hidden text-[11px] text-ink-400 xl:block">{t('slogan')}</div>
          </div>
        </div>

        <div className="mx-1 hidden h-6 w-px shrink-0 bg-ink-700 sm:block" />

        <TabBar
          tabs={tabs}
          activeId={active.id}
          onSelect={select}
          onClose={closeTab}
          onRename={(id, title) => update(id, { title })}
          onNewBlank={() => {
            add({ title: '', code: BLANK_CODE, call: BLANK_CALL });
            setLeftMode('code');
          }}
          onOpenLibrary={() => setLibrary({})}
        />

        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => setLibrary({ topicId: active.tutorialId })}
            className="flex items-center gap-1.5 rounded-md border border-brand/40 bg-brand/10 px-2.5 py-1.5 text-xs font-semibold text-brand transition hover:bg-brand/20"
            data-action="library"
          >
            <BookOpen size={14} />
            <span className="hidden sm:inline">{t('learn')}</span>
          </button>
          <button
            onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
            className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-ink-300 transition hover:bg-ink-700 hover:text-ink-100"
            title="English / 中文"
            data-action="lang"
          >
            <Languages size={14} />
            {lang === 'en' ? '中文' : 'EN'}
          </button>
          <RuntimeBadge status={status} detail={statusDetail} />
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-2 bg-ink-950 p-2 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* 左：程式碼 / 教學 */}
        <section className="flex min-h-[420px] flex-col overflow-hidden rounded-lg border border-ink-700 bg-ink-850">
          <div className="flex h-10 shrink-0 items-center gap-1 border-b border-ink-700 px-2">
            <ModeButton active={leftMode === 'code'} onClick={() => setLeftMode('code')} icon={<Code2 size={14} />}>
              {t('code')} <span className="font-normal text-ink-400">· Python 3</span>
            </ModeButton>
            <ModeButton active={leftMode === 'guide'} onClick={() => setLeftMode('guide')} icon={<BookOpen size={14} />} data-action="guide">
              {t('guide')}
            </ModeButton>
          </div>

          {leftMode === 'guide' && (
            <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {tutorial ? (
                <TutorialView
                  tutorial={tutorial}
                  currentExampleId={active.exampleId}
                  onOpenExample={(ex) => openExample(ex, tutorial)}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-ink-400">
                  <BookOpen size={28} className="text-ink-600" />
                  <p>{t('noGuide')}</p>
                  <button
                    onClick={() => setLibrary({})}
                    className="rounded-md bg-ink-700 px-3 py-1.5 text-xs text-ink-100 transition hover:bg-ink-600"
                  >
                    {t('browseTutorials')}
                  </button>
                </div>
              )}
            </div>
          )}

          <div className={leftMode === 'code' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
            <div className="min-h-0 flex-1">
              <CodeEditor
                path={active.id}
                value={active.code}
                onChange={(v) => editActive({ code: v })}
                currentLine={step?.lineNumber}
                prevLine={prevStep?.lineNumber}
                errorLine={errorLine}
                hint={run?.stale ? undefined : lineHint(step)}
                onRun={visualize}
              />
            </div>
            <div className="border-t border-ink-700 p-3">
              <label className="mb-1.5 block text-[11px] tracking-wide text-ink-400 uppercase">{t('testCall')}</label>
              <div className="flex gap-2">
                <input
                  value={active.call}
                  onChange={(e) => editActive({ call: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && visualize()}
                  spellCheck={false}
                  className="min-w-0 flex-1 rounded-md border border-ink-600 bg-ink-900 px-3 py-2 font-mono text-sm outline-none focus:border-brand"
                  placeholder="twoSum([2, 7, 11, 15], 9)"
                />
                <button
                  onClick={visualize}
                  disabled={busy || status === 'error'}
                  className="flex shrink-0 items-center gap-2 rounded-md bg-ok px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
                  title={t('visualizeHint')}
                  data-action="visualize"
                >
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
                  {t('visualize')}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 右：動畫 */}
        <section className="flex min-h-[420px] flex-col overflow-hidden rounded-lg border border-ink-700 bg-ink-850">
          <div className="flex h-10 shrink-0 items-center gap-1 border-b border-ink-700 px-4 text-xs font-semibold tracking-wide text-ink-100 uppercase">
            {t('visualization')}
            {step && (
              <span className="ml-auto flex items-center gap-2 font-mono text-[11px] normal-case">
                <span className="text-ink-300">
                  {step.funcName}()
                  {step.depth > 1 && <span className="text-ink-400"> · {t('depth', { n: step.depth })}</span>}
                </span>
                <span className="rounded bg-ink-700 px-1.5 py-px text-brand">{t('line', { n: step.lineNumber })}</span>
                <EventChip event={step.event} />
              </span>
            )}
          </div>

          {run?.stale && <div className="border-b border-brand/30 bg-brand/10 px-4 py-1.5 text-xs text-brand">{t('stale')}</div>}

          <div className="scrollbar-thin min-h-0 flex-1 overflow-auto p-5">
            {run?.error && <ErrorBox message={run.error} />}
            {error && <ErrorBox message={error.message} line={error.line} timeout={error.timeout} />}
            {step ? (
              <Visualizer step={step} prev={prevStep} cellKeys={cellKeys[playback.index] ?? {}} indexMap={indexMap}
                slotHeight={slotHeight}
                context={{ stack: context.stack, loops: context.loops, frameKeys: context.frameKeys[playback.index] ?? [] }}
              />
            ) : (
              !error && !run?.error && <EmptyState status={status} />
            )}
            {trace && !error && playback.index === playback.last && trace.returnValue && (
              <div className="mt-6 text-xs text-ink-400">{t('finished')}</div>
            )}
          </div>

          {step && step.stdout && (
            <div className="max-h-28 shrink-0 overflow-auto border-t border-ink-700 bg-ink-900 px-4 py-2">
              <div className="mb-1 text-[11px] tracking-wide text-ink-400 uppercase">{t('stdout')}</div>
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

      {library && <Library initialTopicId={library.topicId} onClose={() => setLibrary(null)} onOpenExample={openExample} />}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  icon,
  children,
  ...rest
}: { active: boolean; onClick: () => void; icon: ReactNode; children: ReactNode; 'data-action'?: string }) {
  return (
    <button
      onClick={onClick}
      {...rest}
      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold tracking-wide uppercase transition ${
        active ? 'bg-ink-700 text-ink-100' : 'text-ink-400 hover:text-ink-100'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function EventChip({ event }: { event: 'line' | 'return' | 'exception' }) {
  const t = useT();
  const map = {
    line: [t('nextToRun'), 'bg-ink-700 text-ink-300'],
    return: [t('eventReturn'), 'bg-ok/20 text-ok'],
    exception: [t('eventException'), 'bg-err/20 text-err'],
  } as const;
  const [label, cls] = map[event];
  return <span className={`rounded px-1.5 py-px ${cls}`}>{label}</span>;
}

function RuntimeBadge({ status, detail }: { status: RuntimeStatus; detail?: string }) {
  const t = useT();
  if (status === 'loading')
    return (
      <span className="flex items-center gap-1.5 text-xs text-ink-400">
        <Loader2 size={14} className="animate-spin" /> <span className="hidden md:inline">{t('runtimeLoading')}</span>
      </span>
    );
  if (status === 'error')
    return (
      <span className="flex items-center gap-1.5 text-xs text-err" title={detail}>
        <TriangleAlert size={14} /> <span className="hidden md:inline">{t('runtimeFailed')}</span>
      </span>
    );
  return (
    <span className="flex items-center gap-1.5 text-xs text-ok" data-runtime="ready" title={t('runtimeReady')}>
      <Zap size={14} /> <span className="hidden md:inline">{t('runtimeReady')}</span>
    </span>
  );
}

function ErrorBox({ message, line, timeout }: { message: string; line?: number | null; timeout?: boolean }) {
  const t = useT();
  return (
    <div className="mb-5 flex items-start gap-2 rounded-lg border border-err/40 bg-err/10 px-3 py-2 text-sm text-err">
      <TriangleAlert size={16} className="mt-0.5 shrink-0" />
      <div>
        <div className="font-mono">{message}</div>
        {line ? <div className="mt-0.5 text-xs text-err/80">{t('atLine', { n: line })}</div> : null}
        {timeout && <div className="mt-0.5 text-xs text-err/80">{t('timeoutNote')}</div>}
      </div>
    </div>
  );
}

function EmptyState({ status }: { status: RuntimeStatus }) {
  const t = useT();
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
      <p className="max-w-sm text-sm">{status === 'loading' ? t('emptyLoading') : t('emptyIdle')}</p>
    </div>
  );
}
