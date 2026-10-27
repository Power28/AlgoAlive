import { lazy, Suspense, useState } from 'react';
import { BookmarkCheck, BookmarkPlus, BookOpen, CircleHelp, Code2, History, Languages, Loader2, NotebookPen, Play, RefreshCw } from 'lucide-react';
import { Controls } from './components/Controls';
import { TabBar } from './components/TabBar';
import { CodePreview } from './components/CodePreview';
import { Visualizer } from './components/Visualizer';
import { CallAssist, CallHintBox } from './components/CallAssist';
import { StepLimitBox } from './components/StepLimitBox';
import { lineHint } from './components/ConditionPanel';
import { Tour } from './components/Tour';
import { EmptyState, ErrorBox, EventChip, ModeButton, RuntimeBadge, UpdateToast } from './components/AppParts';
import { usePlayback } from './hooks/usePlayback';
import { usePlaybackKeys } from './hooks/usePlaybackKeys';
import { useRuns, useRuntimeStatus } from './hooks/useRuns';
import { useServiceWorker } from './hooks/useServiceWorker';
import { useStepJump } from './hooks/useStepJump';
import { blankTab, tabFromExample, useTabs } from './hooks/useTabs';
import { useTour } from './hooks/useTour';
import { useTraceView } from './hooks/useTraceView';
import { useTabNotes } from './hooks/useTabNotes';
import { useLang, useT } from './i18n';
import { getLanguage, LANGUAGES, type LanguageId } from './languages';
import { DEFAULT_STEP_LIMIT } from './lib/stepLimit';
import { VarJumpContext } from './lib/stepSearch';
import { appTourSteps } from './lib/tourSteps';
import { getTutorial, type Example, type Tutorial } from './tutorials';

// Monaco 很大（本地打包約 3 MB）：另外拆成一個檔案，下載時先用純文字顯示程式碼（build 時以 modulepreload 和主程式同時下載）
const CodeEditor = lazy(() => import('./components/CodeEditor').then((m) => ({ default: m.CodeEditor })));
// 教學視窗與教學頁：打開時才載入
const Library = lazy(() => import('./components/Library').then((m) => ({ default: m.Library })));
const TutorialView = lazy(() => import('./components/TutorialView').then((m) => ({ default: m.TutorialView })));
// 解題筆記視窗：打開時才載入
const Notes = lazy(() => import('./components/Notes').then((m) => ({ default: m.Notes })));
const spinner = (
  <div className="flex h-full items-center justify-center text-ink-400">
    <Loader2 className="size-5 animate-spin" />
  </div>
);

