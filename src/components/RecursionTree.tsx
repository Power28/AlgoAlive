import { useEffect, useRef } from 'react';
import { useValueFormat } from '../lib/heapContext';
import { motion } from 'framer-motion';
import type { CallTree } from '../lib/callTree';
import { useT } from '../i18n';
import { Header } from './ArrayView';

const Y_STEP = 70;
const MIN_NODE_W = 76;
const NODE_H = 30;
const MAX_HEIGHT = 300;

interface Props {
  tree: CallTree;
  index: number;
  /** 點節點時跳到那次呼叫開始的步驟 */
  onSeek?: (step: number) => void;
}

/** 呼叫的固定高度（px），整段播放不變，避免畫面跳動 */
export const recursionTreeHeight = (tree: CallTree) => Math.min(MAX_HEIGHT, tree.maxDepth * Y_STEP + NODE_H + 46);

/** 遞迴樹：到目前為止的所有呼叫，目前這一次亮框、在堆疊上的虛線框、已回傳的標出回傳值 */
export function RecursionTree({ tree, index, onSeek }: Props) {
  const t = useT();
  const fmt = useValueFormat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const stack = tree.stackIds[index] ?? [];
  const onStack = new Set(stack);
  const current = stack[stack.length - 1];
  const visible = tree.nodes.filter((n) => n.startStep <= index);
  // 節點寬度依最長的標籤決定（整棵樹統一，播放時不變）
  const NODE_W = Math.max(MIN_NODE_W, ...tree.nodes.map((n) => n.label.length * 7 + 18));
  const X_STEP = NODE_W + 10;
  const width = tree.width * X_STEP;
  const height = tree.maxDepth * Y_STEP + NODE_H + 24;
  const pos = (x: number, depth: number) => ({ left: x * X_STEP + (X_STEP - NODE_W) / 2, top: depth * Y_STEP });

  // 樹比區塊大時，自動捲到目前執行的那次呼叫
  useEffect(() => {
    const el = scrollRef.current;
    const node = current !== undefined ? tree.nodes[current] : undefined;
    if (!el || !node) return;
    const p = pos(node.x, node.depth);
    el.scrollTo({ left: Math.max(0, p.left - el.clientWidth / 2 + NODE_W / 2), top: Math.max(0, p.top - el.clientHeight / 2), behavior: 'smooth' });
  }, [current, tree]);

  return (
    <section data-recursion-tree>
      <Header name={t('recursionTree')} kind={t('callsCount', { n: visible.length })} meta={t('recursionHint')} />
      <div ref={scrollRef} className="scrollbar-thin overflow-auto rounded-lg border border-ink-700 bg-ink-900/40" style={{ height: recursionTreeHeight(tree) }}>
        <div className="relative m-3" style={{ width, height }}>
          <svg className="pointer-events-none absolute inset-0 overflow-visible" width={width} height={height}>
            {visible
              .filter((n) => n.parent !== null)
              .map((n) => {
                const p = tree.nodes[n.parent!];
                const a = pos(p.x, p.depth);
                const b = pos(n.x, n.depth);
                const hot = onStack.has(n.id) && onStack.has(p.id);
                return (
                  <motion.line
                    key={n.id}
                    x1={a.left + NODE_W / 2}
                    y1={a.top + NODE_H}
                    x2={b.left + NODE_W / 2}
                    y2={b.top}
                    stroke={hot ? '#ffa116' : '#4a4a4a'}
                    strokeWidth={hot ? 2 : 1.25}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.3 }}
                  />
                );
              })}
          </svg>
          {visible.map((n) => {
            const p = pos(n.x, n.depth);
            const isCurrent = n.id === current;
            const active = onStack.has(n.id);
            // 正常回傳的看回傳步驟；因例外而結束的，看它是否已經離開堆疊
            const done = n.endStep !== undefined ? n.endStep <= index : !!n.raised && !active && index > n.startStep;
            const returningNow = n.endStep === index;
            return (
              <motion.button
                key={n.id}
                type="button"
                onClick={() => onSeek?.(n.startStep)}
                title={t('jumpToCall')}
                className="absolute flex flex-col items-center"
                style={{ left: p.left, top: p.top, width: NODE_W }}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 420, damping: 26 }}
              >
                <span
                  className={`flex w-full items-center justify-center truncate rounded-md border px-1 font-mono text-[11px] transition-colors duration-300 ${
                    isCurrent
                      ? 'border-brand bg-brand/15 font-semibold text-ink-100'
                      : active
                        ? 'border-dashed border-brand/70 text-ink-100'
                        : done
                          ? 'border-ink-700 text-ink-400'
                          : 'border-ink-600 text-ink-300'
                  }`}
                  style={{ height: NODE_H, boxShadow: isCurrent ? '0 0 12px rgba(255,161,22,0.35)' : 'none' }}
                >
                  {n.label}
                </span>
                {done && (n.returned !== undefined || n.raised) && (
                  <motion.span
                    className={`mt-0.5 rounded px-1 font-mono text-[10px] leading-4 ${n.raised ? 'bg-err/20 text-err' : 'bg-ok/20 text-ok'}`}
                    initial={returningNow ? { opacity: 0, y: -6, scale: 0.7 } : false}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                  >
                    {n.raised ? '✗' : `→ ${n.returned ?? fmt.none}`}
                  </motion.span>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
