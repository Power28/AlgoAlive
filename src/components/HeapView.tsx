import { motion } from 'framer-motion';
import type { Value } from '../types';
import { formatCell, formatValue, valueKey } from '../lib/value';
import { useHeap, useValueFormat } from '../lib/heapContext';
import { markOutline } from '../lib/stepMarks';
import { useT } from '../i18n';
import { Header } from './ArrayView';

const Y_STEP = 62;
const MIN_NODE = 38;
const MAX_NODES = 31; // 5 層

const spring = { type: 'spring', stiffness: 320, damping: 30 } as const;

interface Props {
  name: string;
  items: Value[];
  /** 與 ArrayView 共用的格子身分 key：推入 / 取出後節點會移動到新位置 */
  keys: string[];
  prevItems?: Value[];
  /** 這一步操作影響的位置（例如 heappop 的頂端） */
  written?: Set<number>;
}

/** 堆積的樹狀圖：list 的第 i 格是節點，子節點在 2i + 1、2i + 2 */
export function HeapView({ name, items, keys, prevItems, written }: Props) {
  const fmt = useValueFormat();
  const t = useT();
  const heap = useHeap();
  const shown = items.slice(0, MAX_NODES);
  if (!shown.length) return null;

  const texts = shown.map((it) => formatCell(it, heap, fmt));
  const node = Math.max(MIN_NODE, ...texts.map((s) => s.length * 8 + 16));
  const levels = Math.floor(Math.log2(shown.length)) + 1;
  // 最底層每個節點佔一格，整棵樹的寬度由最底層決定
  const width = 2 ** (levels - 1) * (node + 10);
  const pos = (i: number) => {
    const depth = Math.floor(Math.log2(i + 1));
    const first = 2 ** depth - 1;
    const slot = width / 2 ** depth;
    return { x: (i - first) * slot + slot / 2 - node / 2, y: depth * Y_STEP };
  };
  const center = (i: number) => {
    const p = pos(i);
    return { cx: p.x + node / 2, cy: p.y + node / 2 };
  };

  return (
    <section data-heap={name}>
      <Header name={name} kind={t('heapKind')} meta={t('heapMeta')} />
      <div className="scrollbar-thin overflow-x-auto pb-1">
        <div className="relative" style={{ width, height: (levels - 1) * Y_STEP + node + 20 }}>
          <svg className="pointer-events-none absolute inset-0 overflow-visible" width={width} height={(levels - 1) * Y_STEP + node}>
            {shown.map((_, i) => {
              if (i === 0) return null;
              const a = center(Math.floor((i - 1) / 2));
              const b = center(i);
              return (
                <motion.line
                  key={`edge-${i}`}
                  initial={false}
                  animate={{ x1: a.cx, y1: a.cy, x2: b.cx, y2: b.cy }}
                  transition={spring}
                  stroke="#555"
                  strokeWidth={1.5}
                />
              );
            })}
          </svg>
          {shown.map((item, i) => {
            const p = pos(i);
            const changed = prevItems !== undefined && valueKey(prevItems[i]) !== valueKey(item);
            const top = i === 0;
            return (
              <motion.div
                key={keys[i] ?? `h${i}`}
                className="absolute top-0 left-0 flex flex-col items-center"
                style={{ width: node }}
                initial={{ opacity: 0, scale: 0.5, x: p.x, y: p.y }}
                animate={{ opacity: 1, scale: 1, x: p.x, y: p.y }}
                transition={spring}
                title={formatValue(item, heap, fmt)}
              >
                <div
                  className="flex items-center justify-center rounded-full border-2 font-mono text-sm font-semibold transition-colors duration-300"
                  style={{
                    width: node,
                    height: MIN_NODE,
                    borderColor: top ? '#ffa116' : '#4a4a4a',
                    backgroundColor: changed ? 'rgba(255,161,22,0.28)' : '#2a2a2a',
                    ...markOutline(false, !!written?.has(i)),
                  }}
                >
                  {texts[i]}
                </div>
                {top && <span className="mt-1 rounded bg-brand px-1.5 font-mono text-[10px] leading-4 font-semibold text-ink-900">{t('heapTop')}</span>}
              </motion.div>
            );
          })}
        </div>
      </div>
      {items.length > MAX_NODES && <p className="text-xs text-ink-400">{t('heapTruncated', { n: items.length - MAX_NODES })}</p>}
    </section>
  );
}
