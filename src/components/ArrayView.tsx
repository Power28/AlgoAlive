import { motion } from 'framer-motion';
import type { PyValue, SequenceValue } from '../types';
import { formatPy, valueKey } from '../lib/pyValue';
import { WINDOW_PAIRS, type Pointer } from '../lib/pointers';

const CELL = 48;
const GAP = 8;
const STEP = CELL + GAP;
const POINTER_ROW = 22;

const spring = { type: 'spring', stiffness: 420, damping: 34 } as const;

interface Props {
  name: string;
  value: SequenceValue;
  keys: string[];
  prev?: PyValue;
  pointers: Pointer[];
}

export function ArrayView({ name, value, keys, prev, pointers }: Props) {
  const items = value.items;
  const n = items.length;
  const prevItems = prev && 'items' in prev ? prev.items : undefined;

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
    if (!pa || !pb || n === 0) return [];
    const from = Math.min(pa.index, pb.index);
    const to = Math.min(Math.max(pa.index, pb.index), n - 1);
    return from <= to ? [{ id: `${a}-${b}`, from, to }] : [];
  });

  const colorAt = new Map<number, string>();
  for (const p of pointers) if (!colorAt.has(p.index)) colorAt.set(p.index, p.color);

  const width = (n + (hasOverflowSlot ? 1 : 0)) * STEP;
  // 只在格子順序改變（swap / insert / pop）時才做 layout 動畫；
  // 上方插入 return 橫幅等造成整塊位移時，不應讓格子看起來在「移動」
  const order = keys.join(',');

  return (
    <section>
      <Header name={name} kind={value.type} meta={`len ${n + (value.truncated ?? 0)}`} />
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
              const text = formatPy(item);
              return (
                <motion.div
                  key={keys[i] ?? i}
                  layout
                  layoutDependency={order}
                  transition={spring}
                  title={text}
                  className="flex shrink-0 items-center justify-center rounded-md border font-mono font-semibold"
                  style={{
                    width: CELL,
                    height: CELL,
                    fontSize: text.length > 4 ? 11 : 15,
                    borderColor: accent ?? '#3e3e3e',
                    boxShadow: accent ? `0 0 0 1px ${accent}55, 0 0 14px ${accent}33` : undefined,
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
            {value.truncated ? <div className="self-center pl-1 text-xs text-ink-400">…+{value.truncated}</div> : null}
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
                  {p.name}
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
