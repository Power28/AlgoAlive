import { AnimatePresence, motion } from 'framer-motion';
import type { DictValue, Value, SequenceValue } from '../types';
import { formatValue, typeLabel, valueKey } from '../lib/value';
import { useT } from '../i18n';
import { Header } from './ArrayView';
import { useHeap, useValueFormat } from '../lib/heapContext';
import { markOutline } from '../lib/stepMarks';

const enter = { initial: { opacity: 0, x: -10 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: 10 } };

interface DictProps {
  name: string;
  value: DictValue;
  prev?: Value;
  /** 目前 scalar 變數的值 → 變數名，用來標示「正在查表的 key」 */
  lookups: Map<string, string[]>;
  /** 整個 dict 正在被比較（例如 x in seen） */
  compared?: boolean;
  /** 這一步對 dict 做了新增 / 刪除 */
  written?: boolean;
}

export function DictView({ name, value, prev, lookups, compared, written }: DictProps) {
  const fmt = useValueFormat();
  const heap = useHeap();
  const t = useT();
  const prevMap = new Map(prev?.type === 'dict' ? prev.entries.map(([k, v]) => [valueKey(k), valueKey(v)]) : []);
  const hasPrev = prev?.type === 'dict';
  // 大的 dict 只送出部分項目：上一步沒送出的項目不一定是新的，依位置判斷（位置在上一步的長度之後才是新放入的）
  const prevLength = prev?.type === 'dict' ? (prev.length ?? prev.entries.length + (prev.truncated ?? 0)) : 0;
  const position = (i: number) => value.index?.[i] ?? i;
  const order = value.entries.map(([k]) => valueKey(k)).join('|');

  // 每一列都是獨立的 grid（才能各自做 layout 動畫），因此欄寬要統一算好
  const keyCh = Math.min(40, Math.max(4, ...value.entries.map(([k]) => formatValue(k, heap, fmt).length + (lookups.has(valueKey(k)) ? 14 : 0))));
  const valCh = Math.min(40, Math.max(5, ...value.entries.map(([, v]) => formatValue(v, heap, fmt).length)));
  const cols = { gridTemplateColumns: `${(keyCh * 0.6 + 1.6).toFixed(2)}rem ${(valCh * 0.6 + 1.6).toFixed(2)}rem` };

  return (
    <section>
      <Header name={name} kind={typeLabel(value)} meta={`size ${value.length ?? value.entries.length + (value.truncated ?? 0)}`} />
      <div className="inline-block overflow-hidden rounded-lg border border-ink-600" style={markOutline(!!compared, !!written)}>
        <div className="grid bg-ink-700 font-mono text-[11px] text-ink-400" style={cols}>
          <div className="px-3 py-1">{t('dictKey')}</div>
          <div className="border-l border-ink-600 px-3 py-1">{t('dictValue')}</div>
        </div>
        {value.entries.length === 0 && <div className="px-3 py-2 font-mono text-xs text-ink-400">{t('dictEmpty')} {'{}'}</div>}
        <AnimatePresence initial={false}>
          {value.entries.flatMap(([k, v], i) => {
            const kk = valueKey(k);
            const isNew = hasPrev && !prevMap.has(kk) && (value.index === undefined || position(i) >= prevLength);
            const isChanged = hasPrev && prevMap.has(kk) && prevMap.get(kk) !== valueKey(v);
            const lookedUpBy = lookups.get(kk);
            // 省略的項目：一列「…」
            const gap = value.index !== undefined && position(i) > (i === 0 ? 0 : position(i - 1) + 1);
            const gapRow = gap ? [
              <motion.div key={`gap-${position(i)}`} layout className="border-t border-ink-600 px-3 py-0.5 font-mono text-xs text-ink-400" data-gap title={t('entriesHidden')}>
                …
              </motion.div>,
            ] : [];
            return [...gapRow, (
              <motion.div
                key={kk}
                layout
                layoutDependency={order}
                {...enter}
                transition={{ duration: 0.25 }}
                className="grid border-t border-ink-600 font-mono text-sm"
                style={{
                  ...cols,
                  backgroundColor: isNew ? 'rgba(44,187,93,0.18)' : isChanged ? 'rgba(255,161,22,0.2)' : 'transparent',
                  boxShadow: lookedUpBy ? 'inset 3px 0 0 #0a84ff' : 'none',
                }}
              >
                <div className="flex items-center gap-2 truncate px-3 py-1.5">
                  {formatValue(k, heap, fmt)}
                  {lookedUpBy && (
                    <span className="rounded bg-info/20 px-1 text-[10px] text-info" title={t('lookupHint')}>
                      = {lookedUpBy.join(', ')}
                    </span>
                  )}
                </div>
                <div className="truncate border-l border-ink-600 px-3 py-1.5" title={formatValue(v, heap, fmt)}>
                  {formatValue(v, heap, fmt)}
                </div>
              </motion.div>
            )];
          })}
        </AnimatePresence>
        {value.index !== undefined && value.length !== undefined && (value.index.at(-1) ?? -1) < value.length - 1 && (
          <div className="border-t border-ink-600 px-3 py-0.5 font-mono text-xs text-ink-400" data-gap>…</div>
        )}
        {value.truncated ? <div className="border-t border-ink-600 px-3 py-1 text-xs text-ink-400">…+{value.truncated} {t('more')}</div> : null}
      </div>
    </section>
  );
}

