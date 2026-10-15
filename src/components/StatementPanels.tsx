import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ArrowRightLeft, ListPlus } from 'lucide-react';
import type { CompInfo, Heap, MultiAssign } from '../types';
import { formatCell } from '../lib/pyValue';
import { useT } from '../i18n';

export const MULTI_COLOR = '#f9a8d4';
export const COMP_COLOR = '#818cf8';

function Card({ color, title, line, children, data }: { color: string; title: string; line: number; children: ReactNode; data: string }) {
  const t = useT();
  return (
    <div className="rounded-lg border px-3 py-2.5" style={{ borderColor: `${color}66`, backgroundColor: `${color}0d` }} {...{ [data]: true }}>
      <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold tracking-wide uppercase" style={{ color }}>
        {title}
        <span className="font-mono font-normal normal-case text-ink-400">{t('line', { n: line })}</span>
      </div>
      {children}
    </div>
  );
}

/** 同時賦值 / 交換：① 先算完右邊所有值 ② 再同時寫入左邊 */
export function MultiPanel({ multi, line }: { multi: MultiAssign; line: number }) {
  const t = useT();
  const n = multi.pairs.length;
  return (
    <Card color={MULTI_COLOR} title={t(multi.swap ? 'swapTitle' : 'multiTitle')} line={line} data="data-multi">
      <code className="block font-mono text-sm text-ink-300">{multi.src}</code>
      <div className="mt-2 grid gap-1.5 text-xs">
        <div className="text-ink-400">{t('multiStep1')}</div>
        <div className="flex flex-wrap gap-1.5">
          {multi.pairs.map((p, i) => (
            <motion.span
              key={i}
              className="flex items-center gap-1 rounded-md border border-ink-700 bg-ink-900/60 px-1.5 py-0.5 font-mono"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 * i, duration: 0.2 }}
            >
              <span className="text-ink-400">{p.valueSrc}</span>
              {p.valueSrc !== p.display && (
                <>
                  <span className="text-ink-600">→</span>
                  <span className="font-semibold text-ink-100">{p.display}</span>
                </>
              )}
            </motion.span>
          ))}
        </div>
        <div className="text-ink-400">{t('multiStep2')}</div>
        <div className="flex flex-wrap gap-1.5">
          {multi.pairs.map((p, i) => (
            <motion.span
              key={i}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono"
              style={{ backgroundColor: `${MULTI_COLOR}22` }}
              // 寫入要在「所有值都算完」之後才一起出現
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.12 * n + 0.25, type: 'spring', stiffness: 500, damping: 24 }}
            >
              <span className="font-semibold" style={{ color: MULTI_COLOR }}>
                {p.target}
              </span>
              <span className="text-ink-400">←</span>
              <span className="font-semibold text-ink-100">{p.display}</span>
            </motion.span>
          ))}
        </div>
        {multi.swap && (
          <p className="flex items-center gap-1.5 text-[11px] text-ink-400">
            <ArrowRightLeft size={12} style={{ color: MULTI_COLOR }} />
            {t('swapNote')}
          </p>
        )}
      </div>
    </Card>
  );
}

/** 推導式：這一圈的元素、條件、算出的值，以及結果一格一格長出來 */
export function CompPanel({ comp, line, heap }: { comp: CompInfo; line: number; heap?: Heap }) {
  const t = useT();
  const items =
    comp.result.type === 'dict'
      ? comp.result.entries.map(([k, v]) => `${formatCell(k, heap)}: ${formatCell(v, heap)}`)
      : 'items' in comp.result
        ? comp.result.items.map((x) => formatCell(x, heap))
        : [];
  const [open, close] = comp.kind === 'list' ? ['[', ']'] : ['{', '}'];
  return (
    <Card color={COMP_COLOR} title={t('compTitle')} line={line} data="data-comp">
      <code className="block font-mono text-sm text-ink-300">{comp.src}</code>
      <motion.div
        className="mt-1.5 flex flex-wrap items-center gap-2 text-sm"
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <ListPlus size={15} style={{ color: COMP_COLOR }} />
        {comp.count === 0 ? (
          <span className="text-ink-300">{t('compStart')}</span>
        ) : (
          <>
            <span className="font-mono text-ink-100">{t('compItem', { k: comp.count, item: comp.item, value: comp.itemDisplay ?? '?' })}</span>
            <span className="text-ink-600">→</span>
            {comp.kept ? (
              <span className="rounded-md px-1.5 py-px font-mono text-xs font-semibold text-ink-900" style={{ backgroundColor: COMP_COLOR }}>
                {t('compAdd', { value: comp.valueDisplay ?? '?' })}
              </span>
            ) : (
              <span className="text-xs text-ink-400">{t('compSkip')}</span>
            )}
          </>
        )}
      </motion.div>
      <div className="mt-2 flex flex-wrap items-center gap-1 font-mono text-xs">
        <span className="mr-1 text-[11px] text-ink-400">{t('compResult')}</span>
        <span className="text-ink-400">{open}</span>
        {items.map((text, i) => {
          const isNew = comp.kept && i === items.length - 1 && comp.kind === 'list';
          return (
            <motion.span
              key={`${i}-${text}`}
              className="rounded border px-1.5 py-px"
              style={{ borderColor: isNew ? COMP_COLOR : '#3e3e3e', color: isNew ? '#eff1f6' : '#b3b3b3' }}
              initial={isNew ? { opacity: 0, scale: 0.5 } : false}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 500, damping: 24 }}
            >
              {text}
            </motion.span>
          );
        })}
        <span className="text-ink-400">{close}</span>
      </div>
    </Card>
  );
}
