import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Boxes } from 'lucide-react';
import type { ExecutionStep } from '../types';
import { formatPy } from '../lib/pyValue';
import { useT } from '../i18n';

export interface DesignInfo {
  /** 每個操作的寫法："MinStack()"、"push(-2)" */
  calls: string[];
  /** 每個操作開始的步驟 */
  starts: number[];
  onSeek?: (step: number) => void;
}

/** 每個操作從哪一步開始（第一個 design.index 等於它的步驟） */
export function designStarts(steps: ExecutionStep[], count: number): number[] {
  const starts = new Array<number>(count).fill(-1);
  steps.forEach((s, i) => {
    const k = s.design?.index;
    if (k !== undefined && k < count && starts[k] < 0) starts[k] = i;
  });
  return starts;
}

/** 設計類題目：依序執行的操作；目前這個亮起來，做完的標出輸出 */
export function DesignTimeline({ design, step }: { design: DesignInfo; step: ExecutionStep }) {
  const t = useT();
  const current = step.design?.index ?? 0;
  const outputs = step.design?.outputs ?? [];
  const scroller = useRef<HTMLDivElement>(null);
  const chips = useRef<(HTMLButtonElement | null)[]>([]);

  // 目前的操作保持在可見範圍（只捲動這一列，不動整頁）
  useEffect(() => {
    const box = scroller.current;
    const chip = chips.current[current];
    if (!box || !chip) return;
    const left = chip.offsetLeft - box.offsetLeft;
    if (left < box.scrollLeft || left + chip.offsetWidth > box.scrollLeft + box.clientWidth) {
      box.scrollTo({ left: Math.max(0, left - 24), behavior: 'smooth' });
    }
  }, [current]);

  // 方法剛回傳、輸出還沒記進 outputs 時，先顯示這一步的回傳值
  const pending = step.event === 'return' && step.returnValue
    ? step.returnValue.type === 'none' ? 'null' : formatPy(step.returnValue, step.heap)
    : undefined;

  return (
    <section data-design>
      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold tracking-wide text-ink-400 uppercase">
        <Boxes size={13} className="text-brand" />
        {t('designTitle')}
        <span className="font-normal normal-case">{t('designMeta', { k: Math.min(current + 1, design.calls.length), n: design.calls.length })}</span>
      </div>
      <div ref={scroller} className="scrollbar-thin relative flex gap-1.5 overflow-x-auto pb-1">
        {design.calls.map((call, k) => {
          const state = k < current ? 'done' : k === current ? 'current' : 'todo';
          const out = k < current ? outputs[k] : k === current ? pending : undefined;
          return (
            <button
              key={k}
              ref={(el) => {
                chips.current[k] = el;
              }}
              type="button"
              onClick={() => design.starts[k] >= 0 && design.onSeek?.(design.starts[k])}
              disabled={!design.onSeek || design.starts[k] < 0}
              className="flex shrink-0 flex-col items-center gap-0.5 enabled:cursor-pointer"
              title={t('designSeek')}
              data-design-op={state}
            >
              <span
                className="rounded-md border px-2 py-1 font-mono text-xs whitespace-nowrap transition-colors duration-200"
                style={{
                  borderColor: state === 'current' ? '#ffa116' : '#3e3e3e',
                  backgroundColor: state === 'current' ? 'rgba(255,161,22,0.15)' : '#2a2a2a',
                  color: state === 'todo' ? '#6b6b6b' : state === 'current' ? '#ffa116' : '#d4d4d4',
                  boxShadow: state === 'current' ? '0 0 12px rgba(255,161,22,0.25)' : 'none',
                }}
              >
                {call}
              </span>
              <span className="h-4 font-mono text-[11px] leading-4">
                {out !== undefined && (
                  <motion.span
                    key={`${k}-${out}`}
                    className={out === 'null' ? 'text-ink-400' : 'font-semibold text-ok'}
                    initial={{ opacity: 0, y: -3 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    data-output
                  >
                    → {out}
                  </motion.span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
