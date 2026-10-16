import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { BookOpen, Code2, History, Languages, Loader2, Play, RefreshCw, TriangleAlert, Zap } from 'lucide-react';
import { CodeEditor } from './components/CodeEditor';
import { Controls } from './components/Controls';
import { Library } from './components/Library';
import { TabBar } from './components/TabBar';
import { TutorialView } from './components/TutorialView';
import { Visualizer } from './components/Visualizer';
import { usePlayback } from './hooks/usePlayback';
import { blankTab, tabFromExample, useTabs } from './hooks/useTabs';
import { useLang, useT } from './i18n';
import { computeCellKeys, computeGridKeys } from './lib/cellKeys';
import { infoSlotHeight } from './lib/infoSlot';
import { contextInfo } from './lib/context';
import { buildCallTree, hasRecursion, showCallTree } from './lib/callTree';
import { designStarts } from './components/DesignTimeline';
import { CallAssist, CallHintBox } from './components/CallAssist';
import { lineHint } from './components/ConditionPanel';
import { getLanguage, LANGUAGES, type LanguageId } from './languages';
import type { RuntimeStatus } from './languages/types';
import { getTutorial, type Example, type Tutorial } from './tutorials';
import type { TraceResult } from './types';

/** 每個頁籤各自的執行結果（只存在記憶體中） */
interface Run {
  trace: TraceResult | null;
  /** 執行當下的程式碼，用來分析索引與指針；與目前的程式碼不同時，畫面上的動畫就是舊的 */
  code: string;
  /** 執行當下的測試呼叫 */
  call: string;
  error: string | null;
}

/** 動畫是不是舊的：比較目前與上次執行時的程式碼、測資（改回原樣就不算修改） */
function staleness(run: Run | undefined, code: string, call: string): 'code' | 'call' | 'both' | null {
  if (!run?.trace) return null;
  const codeChanged = run.code !== code;
  const callChanged = run.call !== call;
  return codeChanged && callChanged ? 'both' : codeChanged ? 'code' : callChanged ? 'call' : null;
}

const EMPTY_STEPS: TraceResult['steps'] = [];

