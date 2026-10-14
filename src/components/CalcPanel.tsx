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
      {calc.bits?.length ? <BitsView bits={calc.bits[calc.bits.length - 1]} delay={0.22 * calc.stages.length} /> : null}
    </div>
  );
}

type Bits = NonNullable<Calc['bits']>[number];

/** 位元運算：運算元對齊成二進位，結果由右到左一位一位算出來 */
function BitsView({ bits, delay }: { bits: Bits; delay: number }) {
  const t = useT();
  const shift = bits.op === '<<' || bits.op === '>>';
  const width = Math.max(4, ...[bits.left, shift ? 0 : bits.right, bits.result].map((n) => n.toString(2).length));
  const toBits = (n: number) => n.toString(2).padStart(width, '0').split('');
  const rows: { label: string; value: number; cells: string[]; result?: boolean }[] = [
    { label: '', value: bits.left, cells: toBits(bits.left) },
    ...(shift ? [] : [{ label: bits.op, value: bits.right, cells: toBits(bits.right) }]),
    { label: shift ? `${bits.op} ${bits.right}` : '=', value: bits.result, cells: toBits(bits.result), result: true },
  ];
  return (
    <div className="mt-2.5 border-t pt-2" style={{ borderColor: `${WRITE_COLOR}33` }} data-bits>
      <div className="mb-1 text-[10px] font-semibold tracking-wide text-ink-400 uppercase">{t('bitsTitle')}</div>
      <div className="inline-grid gap-y-1 font-mono text-sm" style={{ gridTemplateColumns: `3rem repeat(${width}, 1.5rem) auto` }}>
        {rows.map((row, r) => (
          <Fragment key={r}>
            <span className={`pr-2 text-right ${row.result ? 'font-semibold' : ''} text-ink-400`}>{row.label}</span>
            {row.cells.map((bit, c) => {
              const one = bit === '1';
              // 結果那一列由右到左依序出現，像手算一樣逐位計算
              const cellDelay = row.result ? delay + (width - 1 - c) * 0.09 : 0;
              return (
                <motion.span
                  key={c}
                  className={`mx-px flex h-6 items-center justify-center rounded ${row.result ? 'font-bold' : ''}`}
                  style={{
                    backgroundColor: one ? (row.result ? WRITE_COLOR : '#3e3e3e') : 'transparent',
                    color: one ? (row.result ? '#111' : '#eff1f6') : '#5a5a5a',
                  }}
                  initial={row.result ? { opacity: 0, y: -6 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: cellDelay, duration: 0.18 }}
                >
                  {bit}
                </motion.span>
              );
            })}
            <span className={`pl-3 text-xs ${row.result ? 'font-semibold text-ink-100' : 'text-ink-400'}`}>({row.value})</span>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
