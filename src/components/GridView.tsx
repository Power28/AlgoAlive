import { motion } from 'framer-motion';
import type { Value, SequenceValue } from '../types';
import { formatCell, formatValue, valueKey } from '../lib/value';
import { Header, STR_COLOR } from './ArrayView';
import { useHeap, useValueFormat } from '../lib/heapContext';
import { markOutline } from '../lib/stepMarks';

const CELL = 40;
const GAP = 4;
const STEP = CELL + GAP;
/** 左側列號、上方欄號佔的空間 */
const ROW_LABEL = 24;
const COL_LABEL = 18;

const spring = { type: 'spring', stiffness: 320, damping: 30 } as const;

export interface GridMark {
  /** 例如 "r, c" */
  label: string;
  row: number;
  col: number;
  color: string;
}

interface Props {
  name: string;
  value: SequenceValue;
  prev?: Value;
  marks: GridMark[];
  /** 目前條件式正在比較的格子："row:col" */
  compared?: Set<string>;
  /** 計算結果要寫入的格子："row:col" */
  written?: Set<string>;
  /** 每一格的身分 key（見 computeGridKeys）：旋轉 / 轉置 / 交換時格子會移動到新位置 */
  keys?: string[][];
}

export function GridView({ name, value, prev, marks, compared, written, keys }: Props) {
  const fmt = useValueFormat();
  const heap = useHeap();
  const rows = value.items as SequenceValue[];
  const prevRows = prev?.type === 'list' ? (prev.items as SequenceValue[]) : undefined;
  const cols = Math.max(1, ...rows.map((r) => r.items.length));
  const markAt = new Map<string, GridMark>();
  for (const m of marks) if (!markAt.has(`${m.row},${m.col}`)) markAt.set(`${m.row},${m.col}`, m);
  const width = ROW_LABEL + cols * STEP;
  const height = COL_LABEL + rows.length * STEP;

  return (
    <section>
      <Header name={name} kind="list[list]" meta={`${rows.length} × ${cols}`} />
      <div className="scrollbar-thin overflow-x-auto pb-1">
        <div className="relative font-mono" style={{ width, height }}>
          {Array.from({ length: cols }, (_, c) => (
            <span key={`col-${c}`} className="absolute top-0 text-center text-[11px] text-ink-400" style={{ left: ROW_LABEL + c * STEP, width: CELL }}>
              {c}
            </span>
          ))}
          {rows.map((_, r) => (
            <span
              key={`row-${r}`}
              className="absolute left-0 flex items-center justify-end pr-1.5 text-[11px] text-ink-400"
              style={{ top: COL_LABEL + r * STEP, width: ROW_LABEL, height: CELL }}
            >
              {r}
            </span>
          ))}
          {rows.map(
            (row, r) =>
              row.items.length === 0 && (
                <span key={`empty-${r}`} className="absolute flex items-center text-xs text-ink-400" style={{ left: ROW_LABEL, top: COL_LABEL + r * STEP, height: CELL }}>
                  [ ]
                </span>
              ),
          )}
          {rows.flatMap((row, r) =>
            row.items.map((cell, c) => {
              const prevCell = prevRows?.[r]?.items?.[c];
              const changed = prevRows !== undefined && valueKey(prevCell) !== valueKey(cell);
              const mark = markAt.get(`${r},${c}`);
              const text = formatCell(cell, heap, fmt);
              const x = ROW_LABEL + c * STEP;
              const y = COL_LABEL + r * STEP;
              const key = keys?.[r]?.[c] ?? `${r}:${c}`;
              return (
                <motion.div
                  key={key}
                  data-cell={key}
                  title={formatValue(cell, heap, fmt)}
                  className="absolute top-0 left-0 flex items-center justify-center rounded-md border font-semibold"
                  initial={{ opacity: 0, scale: 0.6, x, y }}
                  animate={{ opacity: 1, scale: 1, x, y, backgroundColor: changed ? 'rgba(255,161,22,0.28)' : '#2a2a2a' }}
                  transition={spring}
                  style={{
                    width: CELL,
                    height: CELL,
                    fontSize: text.length > 4 ? 10 : 14,
                    color: cell.type === 'str' ? STR_COLOR : 'inherit',
                    borderColor: mark?.color ?? '#3e3e3e',
                    boxShadow: mark ? `0 0 0 1px ${mark.color}66, 0 0 12px ${mark.color}33` : 'none',
                    ...markOutline(!!compared?.has(`${r}:${c}`), !!written?.has(`${r}:${c}`)),
                  }}
                >
                  {text}
                </motion.div>
              );
            }),
          )}
        </div>
      </div>
      {marks.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-2 pl-6">
          {marks.map((m) => (
            <span key={m.label} className="rounded px-1.5 font-mono text-[11px] leading-4 font-semibold text-ink-900" style={{ backgroundColor: m.color }}>
              [{m.label}] = ({m.row}, {m.col})
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
