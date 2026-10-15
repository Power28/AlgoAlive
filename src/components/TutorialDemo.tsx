import { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Loader2, Pause, Play, RotateCcw } from 'lucide-react';
import { useL, useT } from '../i18n';
import { computeCellKeys } from '../lib/cellKeys';
import { analyzeHeaps, analyzeIndexing } from '../lib/indexing';
import { infoSlotHeight } from '../lib/infoSlot';
import { contextInfo } from '../lib/context';
import { buildCallTree, showCallTree } from '../lib/callTree';
import { runner } from '../runtime/runner';
import type { Example, Tutorial } from '../tutorials';
import type { TraceResult } from '../types';
import { Visualizer } from './Visualizer';
import { lineHint } from './ConditionPanel';

/** 範例的 trace 只算一次；同一個範例重複開啟時直接沿用 */
const traceCache = new Map<string, Promise<TraceResult>>();
function loadTrace(ex: Example): Promise<TraceResult> {
  let p = traceCache.get(ex.id);
  if (!p) {
    p = runner.run(ex.code, ex.call, { background: true });
    p.catch(() => traceCache.delete(ex.id)); // 失敗的不快取，下次重試
    traceCache.set(ex.id, p);
  }
  return p;
}

const STEP_MS = 800;
/** 播到最後一步後停留多久再重播 */
const END_HOLD_MS = 2200;

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

interface Props {
  tutorial: Tutorial;
  onOpenExample: (example: Example) => void;
}