export function SetView({
  name,
  value,
  prev,
  compared,
  written,
}: {
  name: string;
  value: SequenceValue;
  prev?: Value;
  compared?: boolean;
  written?: boolean;
}) {
  const fmt = useValueFormat();
  const heap = useHeap();
  const t = useT();
  const prevKeys = new Set(prev?.type === 'set' ? prev.items.map(valueKey) : []);
  // 上一步只送出部分元素時，沒看到的元素不一定是新的：不標成新加入
  const hasPrev = prev?.type === 'set' && prev.index === undefined;
  const order = value.items.map(valueKey).join('|');
  return (
    <section>
      <Header name={name} kind="set" meta={`size ${value.length ?? value.items.length + (value.truncated ?? 0)}`} />
      <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-lg border border-dashed border-ink-600 p-2" style={markOutline(!!compared, !!written)}>
        {value.items.length === 0 && <span className="px-1 font-mono text-xs text-ink-400">set()</span>}
        <AnimatePresence initial={false}>
          {value.items.flatMap((item, i) => {
            const k = valueKey(item);
            const isNew = hasPrev && !prevKeys.has(k);
            const pos = value.index?.[i] ?? i;
            const gap = value.index !== undefined && pos > (i === 0 ? 0 : value.index[i - 1] + 1);
            const gapChip = gap ? [
              <span key={`gap-${pos}`} className="px-1 font-mono text-sm text-ink-400" data-gap title={t('entriesHidden')}>
                …
              </span>,
            ] : [];
            return [...gapChip, (
              <motion.span
                key={k}
                layout
                layoutDependency={order}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                className="rounded-full border px-2.5 py-0.5 font-mono text-sm"
                style={{
                  borderColor: isNew ? '#2cbb5d' : '#3e3e3e',
                  backgroundColor: isNew ? 'rgba(44,187,93,0.18)' : '#2a2a2a',
                }}
              >
                {formatValue(item, heap, fmt)}
              </motion.span>
            )];
          })}
        </AnimatePresence>
        {value.index !== undefined && value.length !== undefined && (value.index.at(-1) ?? -1) < value.length - 1 && (
          <span className="px-1 font-mono text-sm text-ink-400" data-gap>…</span>
        )}
      </div>
    </section>
  );
}

interface ScalarProps {
  entries: [string, Value][];
  prevVars?: Record<string, Value>;
  pointerColors: Map<string, string>;
  /** 目前條件式 / 計算正在讀取的變數 */
  compared?: Set<string>;
  /** 計算結果要寫入的變數 */
  written?: Set<string>;
}

export function ScalarGrid({ entries, prevVars, pointerColors, compared, written }: ScalarProps) {
  const fmt = useValueFormat();
  const heap = useHeap();
  const t = useT();
  if (entries.length === 0) return null;
  return (
    <section>
      <div className="mb-2 font-mono text-[11px] tracking-wide text-ink-400 uppercase">{t('variables')}</div>
      <div className="flex flex-wrap gap-2">
        {entries.map(([name, v]) => {
          const text = formatValue(v, heap, fmt);
          const changed = prevVars !== undefined && valueKey(prevVars[name]) !== valueKey(v);
          const color = pointerColors.get(name);
          return (
            <div
              key={name}
              className="flex items-stretch overflow-hidden rounded-md border border-ink-600 font-mono text-sm"
              style={markOutline(!!compared?.has(name), !!written?.has(name))}
            >
              <div className="flex items-center gap-1.5 bg-ink-700 px-2 py-1 text-ink-300">
                {color && <span className="size-2 rounded-full" style={{ backgroundColor: color }} />}
                {name}
              </div>
              <motion.div
                key={text}
                className="max-w-72 truncate px-2.5 py-1"
                title={`${typeLabel(v)}: ${text}`}
                initial={changed ? { backgroundColor: 'rgba(255,161,22,0.45)' } : false}
                animate={{ backgroundColor: changed ? 'rgba(255,161,22,0.14)' : 'rgba(0,0,0,0)' }}
                transition={{ duration: 0.6 }}
              >
                {text}
              </motion.div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
