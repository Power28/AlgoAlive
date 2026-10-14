import { AnimatePresence, motion } from 'framer-motion';
import type { DictValue, PyValue, SequenceValue } from '../types';
import { formatPy, typeLabel, valueKey } from '../lib/pyValue';
import { useT } from '../i18n';
import { Header } from './ArrayView';
import { useHeap } from '../lib/heapContext';
import { markOutline } from '../lib/stepMarks';

const enter = { initial: { opacity: 0, x: -10 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: 10 } };

interface DictProps {
  name: string;
  value: DictValue;
  prev?: PyValue;
  /** 目前 scalar 變數的值 → 變數名，用來標示「正在查表的 key」 */
  lookups: Map<string, string[]>;
  /** 整個 dict 正在被比較（例如 x in seen） */
  compared?: boolean;
}

export function DictView({ name, value, prev, lookups, compared }: DictProps) {
  const heap = useHeap();
  const t = useT();
  const prevMap = new Map(prev?.type === 'dict' ? prev.entries.map(([k, v]) => [valueKey(k), valueKey(v)]) : []);
  const hasPrev = prev?.type === 'dict';
  const order = value.entries.map(([k]) => valueKey(k)).join('|');

  // 每一列都是獨立的 grid（才能各自做 layout 動畫），因此欄寬要統一算好
  const keyCh = Math.min(40, Math.max(4, ...value.entries.map(([k]) => formatPy(k, heap).length + (lookups.has(valueKey(k)) ? 14 : 0))));
  const valCh = Math.min(40, Math.max(5, ...value.entries.map(([, v]) => formatPy(v, heap).length)));
  const cols = { gridTemplateColumns: `${(keyCh * 0.6 + 1.6).toFixed(2)}rem ${(valCh * 0.6 + 1.6).toFixed(2)}rem` };

  return (
    <section>
      <Header name={name} kind={typeLabel(value)} meta={`size ${value.entries.length + (value.truncated ?? 0)}`} />
      <div className="inline-block overflow-hidden rounded-lg border border-ink-600" style={markOutline(!!compared)}>
        <div className="grid bg-ink-700 font-mono text-[11px] text-ink-400" style={cols}>
          <div className="px-3 py-1">{t('dictKey')}</div>
          <div className="border-l border-ink-600 px-3 py-1">{t('dictValue')}</div>
        </div>
        {value.entries.length === 0 && <div className="px-3 py-2 font-mono text-xs text-ink-400">{t('dictEmpty')} {'{}'}</div>}
        <AnimatePresence initial={false}>
          {value.entries.map(([k, v]) => {
            const kk = valueKey(k);
            const isNew = hasPrev && !prevMap.has(kk);
            const isChanged = hasPrev && !isNew && prevMap.get(kk) !== valueKey(v);
            const lookedUpBy = lookups.get(kk);
            return (
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
                  {formatPy(k, heap)}
                  {lookedUpBy && (
                    <span className="rounded bg-info/20 px-1 text-[10px] text-info" title={t('lookupHint')}>
                      = {lookedUpBy.join(', ')}
                    </span>
                  )}
                </div>
                <div className="truncate border-l border-ink-600 px-3 py-1.5" title={formatPy(v, heap)}>
                  {formatPy(v, heap)}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {value.truncated ? <div className="border-t border-ink-600 px-3 py-1 text-xs text-ink-400">…+{value.truncated} {t('more')}</div> : null}
      </div>
    </section>
  );
}

export function SetView({ name, value, prev, compared }: { name: string; value: SequenceValue; prev?: PyValue; compared?: boolean }) {
  const heap = useHeap();
  const prevKeys = new Set(prev?.type === 'set' ? prev.items.map(valueKey) : []);
  const hasPrev = prev?.type === 'set';
  const order = value.items.map(valueKey).join('|');
  return (
    <section>
      <Header name={name} kind="set" meta={`size ${value.items.length + (value.truncated ?? 0)}`} />
      <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-lg border border-dashed border-ink-600 p-2" style={markOutline(!!compared)}>
        {value.items.length === 0 && <span className="px-1 font-mono text-xs text-ink-400">set()</span>}
        <AnimatePresence initial={false}>
          {value.items.map((item) => {
            const k = valueKey(item);
            const isNew = hasPrev && !prevKeys.has(k);
            return (
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
                {formatPy(item, heap)}
              </motion.span>
            );
          })}
        </AnimatePresence>
      </div>
    </section>
  );
}

interface ScalarProps {
  entries: [string, PyValue][];
  prevVars?: Record<string, PyValue>;
  pointerColors: Map<string, string>;
  /** 目前條件式 / 計算正在讀取的變數 */
  compared?: Set<string>;
  /** 計算結果要寫入的變數 */
  written?: Set<string>;
}

export function ScalarGrid({ entries, prevVars, pointerColors, compared, written }: ScalarProps) {
  const heap = useHeap();
  const t = useT();
  if (entries.length === 0) return null;
  return (
    <section>
      <div className="mb-2 font-mono text-[11px] tracking-wide text-ink-400 uppercase">{t('variables')}</div>
      <div className="flex flex-wrap gap-2">
        {entries.map(([name, v]) => {
          const text = formatPy(v, heap);
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
