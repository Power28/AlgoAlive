import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CornerDownLeft, Repeat } from 'lucide-react';
import type { ExecutionStep, Heap, LoopInfo } from '../types';
import { formatValue } from '../lib/value';
import { useT } from '../i18n';

const ROW = 'flex h-9 items-center gap-2 overflow-x-auto overflow-y-hidden whitespace-nowrap scrollbar-thin';
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

interface Props {
  step: ExecutionStep;
  heap?: Heap;
  showStack: boolean;
  showLoops: boolean;
  /** 每一層呼叫的唯一 key（contextInfo 算好） */
  frameKeys: string[];
}

/** 視覺化最上方的固定高度資訊列：呼叫堆疊、迴圈圈數 */
export function ContextBar({ step, heap, showStack, showLoops, frameKeys }: Props) {
  const t = useT();
  const stackRef = useRef<HTMLDivElement>(null);
  const depth = step.stack?.length ?? 0;
  // 呼叫堆疊太長時捲到最右邊，目前這一層永遠看得到
  useEffect(() => {
    const el = stackRef.current;
    if (el) el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
  }, [depth, step.stepIndex]);
  if (!showStack && !showLoops) return null;
  return (
    <div className="flex shrink-0 flex-col gap-1 rounded-lg border border-ink-700 bg-ink-900 px-2.5 py-1" data-context>
      {showStack && (
        <div ref={stackRef} className={ROW} data-call-stack>
          <span className="sticky left-0 z-10 w-16 shrink-0 self-stretch bg-ink-900 pt-2.5 text-[10px] font-semibold tracking-wide text-ink-400 uppercase">{t('callStack')}</span>
          <AnimatePresence initial={false} mode="popLayout">
            {(step.stack ?? []).map((frame, i, all) => {
              const current = i === all.length - 1;
              const returning = current && step.event === 'return' && step.returnValue;
              return (
                <motion.div
                  key={frameKeys[i] ?? i}
                  layout
                  initial={{ opacity: 0, x: 16, scale: 0.92 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.92 }}
                  transition={{ duration: 0.22 }}
                  className="flex shrink-0 items-center gap-1.5"
                >
                  {i > 0 && <span className="text-ink-600">›</span>}
                  <span
                    className={`flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[11px] ${
                      current ? 'border-brand/60 bg-brand/10 text-ink-100' : 'border-ink-700 text-ink-400'
                    }`}
                    title={current ? undefined : t('waitingAt', { n: frame.line })}
                    data-current={current || undefined}
                  >
                    <span className={current ? 'font-semibold text-brand' : ''}>{frame.func}</span>
                    <span>({frame.args.map(([n, v]) => `${n}=${v}`).join(', ')})</span>
                    {!current && <span className="text-[10px] text-ink-600">L{frame.line}</span>}
                    {returning && (
                      <motion.span
                        className="flex items-center gap-0.5 rounded bg-ok/20 px-1 text-ok"
                        initial={{ opacity: 0, scale: 0.7 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                      >
                        <CornerDownLeft size={10} />
                        {clip(formatValue(step.returnValue!, heap), 18)}
                      </motion.span>
                    )}
                  </span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
      {showLoops && (
        <div className={ROW} data-loops>
          <span className="sticky left-0 z-10 w-16 shrink-0 self-stretch bg-ink-900 pt-2.5 text-[10px] font-semibold tracking-wide text-ink-400 uppercase">{t('loopsLabel')}</span>
          {step.event === 'line' && step.loops?.length ? (
            step.loops.map((loop, i) => (
              <div key={loop.line} className="flex shrink-0 items-center gap-1.5">
                {i > 0 && <span className="text-ink-600">›</span>}
                <LoopChip loop={loop} jump={step.jump?.loopLine === loop.line ? step.jump.kind : undefined} />
              </div>
            ))
          ) : (
            <span className="text-[11px] text-ink-600">{t('notInLoop')}</span>
          )}
        </div>
      )}
    </div>
  );
}

const MAX_DOTS = 16;

function LoopChip({ loop, jump }: { loop: LoopInfo; jump?: 'break' | 'continue' }) {
  const t = useT();
  const { iteration, total, done } = loop;
  const label = done ? t('loopDone') : total !== undefined ? t('iterOf', { k: iteration, n: total }) : t('iterOpen', { k: iteration });
  return (
    <span
      className={`flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] ${done ? 'border-ink-700 text-ink-400' : 'border-[#2dd4bf]/50 bg-[#2dd4bf]/10 text-ink-100'}`}
      title={loop.src}
    >
      <Repeat size={11} className={done ? 'text-ink-600' : 'text-[#2dd4bf]'} />
      <code className="font-mono text-ink-300">{clip(loop.src, 30)}</code>
      {total !== undefined && total > 0 && total <= MAX_DOTS ? (
        <span className="flex items-center gap-0.5" aria-hidden>
          {Array.from({ length: total }, (_, k) => {
            const passed = k < iteration - 1 || done;
            const current = !done && k === iteration - 1;
            return (
              <motion.span
                key={k}
                className="block size-1.5 rounded-full"
                initial={false}
                animate={{
                  backgroundColor: current ? '#2dd4bf' : passed ? '#2dd4bf88' : '#3e3e3e',
                  scale: current ? 1.4 : 1,
                }}
                transition={{ duration: 0.2 }}
              />
            );
          })}
        </span>
      ) : total !== undefined && total > MAX_DOTS ? (
        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-ink-700" aria-hidden>
          <motion.span
            className="block h-full bg-[#2dd4bf]"
            initial={false}
            animate={{ width: `${(Math.min(iteration, total) / total) * 100}%` }}
            transition={{ duration: 0.2 }}
          />
        </span>
      ) : null}
      <motion.span key={`${iteration}-${done}`} className="font-semibold" initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
        {label}
      </motion.span>
      {jump && (
        <motion.span
          className="rounded px-1 text-[10px] font-bold text-ink-900"
          style={{ backgroundColor: jump === 'break' ? '#f87171' : '#fbbf24' }}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 22 }}
        >
          {t(jump === 'break' ? 'loopBreak' : 'loopContinue')}
        </motion.span>
      )}
    </span>
  );
}