export default function App() {
  const t = useT();
  const { lang, setLang } = useLang();
  const { tabs, active, select, update, add, close } = useTabs();
  const [runs, setRuns] = useState<Record<string, Run>>({});
  // 目前頁籤的語言：決定執行環境、編輯器語法與程式碼分析
  const language = getLanguage(active.language);
  const runtime = language.runtime();
  const [status, setStatus] = useState<RuntimeStatus>(runtime.status);
  const [statusDetail, setStatusDetail] = useState<string>();
  const [leftMode, setLeftMode] = useState<'code' | 'guide'>('code');
  const [library, setLibrary] = useState<{ topicId?: string } | null>(null);

  useEffect(
    () =>
      runtime.onStatus((s, detail) => {
        setStatus(s);
        setStatusDetail(detail);
      }),
    [runtime],
  );

  const run = runs[active.id];
  const stale = staleness(run, active.code, active.call);
  const trace = run?.trace ?? null;
  const steps = trace?.steps ?? EMPTY_STEPS;
  const cellKeys = useMemo(() => computeCellKeys(steps), [steps]);
  const gridKeys = useMemo(() => computeGridKeys(steps), [steps]);
  const indexMap = useMemo(() => language.analyzeIndexing(run?.code ?? ''), [language, run?.code]);
  // 卡片欄位高度整段執行只算一次，播放時固定
  const slotHeight = useMemo(() => infoSlotHeight(steps) || undefined, [steps]);
  const context = useMemo(() => contextInfo(steps), [steps]);
  const heapNames = useMemo(() => language.analyzeHeaps(run?.code ?? ''), [language, run?.code]);
  // 設計類題目由操作順序說明，每個方法各自一次呼叫，不另外畫遞迴樹（除非方法內真的有遞迴）
  const callTree = useMemo(() => {
    const tree = buildCallTree(steps, language.format);
    if (trace?.design && !hasRecursion(tree)) return null;
    return showCallTree(tree) ? tree : null;
  }, [steps, trace?.design, language]);
  const designCalls = trace?.design?.calls;
  const starts = useMemo(() => (designCalls ? designStarts(steps, designCalls.length) : []), [steps, designCalls]);
  const playback = usePlayback(steps.length, trace);
  const step = steps[playback.index];
  const prevStep = playback.index > 0 ? steps[playback.index - 1] : undefined;
  const tutorial = getTutorial(active.tutorialId);

  /** 以指定的測資執行（一鍵修正測試呼叫時，新的測資還沒反映到 active） */
  const runWith = useCallback(async (call: string) => {
    const { id, code } = active;
    setRuns((r) => ({ ...r, [id]: { trace: r[id]?.trace ?? null, code: r[id]?.code ?? code, call: r[id]?.call ?? call, error: null } }));
    try {
      const result = await runtime.run(code, call);
      setRuns((r) => ({ ...r, [id]: { trace: result, code, call, error: null } }));
    } catch (err) {
      setRuns((r) => ({ ...r, [id]: { trace: null, code, call, error: err instanceof Error ? err.message : String(err) } }));
    }
  }, [active, runtime]);
  const visualize = useCallback(() => runWith(active.call), [runWith, active.call]);

  const editActive = (patch: { code?: string; call?: string }) => {
    update(active.id, patch);
  };

  /** 切換語言：程式碼還是範本（或空白）時直接換成新語言的範本；已經修改過就開新頁籤，不覆蓋 */
  const switchLanguage = (id: LanguageId) => {
    if (id === language.id) return;
    const untouched = !active.code.trim() || active.code === language.blank.code;
    if (untouched && !active.exampleId) {
      const { blank } = getLanguage(id);
      update(active.id, { language: id, code: blank.code, call: blank.call });
    } else {
      add(blankTab(id));
    }
    setLeftMode('code');
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
            add(blankTab(active.language));
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
          <RuntimeBadge status={status} detail={statusDetail} name={language.runtimeName} />
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-2 bg-ink-950 p-2 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* 左：程式碼 / 教學 */}
        <section className="flex min-h-[420px] flex-col overflow-hidden rounded-lg border border-ink-700 bg-ink-850">
          <div className="flex h-10 shrink-0 items-center gap-1 border-b border-ink-700 px-2">
            <ModeButton active={leftMode === 'code'} onClick={() => setLeftMode('code')} icon={<Code2 size={14} />}>
              {t('code')}
            </ModeButton>
            <ModeButton active={leftMode === 'guide'} onClick={() => setLeftMode('guide')} icon={<BookOpen size={14} />} data-action="guide">
              {t('guide')}
            </ModeButton>
            <label className="ml-auto flex items-center gap-1.5 text-xs text-ink-400" title={t('languageHint')}>
              <span className="hidden sm:inline">{t('languageLabel')}</span>
              <select
                value={language.id}
                onChange={(e) => switchLanguage(e.target.value as LanguageId)}
                className="rounded-md border border-ink-600 bg-ink-900 px-1.5 py-1 text-xs text-ink-100 outline-none focus:border-brand"
                data-action="language"
              >
                {Object.values(LANGUAGES).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
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
                language={language.monaco}
                value={active.code}
                onChange={(v) => editActive({ code: v })}
                currentLine={step?.lineNumber}
                prevLine={prevStep?.lineNumber}
                errorLine={errorLine}
                hint={stale ? undefined : lineHint(step, language.format)}
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
                  placeholder={language.callPlaceholder}
                />
                <button
                  onClick={visualize}
                  disabled={busy || status === 'error'}
                  // 動畫是舊的時候，按鈕外圈脈動提示要重新執行
                  className={`flex shrink-0 items-center gap-2 rounded-md bg-ok px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50 ${stale && !busy ? 'aa-pulse-ring' : ''}`}
                  title={t('visualizeHint')}
                  data-action="visualize"
                >
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
                  {t('visualize')}
                </button>
              </div>
              <CallAssist
                language={language}
                code={active.code}
                call={active.call}
                info={stale ? undefined : trace?.call}
                hasFix={!stale && !!error?.hint && 'fix' in error.hint && !!error.hint.fix}
                onFill={(c) => editActive({ call: c })}
              />
            </div>
          </div>
        </section>

        {/* 右：動畫 */}
        <section className="flex min-h-[420px] flex-col overflow-hidden rounded-lg border border-ink-700 bg-ink-850">
          <div className="flex h-10 shrink-0 items-center gap-1 border-b border-ink-700 px-4 text-xs font-semibold tracking-wide text-ink-100 uppercase">
            {t('visualization')}
            {stale && (
              <span className="ml-2 flex items-center gap-1 rounded bg-brand/15 px-1.5 py-px text-[10px] font-semibold text-brand normal-case" data-stale-badge>
                <History size={11} />
                {t('staleBadge')}
              </span>
            )}
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

          {stale && (
            // 明顯的提示卡：說明哪裡改了、下面是舊的結果，直接在這裡重新執行
            <div className="shrink-0 border-b border-brand/40 bg-brand/10 px-4 py-3" data-stale={stale}>
              <div className="flex flex-wrap items-center gap-3">
                <RefreshCw size={18} className="shrink-0 text-brand" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-brand">{t(stale === 'code' ? 'staleCode' : stale === 'call' ? 'staleCall' : 'staleBoth')}</div>
                  <div className="text-xs text-ink-300">{t('staleDetail')}</div>
                </div>
                <button
                  onClick={visualize}
                  disabled={busy || status === 'error'}
                  className="flex shrink-0 items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-ink-900 transition hover:brightness-110 disabled:opacity-50"
                  title={t('visualizeHint')}
                  data-action="revisualize"
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  {t('revisualize')}
                </button>
              </div>
            </div>
          )}

          <div
            className="scrollbar-thin min-h-0 flex-1 overflow-auto p-5 transition-[opacity,filter] duration-300"
            // 舊的動畫淡化成灰階，一眼看得出不是目前程式碼的結果（仍可以播放、拖曳）
            style={{ opacity: stale ? 0.45 : 1, filter: stale ? 'grayscale(0.85)' : 'none' }}
          >
            {run?.error && <ErrorBox message={run.error} />}
            {error &&
              (error.hint ? (
                <CallHintBox
                  hint={error.hint}
                  onFix={(fix) => {
                    editActive({ call: fix });
                    runWith(fix);
                  }}
                />
              ) : (
                <ErrorBox message={error.message} line={error.line} timeout={error.timeout} />
              ))}
            {step ? (
              <Visualizer step={step} prev={prevStep} next={steps[playback.index + 1]} cellKeys={cellKeys[playback.index] ?? {}} gridKeys={gridKeys[playback.index]} indexMap={indexMap}
                slotHeight={slotHeight}
                heapNames={heapNames}
                callTree={callTree ? { tree: callTree, index: playback.index, onSeek: playback.seek } : undefined}
                design={designCalls ? { calls: designCalls, starts, onSeek: playback.seek } : undefined}
                format={language.format}
                context={{ stack: context.stack, loops: context.loops, frameKeys: context.frameKeys[playback.index] ?? [] }}
              />
            ) : (
              !error && !run?.error && <EmptyState status={status} name={language.runtimeName} />
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

function RuntimeBadge({ status, detail, name }: { status: RuntimeStatus; detail?: string; name: string }) {
  const t = useT();
  const lang = { lang: name };
  if (status === 'loading')
    return (
      <span className="flex items-center gap-1.5 text-xs text-ink-400">
        <Loader2 size={14} className="animate-spin" /> <span className="hidden md:inline">{t('runtimeLoading', lang)}</span>
      </span>
    );
  if (status === 'error')
    return (
      <span className="flex items-center gap-1.5 text-xs text-err" title={detail}>
        <TriangleAlert size={14} /> <span className="hidden md:inline">{t('runtimeFailed', lang)}</span>
      </span>
    );
  return (
    <span className="flex items-center gap-1.5 text-xs text-ok" data-runtime="ready" title={t('runtimeReady', lang)}>
      <Zap size={14} /> <span className="hidden md:inline">{t('runtimeReady', lang)}</span>
    </span>
  );
}

function ErrorBox({ message, line, timeout }: { message: string; line?: number | null; timeout?: boolean }) {
  const t = useT();
  return (
    <div data-error className="mb-5 flex items-start gap-2 rounded-lg border border-err/40 bg-err/10 px-3 py-2 text-sm text-err">
      <TriangleAlert size={16} className="mt-0.5 shrink-0" />
      <div>
        <div className="font-mono">{message}</div>
        {line ? <div className="mt-0.5 text-xs text-err/80">{t('atLine', { n: line })}</div> : null}
        {timeout && <div className="mt-0.5 text-xs text-err/80">{t('timeoutNote')}</div>}
      </div>
    </div>
  );
}

function EmptyState({ status, name }: { status: RuntimeStatus; name: string }) {
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
      <p className="max-w-sm text-sm">{t(status === 'loading' ? 'emptyLoading' : 'emptyIdle', { lang: name })}</p>
    </div>
  );
}
