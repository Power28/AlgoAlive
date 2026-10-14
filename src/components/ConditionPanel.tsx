import { motion } from 'framer-motion';
import { Check, CircleHelp, X } from 'lucide-react';
import type { Condition, ConditionPart, ExecutionStep, Heap } from '../types';
import { formatPy } from '../lib/pyValue';
import { useT } from '../i18n';
import { LogicView, hasLogic } from './LogicTree';

const MAX_VALUE = 28;

/** 條件式的結果徽章：✓ True / ✗ False / ? */
export function ResultBadge({ result, size = 'md' }: { result: boolean | null | undefined; size?: 'sm' | 'md' }) {
  const t = useT();
  const cls = size === 'sm' ? 'px-1.5 py-px text-[11px] gap-1' : 'px-2 py-0.5 text-xs gap-1.5';
  const icon = size === 'sm' ? 11 : 13;
  if (result === true)
    return (
      <span className={`inline-flex items-center rounded-md bg-ok/20 font-mono font-semibold text-ok ${cls}`}>
        <Check size={icon} strokeWidth={3} /> True
      </span>
    );
  if (result === false)
    return (
      <span className={`inline-flex items-center rounded-md bg-err/20 font-mono font-semibold text-err ${cls}`}>
        <X size={icon} strokeWidth={3} /> False
      </span>
    );
  return (
    <span className={`inline-flex items-center rounded-md bg-ink-700 font-mono text-ink-400 ${cls}`} title={t('condUnknownHint')}>
      <CircleHelp size={icon} /> {t('condUnknown')}
    </span>
  );
}

/** truth 項目：容器沒有短的顯示值時，補上實際內容，例如 stack = [] */
function truthValue(part: ConditionPart, heap?: Heap) {
  const term = part.terms?.[0];
  if (!term?.value || term.display !== term.src) return null;
  const text = formatPy(term.value, heap);
  return text.length > MAX_VALUE ? `${text.slice(0, MAX_VALUE)}…` : text;
}

function Part({ part, heap, delay }: { part: ConditionPart; heap?: Heap; delay: number }) {
  const t = useT();
  if (part.skipped) {
    return (
      <div className="flex flex-wrap items-center gap-2 opacity-45">
        <code className="font-mono text-xs text-ink-400 line-through decoration-ink-600">{part.src}</code>
        <span className="rounded bg-ink-700 px-1.5 py-px text-[10px] text-ink-400">{t('condSkipped')}</span>
      </div>
    );
  }
  const extra = part.kind === 'truth' ? truthValue(part, heap) : null;
  return (
    <motion.div
      className="flex flex-wrap items-center gap-2"
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.2 }}
    >
      <code className="font-mono text-xs text-ink-400">{part.src}</code>
      {part.display !== part.src && (
        <>
          <span className="text-ink-600">→</span>
          <code className="font-mono text-xs font-semibold text-ink-100">{part.display}</code>
        </>
      )}
      {extra && <code className="font-mono text-[11px] text-ink-400">= {extra}</code>}
      <ResultBadge result={part.result} size="sm" />
    </motion.div>
  );
}

/** 視覺化面板上方的「條件判斷」卡片：代入數值後的比較，以及 and / or 的短路過程 */
export function ConditionPanel({ condition, heap, line }: { condition: Condition; heap?: Heap; line: number }) {
  const t = useT();
  const logic = hasLogic(condition.tree);
  const compound = !logic && condition.parts.length > 1;
  // 賦值 / 回傳中的 and / or：結果是被選中的運算元本身，不只是 True / False
  const valueContext = condition.context === 'value';
  const valueText = valueContext && condition.value && condition.value.type !== 'bool' ? formatPy(condition.value, heap) : null;
  return (
    <div className="rounded-lg border border-[#c084fc]/40 bg-[#c084fc]/8 px-3 py-2.5" data-condition>
      <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold tracking-wide text-[#c084fc] uppercase">
        {t(logic && valueContext ? 'logicTitle' : 'condTitle')}
        <span className="font-mono font-normal normal-case text-ink-400">{t('line', { n: line })}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <code className="font-mono text-sm text-ink-300">{condition.src}</code>
        {condition.display !== condition.src && (
          <>
            <span className="text-ink-600">→</span>
            <motion.code
              className="font-mono text-sm font-semibold text-ink-100"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {condition.display}
            </motion.code>
          </>
        )}
        {valueText && (
          <>
            <span className="text-ink-600">=</span>
            <code className="font-mono text-sm font-semibold text-ink-100">{valueText.length > 40 ? `${valueText.slice(0, 40)}…` : valueText}</code>
          </>
        )}
        <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.25, type: 'spring', stiffness: 500, damping: 22 }}>
          <ResultBadge result={condition.result} />
        </motion.span>
      </div>
      {valueText && <p className="mt-1 text-[11px] text-ink-400">{t('andOrReturnsOperand')}</p>}
      {logic && condition.tree && (
        <div className="mt-2 border-t border-[#c084fc]/20 pt-2">
          <LogicView node={condition.tree} heap={heap} valueContext={valueContext} />
        </div>
      )}
      {compound && (
        <div className="mt-2 flex flex-col gap-1 border-t border-[#c084fc]/20 pt-2">
          {condition.parts.map((part, i) => (
            <Part key={i} part={part} heap={heap} delay={0.08 * i} />
          ))}
        </div>
      )}
    </div>
  );
}

/** 程式碼行尾的提示：條件式顯示代入後的真假，計算顯示化簡結果 */
export type HintTone = 'true' | 'false' | 'unknown' | 'calc';

export function lineHint(step: ExecutionStep | undefined): { text: string; tone: HintTone } | undefined {
  if (!step || step.event !== 'line') return undefined;
  const clip = (s: string, n = 60) => (s.length > n ? `${s.slice(0, n)}…` : s);
  if (step.condition) {
    const c = step.condition;
    // 賦值 / 回傳中的 and / or：提示實際被選中的值
    if (c.context === 'value' && c.value && c.value.type !== 'bool') {
      return { text: `${clip(c.display)} → ${clip(formatPy(c.value, step.heap), 30)}`, tone: 'calc' };
    }
    const tone: HintTone = c.result === true ? 'true' : c.result === false ? 'false' : 'unknown';
    return { text: `${clip(c.display)}${c.result === null ? '' : ` → ${c.result ? 'True' : 'False'}`}`, tone };
  }
  if (step.calc) {
    const { stages } = step.calc;
    const text = stages.length > 1 ? `${clip(stages[0])} → ${clip(stages[stages.length - 1])}` : `= ${clip(stages[0])}`;
    return { text, tone: 'calc' };
  }
  return undefined;
}
