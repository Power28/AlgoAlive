import { Fragment } from 'react';
import { motion } from 'framer-motion';
import type { Calc } from '../types';
import { WRITE_COLOR } from '../lib/stepMarks';
import { useT } from '../i18n';

/** 視覺化面板上方的「計算」卡片：把右邊的運算式一步步化簡到結果 */
export function CalcPanel({ calc, line }: { calc: Calc; line: number }) {
  const t = useT();
  const last = calc.stages.length - 1;
  return (
    <div className="rounded-lg border px-3 py-2.5" style={{ borderColor: `${WRITE_COLOR}66`, backgroundColor: `${WRITE_COLOR}0d` }} data-calc>
      <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold tracking-wide uppercase" style={{ color: WRITE_COLOR }}>
        {t('calcTitle')}
        <span className="font-mono font-normal normal-case text-ink-400">{t('line', { n: line })}</span>
      </div>
      <code className="block font-mono text-sm text-ink-300">{calc.src}</code>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-sm">
        {calc.target && (
          <span className="text-ink-400">
            {calc.target} <span className="text-ink-600">{calc.kind === 'aug' ? '←' : '='}</span>
          </span>
        )}
        {calc.kind === 'return' && <span className="text-ink-400">return</span>}
        {calc.stages.map((stage, i) => (
          <Fragment key={i}>
            {i > 0 && (
              <motion.span className="text-ink-600" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.22 * i }}>
                →
              </motion.span>
            )}
            <motion.span
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22 * i, duration: 0.2 }}
              className={i === last ? 'rounded-md px-1.5 py-px font-semibold text-ink-900' : 'font-semibold text-ink-100'}
              style={i === last ? { backgroundColor: WRITE_COLOR } : undefined}
            >
              {stage}
            </motion.span>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