/** 教學頁上方的動畫示範：自動循環播放範例的執行過程（左：程式碼，右：視覺化） */
export function TutorialDemo({ tutorial, onOpenExample }: Props) {
  const t = useT();
  const l = useL();
  const [exampleId, setExampleId] = useState(tutorial.examples[0].id);
  const example = tutorial.examples.find((e) => e.id === exampleId) ?? tutorial.examples[0];
  const [trace, setTrace] = useState<TraceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());
  const [visible, setVisible] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    setTrace(null);
    setError(null);
    setIndex(0);
    loadTrace(example)
      .then((tr) => alive && setTrace(tr))
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [example]);

  // 捲出畫面時暫停，省得在背後一直重繪
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const steps = trace?.steps ?? [];
  const last = Math.max(0, steps.length - 1);

  useEffect(() => {
    if (!playing || !visible || !steps.length) return;
    const atEnd = index >= last;
    const timer = window.setTimeout(() => setIndex(atEnd ? 0 : index + 1), atEnd ? END_HOLD_MS : STEP_MS);
    return () => window.clearTimeout(timer);
  }, [playing, visible, index, last, steps.length]);

  const cellKeys = useMemo(() => computeCellKeys(steps), [steps]);
  const indexMap = useMemo(() => analyzeIndexing(example.code), [example.code]);
  const slotHeight = useMemo(() => infoSlotHeight(steps) || undefined, [steps]);
  const context = useMemo(() => contextInfo(steps), [steps]);
  const heapNames = useMemo(() => analyzeHeaps(example.code), [example.code]);
  const callTree = useMemo(() => {
    const tree = buildCallTree(steps);
    return showCallTree(tree) ? tree : null;
  }, [steps]);
  const step = steps[index];
  const prev = index > 0 ? steps[index - 1] : undefined;
  const lines = example.code.replace(/\n$/, '').split('\n');
  const hint = lineHint(step);

  return (
    <div ref={rootRef} className="@container mt-5 overflow-hidden rounded-xl border border-ink-700 bg-ink-900" data-demo={example.id}>
      {/* 標題列：範例切換 + 在新頁籤開啟 */}
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-700 px-3 py-2">
        <span className="text-xs font-semibold tracking-wide text-brand uppercase">{t('demo')}</span>
        <div className="flex flex-wrap gap-1">
          {tutorial.examples.map((ex) => (
            <button
              key={ex.id}
              onClick={() => setExampleId(ex.id)}
              title={l(ex.title)}
              className={`rounded px-2 py-0.5 font-mono text-[11px] transition ${
                ex.id === example.id ? 'bg-ink-700 text-ink-100' : 'text-ink-400 hover:bg-ink-800 hover:text-ink-100'
              }`}
            >
              {ex.number}. {l(ex.title)}
            </button>
          ))}
        </div>
        <button
          onClick={() => onOpenExample(example)}
          className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-ink-300 transition hover:bg-ink-700 hover:text-ink-100"
        >
          <ExternalLink size={12} />
          {t('openInNewTab')}
        </button>
      </div>

      {/* 固定高度：每一步的卡片、變數數量不同，若跟著內容伸縮，下方的教學內容會一直跳動 */}
      <div className="grid @2xl:h-96 @2xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* 程式碼：目前行橘色、上一步的行藍色 */}
        <pre className="scrollbar-thin max-h-60 overflow-auto border-b border-ink-700 py-2 font-mono text-[12px] leading-[1.6] @2xl:max-h-none @2xl:border-r @2xl:border-b-0">
          {lines.map((line, i) => {
            const n = i + 1;
            const current = step?.lineNumber === n;
            const previous = !current && prev?.lineNumber === n;
            return (
              <div
                key={i}
                className="flex transition-colors duration-200"
                style={{
                  backgroundColor: current ? 'rgba(255,161,22,0.16)' : previous ? 'rgba(10,132,255,0.08)' : 'transparent',
                  boxShadow: current ? 'inset 3px 0 0 #ffa116' : 'none',
                }}
              >
                <span className="w-8 shrink-0 pr-2 text-right text-ink-600 select-none">{n}</span>
                <span className="pr-3 whitespace-pre text-ink-300">
                  {line || ' '}
                  {current && hint && (
                    <span
                      className={`ml-4 italic ${hint.tone === 'true' ? 'text-ok' : hint.tone === 'false' ? 'text-err' : hint.tone === 'calc' ? 'text-[#22d3ee]' : 'text-ink-400'}`}
                    >
                      {hint.text}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </pre>

        {/* 視覺化 */}
        <div className="scrollbar-thin h-96 overflow-auto p-3 [overflow-anchor:none] @2xl:h-auto">
          {step ? (
            <div className="origin-top-left">
              <Visualizer step={step} prev={prev} cellKeys={cellKeys[index] ?? {}} indexMap={indexMap}
                slotHeight={slotHeight}
                heapNames={heapNames}
                callTree={
                  callTree
                    ? {
                        tree: callTree,
                        index,
                        onSeek: (i) => {
                          setIndex(i);
                          setPlaying(false);
                        },
                      }
                    : undefined
                }
                context={{ stack: context.stack, loops: context.loops, frameKeys: context.frameKeys[index] ?? [] }}
              />
            </div>
          ) : error ? (
            <p className="text-xs text-err">{error}</p>
          ) : (
            <div className="flex h-full items-center justify-center gap-2 text-xs text-ink-400">
              <Loader2 size={14} className="animate-spin" />
              {t('demoLoading')}
            </div>
          )}
        </div>
      </div>

      {/* 播放控制 */}
      <div className="flex items-center gap-2 border-t border-ink-700 px-3 py-1.5">
        <button
          onClick={() => setPlaying((p) => !p)}
          disabled={!steps.length}
          className="flex size-7 items-center justify-center rounded-full bg-brand text-ink-900 transition hover:brightness-110 disabled:opacity-30"
          title={playing ? t('pause') : t('play')}
          aria-label={playing ? t('pause') : t('play')}
        >
          {playing ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" className="ml-0.5" />}
        </button>
        <button
          onClick={() => setIndex(0)}
          disabled={!steps.length}
          className="flex size-7 items-center justify-center rounded-md text-ink-400 transition hover:bg-ink-700 hover:text-ink-100 disabled:opacity-30"
          title={t('replay')}
          aria-label={t('replay')}
        >
          <RotateCcw size={13} />
        </button>
        <input
          type="range"
          className="aa-timeline min-w-0 flex-1"
          min={0}
          max={last}
          value={index}
          disabled={!steps.length}
          onChange={(e) => {
            setIndex(Number(e.target.value));
            setPlaying(false);
          }}
          aria-label={t('timeline')}
        />
        {step && (
          // 固定寬度並截斷，函式名稱與深度變化時時間軸才不會左右抖動；窄的容器（左側教學面板）直接隱藏
          <span className="hidden w-44 truncate text-right font-mono text-[11px] text-ink-400 @xl:inline">
            {step.funcName}()
            {step.depth > 1 && <span className="text-brand"> · {t('depth', { n: step.depth })}</span>}
          </span>
        )}
        <span className="w-14 text-right font-mono text-[11px] text-ink-400" data-demo-progress>
          {steps.length ? `${index + 1} / ${steps.length}` : '–'}
        </span>
      </div>
    </div>
  );
}
