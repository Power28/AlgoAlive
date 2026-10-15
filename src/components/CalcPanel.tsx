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

const SIGN_COLOR = '#f87171';

/** 有負數時的位寬：8 / 16 / 32 中放得下所有值（負數的二補數、或遮罩後的大正數）的最小者 */
export function signedWidth(values: number[]): number {
  return [8, 16, 32].find((w) => values.every((v) => v >= -(2 ** (w - 1)) && v < 2 ** w)) ?? 32;
}

/** 位元運算：運算元對齊成二進位，結果由右到左一位一位算出來 */
function BitsView({ bits, delay }: { bits: Bits; delay: number }) {
  const t = useT();
  const single = bits.op === '<<' || bits.op === '>>' || bits.op === '~';
  const values = [bits.left, ...(single ? [] : [bits.right]), bits.result];
  // 有負數：Python 的整數沒有位數上限，負數是「左邊有無限多個 1」的二補數；畫出固定位寬，左邊再標示延伸的符號位
  const signed = values.some((v) => v < 0);
  const width = signed ? signedWidth(values) : Math.max(4, ...values.map((n) => n.toString(2).length));
  const toBits = (n: number) => (n < 0 ? n + 2 ** width : n).toString(2).padStart(width, '0').split('');
  const resultLabel = bits.op === '~' ? '~' : single ? `${bits.op} ${bits.right}` : '=';
  const rows: { label: string; value: number; cells: string[]; result?: boolean }[] = [
    { label: '', value: bits.left, cells: toBits(bits.left) },
    ...(single ? [] : [{ label: bits.op, value: bits.right, cells: toBits(bits.right) }]),
    { label: resultLabel, value: bits.result, cells: toBits(bits.result), result: true },
  ];
  const cell = width > 16 ? '0.95rem' : width > 8 ? '1.2rem' : '1.5rem';
  return (
    <div className="mt-2.5 border-t pt-2" style={{ borderColor: `${WRITE_COLOR}33` }} data-bits={signed ? 'signed' : 'unsigned'}>
      <div className="mb-1 text-[10px] font-semibold tracking-wide text-ink-400 uppercase">
        {t('bitsTitle')}
        {signed && <span className="ml-2 font-normal normal-case">{t('bitsWidth', { w: width })}</span>}
      </div>
      <div className="scrollbar-thin overflow-x-auto pb-1">
        <div
          className={`inline-grid gap-y-1 font-mono ${width > 16 ? 'text-xs' : 'text-sm'}`}
          style={{ gridTemplateColumns: `3rem ${signed ? '1.6rem ' : ''}repeat(${width}, ${cell}) auto` }}
        >
          {rows.map((row, r) => (
            <Fragment key={r}>
              <span className={`pr-2 text-right ${row.result ? 'font-semibold' : ''} text-ink-400`}>{row.label}</span>
              {signed && (
                // 左邊無限延伸的符號位：負數是 …111，非負數是 …000
                <span className="flex h-6 items-center justify-end pr-1 text-ink-500" title={t('bitsExtend')} data-extend={row.value < 0 ? '1' : '0'}>
                  …{row.value < 0 ? '1' : '0'}
                </span>
              )}
              {row.cells.map((bit, c) => {
                const one = bit === '1';
                // 符號位只在負數那一列標出（遮罩後的大正數，最高位是 1 但不是負數）
                const sign = signed && c === 0 && row.value < 0;
                // 結果那一列由右到左依序出現，像手算一樣逐位計算
                const cellDelay = row.result ? delay + (width - 1 - c) * (width > 16 ? 0.04 : 0.09) : 0;
                return (
                  <motion.span
                    key={c}
                    className={`mx-px flex h-6 items-center justify-center rounded ${row.result ? 'font-bold' : ''}`}
                    style={{
                      // 每 4 位留一點間隔，長的位元串比較好讀
                      marginLeft: c > 0 && (width - c) % 4 === 0 ? 4 : undefined,
                      backgroundColor: one ? (row.result ? WRITE_COLOR : '#3e3e3e') : 'transparent',
                      color: one ? (row.result ? '#111' : '#eff1f6') : '#5a5a5a',
                      boxShadow: sign ? `inset 0 0 0 1px ${SIGN_COLOR}aa` : 'none',
                    }}
                    title={sign ? t('bitsSignBit') : undefined}
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
      {signed && (
        <p className="mt-1 text-[11px] text-ink-400" data-bits-note>
          <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm align-[-1px]" style={{ boxShadow: `inset 0 0 0 1px ${SIGN_COLOR}` }} />
          {t('bitsSignedNote')}
        </p>
      )}
    </div>
  );
}
