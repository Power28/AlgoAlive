import { motion } from 'framer-motion';
import { ArrowDownToLine, ArrowUpFromLine, Layers } from 'lucide-react';
import type { ContainerOp } from '../types';
import { useT, type StringKey } from '../i18n';

export const OP_COLOR = '#34d399';

/** 放入類 / 取出類操作，用來決定圖示 */
const PUT_KINDS = new Set<ContainerOp['kind']>(['push', 'pushleft', 'insert', 'extend', 'add', 'heappush', 'setitem']);
const TAKE_KINDS = new Set<ContainerOp['kind']>(['pop', 'popleft', 'remove', 'discard', 'heappop', 'delitem', 'clear']);

/** 依操作種類挑說明文字 */
function sentenceKey(op: ContainerOp): StringKey {
  if (op.empty) return 'opEmpty';
  switch (op.kind) {
    case 'push':
      return 'opPush';
    case 'pushleft':
      return 'opPushLeft';
    case 'pop':
      if (op.container === 'dict') return op.missing ? 'opMissingKey' : 'opDictPop';
      if (op.container === 'set') return 'opSetPop';
      return op.index !== undefined && op.index !== op.size - 1 ? 'opPopAt' : 'opPop';
    case 'popleft':
      return 'opPopLeft';
    case 'insert':
      return 'opInsert';
    case 'extend':
      return 'opExtend';
    case 'remove':
      return op.missing ? 'opRemoveMissing' : 'opRemove';
    case 'add':
      return op.existed ? 'opAddExisted' : 'opAdd';
    case 'discard':
      return op.existed ? 'opDiscard' : 'opDiscardMissing';
    case 'clear':
      return 'opClear';
    case 'heappush':
      return 'opHeapPush';
    case 'heappop':
      return 'opHeapPop';
    case 'heapify':
      return 'opHeapify';
    case 'heappushpop':
      return 'opHeapPushPop';
    case 'heapreplace':
      return 'opHeapReplace';
    case 'setitem':
      return op.existed ? 'opSetUpdate' : 'opSetNew';
    case 'delitem':
      return op.missing ? 'opMissingKey' : 'opDel';
  }
}

/** 「容器操作」卡片：用一句話說明這一行對容器做了什麼（值在操作發生前就算好） */
export function OpPanel({ op, line }: { op: ContainerOp; line: number }) {
  const t = useT();
  const params = {
    target: op.target,
    value: op.display ?? '?',
    index: op.index ?? '?',
    key: op.key ?? '?',
    popped: op.popped ?? '?',
  };
  const sentence = op.from
    ? t(op.from.end === 'front' ? 'opMoveFront' : 'opMoveBack', { ...params, from: op.from.target, to: t(op.kind === 'pushleft' ? 'opEndFront' : 'opEndBack') })
    : t(sentenceKey(op), params);
  const assign = op.assignTo && !op.empty && !op.missing && op.display !== undefined ? t('opAssign', { assign: op.assignTo }) : '';
  const Icon = PUT_KINDS.has(op.kind) ? ArrowDownToLine : TAKE_KINDS.has(op.kind) ? ArrowUpFromLine : Layers;
  const warn = op.empty || (op.missing && op.kind !== 'discard');
  return (
    <div className="rounded-lg border px-3 py-2.5" style={{ borderColor: `${OP_COLOR}66`, backgroundColor: `${OP_COLOR}0d` }} data-op>
      <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold tracking-wide uppercase" style={{ color: OP_COLOR }}>
        {t('opTitle')}
        <span className="font-mono font-normal normal-case text-ink-400">{t('line', { n: line })}</span>
      </div>
      <code className="block font-mono text-sm text-ink-300">{op.src}</code>
      <motion.div
        className={`mt-1.5 flex items-start gap-2 text-sm ${warn ? 'text-err' : 'text-ink-100'}`}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.2 }}
      >
        <Icon size={15} className="mt-0.5 shrink-0" style={{ color: warn ? undefined : OP_COLOR }} />
        <span>
          {sentence}
          {assign}
        </span>
        {op.display !== undefined && !warn && (
          <motion.code
            className="ml-auto shrink-0 rounded-md px-1.5 py-px font-mono text-xs font-semibold text-ink-900"
            style={{ backgroundColor: OP_COLOR }}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.25, type: 'spring', stiffness: 500, damping: 22 }}
          >
            {op.display}
          </motion.code>
        )}
      </motion.div>
    </div>
  );
}
