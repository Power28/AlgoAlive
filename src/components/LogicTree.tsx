import { motion } from 'framer-motion';
import { useValueFormat } from '../lib/heapContext';
import type { Heap, LogicNode } from '../types';
import { formatValue } from '../lib/value';
import { useT } from '../i18n';
import { ResultBadge } from './ConditionPanel';

/** 每個求值步驟之間的動畫間隔（秒） */
const STEP = 0.22;

const GATE_STYLE: Record<'and' | 'or' | 'not', { color: string; bg: string }> = {
  and: { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  or: { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  not: { color: '#f472b6', bg: 'rgba(244,114,182,0.12)' },
};

export const hasLogic = (node: LogicNode | undefined): boolean =>
  !!node && (node.op === 'and' || node.op === 'or' || node.op === 'not' || !!node.children?.some(hasLogic));

/** 子樹中最後一個被求值的順序；邏輯閘的結果在它之後才亮起 */
function lastOrder(node: LogicNode): number {
  const own = node.order ?? -1;
  return Math.max(own, ...(node.children ?? []).map(lastOrder));
}


const clip = (s: string, n = 32) => (s.length > n ? `${s.slice(0, n)}…` : s);

function Leaf({ node, heap }: { node: LogicNode; heap?: Heap }) {
  const fmt = useValueFormat();
  const t = useT();
  if (node.skipped) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-ink-700 px-2 py-1 opacity-45">
        <code className="font-mono text-xs text-ink-400 line-through decoration-ink-600">{node.src}</code>
        <span className="rounded bg-ink-700 px-1.5 py-px text-[10px] text-ink-400">{t('condSkipped')}</span>
      </div>
    );
  }
  const reason = node.op === 'leaf' && node.value && node.value.type !== 'bool' ? fmt.truthReason(node.value) : null;
  const valueText = node.op === 'leaf' && node.value && node.display === node.src ? clip(formatValue(node.value, heap, fmt)) : null;
  return (
    <motion.div
      className="flex flex-wrap items-center gap-2 rounded-md border border-ink-700 bg-ink-900/60 px-2 py-1"
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: (node.order ?? 0) * STEP, duration: 0.2 }}
    >
      <code className="font-mono text-xs text-ink-400">{node.src}</code>
      {node.display && node.display !== node.src && (
        <>
          <span className="text-ink-600">→</span>
          <code className="font-mono text-xs font-semibold text-ink-100">{node.display}</code>
        </>
      )}
      {valueText && <code className="font-mono text-[11px] text-ink-300">= {valueText}</code>}
      {reason && <span className="text-[10px] text-ink-400">{t(reason)}</span>}
      <ResultBadge result={node.truthy} size="sm" />
    </motion.div>
  );
}

function Gate({ node, heap, valueContext }: { node: LogicNode; heap?: Heap; valueContext: boolean }) {
  const fmt = useValueFormat();
  const t = useT();
  const op = node.op as 'and' | 'or' | 'not';
  const style = GATE_STYLE[op];
  const done = (lastOrder(node) + 1) * STEP;
  const children = node.children ?? [];
  // and / or 在表達「值」的情境（賦值、回傳）時，回傳的是運算元本身
  const showValue = valueContext && op !== 'not' && node.value && node.value.type !== 'bool';
  return (
    <div className="rounded-md border-l-2 py-1 pl-2.5" style={{ borderColor: style.color, backgroundColor: node.skipped ? 'transparent' : style.bg, opacity: node.skipped ? 0.45 : 1 }}>
      <div className="flex flex-col gap-1">
        {children.map((child, i) => (
          <div key={i} className="flex flex-col gap-1">
            {op === 'not' && <GateChip label={fmt.logic.not} color={style.color} />}
            <LogicView node={child} heap={heap} valueContext={false} />
            {op !== 'not' && i < children.length - 1 && (
              <div className="flex items-center gap-2">
                <GateChip label={fmt.logic[op]} color={style.color} />
                {node.shortCircuitAt === i && (
                  <motion.span
                    className="text-[10px] text-ink-400"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: ((child.order ?? lastOrder(child)) + 1) * STEP }}
                  >
                    ⚡ {t(fmt.shortCircuit[op === 'and' ? 'and' : 'or'])}
                  </motion.span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      {!node.skipped && (
        <motion.div
          className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: done, type: 'spring', stiffness: 500, damping: 24 }}
        >
          <span className="font-mono font-semibold" style={{ color: style.color }}>
            {fmt.logic[op]} =
          </span>
          {showValue && <code className="font-mono font-semibold text-ink-100">{clip(formatValue(node.value!, heap, fmt), 40)}</code>}
          <ResultBadge result={node.truthy} size="sm" />
        </motion.div>
      )}
    </div>
  );
}

function GateChip({ label, color }: { label: string; color: string }) {
  return (
    <span className="w-fit rounded px-1.5 py-px font-mono text-[11px] font-bold tracking-wide uppercase" style={{ color, backgroundColor: `${color}22` }}>
      {label}
    </span>
  );
}

/** 邏輯樹：and / or / not 依實際求值順序逐一亮起，短路跳過的分支變暗 */
export function LogicView({ node, heap, valueContext }: { node: LogicNode; heap?: Heap; valueContext: boolean }) {
  if (node.op === 'and' || node.op === 'or' || node.op === 'not') return <Gate node={node} heap={heap} valueContext={valueContext} />;
  return <Leaf node={node} heap={heap} />;
}
