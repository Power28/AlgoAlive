import { motion } from 'framer-motion';
import type { PyValue } from '../types';
import { formatCell, formatPy, valueKey } from '../lib/pyValue';
import { WINDOW_PAIRS, type Pointer } from '../lib/pointers';
import { useHeap } from '../lib/heapContext';
import { markOutline } from '../lib/stepMarks';

const MIN_CELL = 48;
const MAX_CELL = 120;
const GAP = 8;
const POINTER_ROW = 22;
/** 字串內容的顏色（同 Monaco 的字串色），取代引號來區分 '1' 與 1 */
export const STR_COLOR = '#ce9178';

const spring = { type: 'spring', stiffness: 420, damping: 34 } as const;

interface Props {
  name: string;
  /** 型別標籤：list / tuple / deque / str */
  kind: string;
  items: PyValue[];
  truncated?: number;
  keys: string[];
  prevItems?: PyValue[];
  pointers: Pointer[];
  /** 目前條件式正在比較的格子 */
  compared?: Set<number>;
  /** 整個序列正在被判斷（例如 while stack: 的 stack） */
  wholeCompared?: boolean;
  /** 計算結果要寫入的格子（例如 dp[i]） */
  written?: Set<number>;
  /** 整個序列被重新賦值（例如 dp = [0] * n） */
  wholeWritten?: boolean;
}

export function ArrayView({ name, kind, items, truncated, keys, prevItems, pointers, compared, wholeCompared, written, wholeWritten }: Props) {
  const heap = useHeap();
  const n = items.length;
  // 格子寬度依最長內容調整（例如 BFS 佇列中的座標 tuple），整列統一寬度才能對齊指針
  const longest = Math.max(0, ...items.map((it) => formatCell(it, heap).length));
  const CELL = Math.min(MAX_CELL, Math.max(MIN_CELL, longest * 8.5 + 14));
  const STEP = CELL + GAP;

  // 同一格上的多個指針往下堆疊
  const rowOf = new Map<string, number>();
  const perIndex = new Map<number, number>();
  for (const p of [...pointers].sort((a, b) => a.name.localeCompare(b.name))) {
    const row = perIndex.get(p.index) ?? 0;
    rowOf.set(p.name, row);
    perIndex.set(p.index, row + 1);
  }
  const maxRow = Math.max(0, ...perIndex.values());
  const hasOverflowSlot = pointers.some((p) => p.index === n);

  const byName = new Map(pointers.map((p) => [p.name, p]));
  const windows = WINDOW_PAIRS.flatMap(([a, b]) => {
    const pa = byName.get(a);
    const pb = byName.get(b);
    // 左指針跑到右指針右邊代表視窗為空（例如滑動視窗剛收縮完），不畫
    if (!pa || !pb || n === 0 || pa.index > pb.index) return [];
    const from = pa.index;
    const to = Math.min(pb.index, n - 1);
    return from <= to ? [{ id: `${a}-${b}`, from, to }] : [];
  });

  const colorAt = new Map<number, string>();
  for (const p of pointers) if (!colorAt.has(p.index)) colorAt.set(p.index, p.color);

  const width = (n + (hasOverflowSlot ? 1 : 0)) * STEP;
  // 只在格子順序改變（swap / insert / pop）時才做 layout 動畫；
  // 上方插入 return 橫幅等造成整塊位移時，不應讓格子看起來在「移動」
  const order = keys.join(',');

  return (
    <section className="rounded-lg" style={markOutline(!!wholeCompared, !!wholeWritten)}>
      <Header name={name} kind={kind} meta={`len ${n + (truncated ?? 0)}`} />
      <div className="scrollbar-thin overflow-x-auto pb-1">
        <div className="relative px-1 pt-1" style={{ width: Math.max(width, STEP) + 8 }}>
          {/* 滑動視窗 / 雙指針夾住的範圍 */}
          {windows.map((w) => (
            <motion.div
              key={w.id}
              className="absolute rounded-lg border border-brand/40 bg-brand/8"
              initial={false}
              animate={{ x: w.from * STEP, width: (w.to - w.from) * STEP + CELL + 8 }}
              transition={spring}
              style={{ height: CELL + 8, left: 4, top: 3 }}
            />
          ))}

          <div className="relative flex" style={{ gap: GAP, paddingLeft: 4, paddingTop: 3 }}>
            {items.map((item, i) => {
              const changed = prevItems !== undefined && valueKey(prevItems[i]) !== valueKey(item);
              const accent = colorAt.get(i);
              const text = formatCell(item, heap);
              return (
                <motion.div
                  key={keys[i] ?? i}
                  layout
                  layoutDependency={order}
                  transition={spring}
                  title={formatPy(item, heap)}
                  className="flex shrink-0 items-center justify-center rounded-md border font-mono font-semibold"
                  style={{
                    width: CELL,
                    height: CELL,
                    fontSize: CELL > MIN_CELL ? 13 : text.length > 4 ? 11 : 15,
                    borderColor: accent ?? '#3e3e3e',
                    color: item.type === 'str' ? STR_COLOR : 'inherit',
                    ...markOutline(!!compared?.has(i), !!written?.has(i)),
                    // motion 元件不會清掉變成 undefined 的 style，必須明確給 'none'
                    boxShadow: accent ? `0 0 0 1px ${accent}55, 0 0 14px ${accent}33` : 'none',
                  }}
                  animate={{ backgroundColor: changed ? 'rgba(255,161,22,0.28)' : '#2a2a2a' }}
                >
                  <span className="truncate px-1">{text}</span>
                </motion.div>
              );
            })}
            {hasOverflowSlot && (
              <div
                className="flex shrink-0 items-center justify-center rounded-md border border-dashed border-ink-600 text-xs text-ink-400"
                style={{ width: CELL, height: CELL }}
              >
                end
              </div>
            )}
            {truncated ? <div className="self-center pl-1 text-xs text-ink-400">…+{truncated}</div> : null}
          </div>

          {/* 索引 */}
          <div className="flex font-mono text-[11px] text-ink-400" style={{ gap: GAP, paddingLeft: 4 }}>
            {items.map((_, i) => (
              <div key={i} className="shrink-0 pt-1 text-center" style={{ width: CELL }}>
                {i}
              </div>
            ))}
          </div>

          {/* 指針層 */}
          <div className="relative" style={{ height: pointers.length ? maxRow * POINTER_ROW + 6 : 0 }}>
            {pointers.map((p) => (
              <motion.div
                key={p.name}
                className="absolute top-0 flex flex-col items-center"
                style={{ width: CELL, left: 4 }}
                initial={false}
                animate={{ x: p.index * STEP, y: (rowOf.get(p.name) ?? 0) * POINTER_ROW }}
                transition={spring}
              >
                <span className="text-[10px] leading-none" style={{ color: p.color }}>
                  ▲
                </span>
                <span
                  className="mt-0.5 rounded px-1.5 font-mono text-[11px] leading-4 font-semibold text-ink-900"
                  style={{ backgroundColor: p.color }}
                >
                  {p.label}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function Header({ name, kind, meta }: { name: string; kind: string; meta?: string }) {
  return (
    <div className="mb-2 flex items-baseline gap-2">
      <span className="font-mono text-sm font-semibold text-ink-100">{name}</span>
      <span className="rounded bg-ink-700 px-1.5 py-px font-mono text-[10px] text-ink-300">{kind}</span>
      {meta && <span className="font-mono text-[11px] text-ink-400">{meta}</span>}
    </div>
  );
}