export default function App() {
  const t = useT();
  const { lang, setLang } = useLang();
  const { tabs, active, select, update, add, close } = useTabs();
  // 目前頁籤的語言：決定執行環境、編輯器語法與程式碼分析
  const language = getLanguage(active.language);
  const runtime = language.runtime();
  const { status, detail: statusDetail } = useRuntimeStatus(runtime);
  const { run, trace, steps, stale, runWith, visualize, forget } = useRuns(active, runtime);
  const view = useTraceView(language, trace, steps, run?.code ?? '');
  const playback = usePlayback(steps.length, trace);
  const step = steps[playback.index];
  const prevStep = playback.index > 0 ? steps[playback.index - 1] : undefined;
  const jump = useStepJump({ steps, index: playback.index, stale: !!stale, setPlaying: playback.setPlaying, seek: playback.seek });
  const [leftMode, setLeftMode] = useState<'code' | 'guide'>('code');
  const [library, setLibrary] = useState<{ topicId?: string } | null>(null);
  const tour = useTour();
  const sw = useServiceWorker();
  const tutorial = getTutorial(active.tutorialId);
  const notes = useTabNotes({ active, language, status, update, add, visualize });
  usePlaybackKeys(playback, !library && !tour.open && !notes.open && steps.length > 0);

  // 導覽要介紹的區塊都在「程式碼」模式；開始時關掉教學視窗
  const startTour = () => {
    setLibrary(null);
    notes.close();
    setLeftMode('code');
    tour.start();
  };
  const tourSteps = appTourSteps(() => {
    if (status === 'ready' && !run?.trace) void visualize();
  });

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
    forget(id);
  };

  const openExample = (example: Example, tu: Tutorial) => {
    add(tabFromExample(example, tu.id));
    setLibrary(null);
    setLeftMode('code');
  };

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
            onClick={() => notes.openNotes()}
            className="relative flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-ink-300 transition hover:bg-ink-700 hover:text-ink-100"
            title={notes.store.dueCount ? t('notesDueBadge', { n: notes.store.dueCount }) : t('notes')}
            data-action="notes"
          >
            <NotebookPen size={14} />
            <span className="hidden sm:inline">{t('notes')}</span>
            {notes.store.dueCount > 0 && (
              <span className="rounded-full bg-brand px-1.5 text-[10px] font-bold text-ink-950" data-notes-due>
                {notes.store.dueCount}
              </span>
            )}
          </button>
          <button
            onClick={startTour}
            className="flex items-center rounded-md p-1.5 text-ink-300 transition hover:bg-ink-700 hover:text-ink-100"
            title={t('tourReplay')}
            aria-label={t('tourReplay')}
            data-action="tour"
          >
            <CircleHelp size={16} />
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
            <button
              onClick={() => {
                setLeftMode('code');
                notes.saveTab();
              }}
              className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-xs text-ink-300 transition hover:bg-ink-700 hover:text-ink-100"
              title={notes.linked ? t('updateNoteHint', { title: notes.linked.title }) : t('saveAsNoteHint')}
              data-action="save-as-note"
            >
              {notes.linked ? <BookmarkCheck size={14} className="text-brand" /> : <BookmarkPlus size={14} />}
              <span className="hidden sm:inline">{notes.linked ? t('updateNote') : t('saveAsNote')}</span>
            </button>
            <label className="flex items-center gap-1.5 text-xs text-ink-400" title={t('languageHint')}>
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
                <Suspense fallback={spinner}>
                  <TutorialView
                    tutorial={tutorial}
                    currentExampleId={active.exampleId}
                    onOpenExample={(ex) => openExample(ex, tutorial)}
                  />
                </Suspense>
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
            <div className="min-h-0 flex-1" data-tour="editor">
              <Suspense fallback={<CodePreview code={active.code} />}>
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
                  jumpLines={jump.jumpLines}
                  onLineJump={jump.jumpToLine}
                />
              </Suspense>
            </div>
            <div className="border-t border-ink-700 p-3" data-tour="call">
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
        <section className="flex min-h-[420px] flex-col overflow-hidden rounded-lg border border-ink-700 bg-ink-850" data-tour="viz">
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
                <span className="rounded bg-ink-700 px-1.5 py-px text-brand">
                  {t('line', { n: step.lineNumber })}
                  {jump.visit !== null && jump.visitTotal > 1 && (
                    <span className="ml-1.5 text-ink-300" data-visit>
                      {t('visitOf', { k: jump.visit, n: jump.visitTotal })}
                    </span>
                  )}
                </span>
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
                error.timeout ? (
                  <StepLimitBox
                    steps={steps}
                    limit={run?.maxSteps ?? DEFAULT_STEP_LIMIT}
                    line={error.line}
                    busy={busy}
                    onMore={(n) => runWith(active.call, n)}
                    onSeek={playback.seek}
                  />
                ) : (
                  <ErrorBox message={error.message} line={error.line} />
                )
              ))}
            {step ? (
              <VarJumpContext.Provider value={jump.varJump}>
                <Visualizer
                  step={step}
                  prev={prevStep}
                  next={steps[playback.index + 1]}
                  cellKeys={view.cellKeys[playback.index] ?? {}}
                  gridKeys={view.gridKeys[playback.index]}
                  indexMap={view.indexMap}
                  slotHeight={view.slotHeight}
                  heapNames={view.heapNames}
                  callTree={view.callTree ? { tree: view.callTree, index: playback.index, onSeek: playback.seek } : undefined}
                  design={view.designCalls ? { calls: view.designCalls, starts: view.starts, onSeek: playback.seek } : undefined}
                  format={language.format}
                  context={{ stack: view.context.stack, loops: view.context.loops, frameKeys: view.context.frameKeys[playback.index] ?? [] }}
                />
              </VarJumpContext.Provider>
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

      {notes.open && (
        <Suspense fallback={null}>
          <Notes
            store={notes.store}
            initialDraft={notes.open.draft}
            initialNoteId={notes.open.noteId}
            onClose={notes.close}
            onDraftSaved={notes.onDraftSaved}
            onOpenSolution={(note, s) => {
              notes.openSolution(note, s);
              setLeftMode('code');
            }}
          />
        </Suspense>
      )}
      {library && (
        <Suspense fallback={null}>
          <Library initialTopicId={library.topicId} onClose={() => setLibrary(null)} onOpenExample={openExample} />
        </Suspense>
      )}
      {tour.open && <Tour steps={tourSteps} onClose={tour.close} />}
      {sw.updateReady && <UpdateToast onUpdate={sw.update} />}
    </div>
  );
}
