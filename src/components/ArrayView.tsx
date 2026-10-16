import { AnimatePresence, motion } from 'framer-motion';
import type { Value, SliceInfo } from '../types';
import { formatCell, formatValue, valueKey } from '../lib/value';
import { WINDOW_PAIRS, type Pointer } from '../lib/pointers';
import { useHeap, useValueFormat } from '../lib/heapContext';
import { markOutline } from '../lib/stepMarks';

const MIN_CELL = 48;
const MAX_CELL = 120;
const GAP = 8;
const POINTER_ROW = 22;
/** 字串內容的顏色（同 Monaco 的字串色），取代引號來區分 '1' 與 1 */
export const STR_COLOR = '#ce9178';

const spring = { type: 'spring', stiffness: 420, damping: 34 } as const;
/** 切片範圍的顏色 */
export const SLICE_COLOR = '#818cf8';

interface Props {
  name: string;
  /** 型別標籤：list / tuple / deque / str */
  kind: string;
  items: Value[];
  truncated?: number;
  keys: string[];
  prevItems?: Value[];
  pointers: Pointer[];
  /** 目前條件式正在比較的格子 */
  compared?: Set<number>;
  /** 整個序列正在被判斷（例如 while stack: 的 stack） */
  wholeCompared?: boolean;
  /** 計算結果要寫入的格子（例如 dp[i]） */
  written?: Set<number>;
  /** 整個序列被重新賦值（例如 dp = [0] * n） */
  wholeWritten?: boolean;
  /** 這一行對這個序列做的切片 */
  slices?: SliceInfo[];
}

export function ArrayView({ name, kind, items, truncated, keys, prevItems, pointers, compared, wholeCompared, written, wholeWritten, slices = [] }: Props) {
  const fmt = useValueFormat();
  const heap = useHeap();
  const n = items.length;
  // 格子寬度依最長內容調整（例如 BFS 佇列中的座標 tuple），整列統一寬度才能對齊指針
  const longest = Math.max(0, ...items.map((it) => formatCell(it, heap, fmt).length));
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
  // 切片：連續範圍畫成一段框；有間隔（[::2]、[::-1]）的個別標出被選到的格子
  const sliceBands = slices.filter((sl) => sl.step === 1 && sl.stop > sl.start);
  const slicePicked = new Set<number>();
  for (const sl of slices) {
    if (sl.step === 1) continue;
    for (let i = sl.start; sl.step > 0 ? i < sl.stop : i > sl.stop; i += sl.step) if (i >= 0 && i < n) slicePicked.add(i);
  }
  // 只在格子順序改變（swap / insert / pop）時才做 layout 動畫；
  // 上方插入 return 橫幅等造成整塊位移時，不應讓格子看起來在「移動」
  const order = keys.join(',');

  return (
    <section className="rounded-lg" style={markOutline(!!wholeCompared, !!wholeWritten)}>
      <Header name={name} kind={kind} meta={`len ${n + (truncated ?? 0)}`} />
      <div className="scrollbar-thin overflow-x-auto pb-1">
        <div className="relative px-1 pt-1" style={{ width: Math.max(width, STEP) + 8 }}>
          {sliceBands.map((sl) => (
            <motion.div
              key={`slice-${sl.src}`}
              className="absolute rounded-lg border-2 border-dashed"
              // 與視窗範圍相同的幾何：從第 start 格框到第 stop - 1 格
              style={{ borderColor: SLICE_COLOR, backgroundColor: `${SLICE_COLOR}14`, height: CELL + 8, left: 4, top: 3 }}
              initial={{ opacity: 0, x: sl.start * STEP, width: (Math.min(sl.stop, n) - 1 - sl.start) * STEP + CELL + 8 }}
              animate={{ opacity: 1, x: sl.start * STEP, width: (Math.min(sl.stop, n) - 1 - sl.start) * STEP + CELL + 8 }}
              transition={{ duration: 0.2 }}
            />
          ))}
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
            <AnimatePresence initial={false} mode="popLayout">
            {items.map((item, i) => {
              const changed = prevItems !== undefined && valueKey(prevItems[i]) !== valueKey(item);
              const accent = colorAt.get(i);
              const text = formatCell(item, heap, fmt);
              return (
                <motion.div
                  key={keys[i] ?? i}
                  layout
                  layoutDependency={order}
                  transition={spring}
                  title={formatValue(item, heap, fmt)}
                  className="flex shrink-0 items-center justify-center rounded-md border font-mono font-semibold"
                  style={{
                    width: CELL,
                    height: CELL,
                    fontSize: CELL > MIN_CELL ? 13 : text.length > 4 ? 11 : 15,
                    borderColor: accent ?? '#3e3e3e',
                    color: item.type === 'str' ? STR_COLOR : 'inherit',
                    ...(slicePicked.has(i) && !compared?.has(i) && !written?.has(i)
                      ? { outline: `2px dashed ${SLICE_COLOR}`, outlineOffset: 3 }
                      : markOutline(!!compared?.has(i), !!written?.has(i))),
                    // motion 元件不會清掉變成 undefined 的 style，必須明確給 'none'
                    boxShadow: accent ? `0 0 0 1px ${accent}55, 0 0 14px ${accent}33` : 'none',
                  }}
                  initial={{ opacity: 0, scale: 0.5, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0, backgroundColor: changed ? 'rgba(255,161,22,0.28)' : '#2a2a2a' }}
                  exit={{ opacity: 0, scale: 0.5, y: -18, transition: { duration: 0.22 } }}
                >
                  <span className="truncate px-1">{text}</span>
                </motion.div>
              );
            })}
            </AnimatePresence>
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
      {slices.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1.5 pl-1">
          {slices.map((sl) => (
            <span
              key={sl.src}
              className="rounded px-1.5 py-px font-mono text-[11px]"
              style={{ color: SLICE_COLOR, backgroundColor: `${SLICE_COLOR}1f` }}
              data-slice
            >
              {sl.src} → {sl.display}
            </span>
          ))}
        </div>
      )}
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
