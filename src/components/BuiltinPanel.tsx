import { useEffect, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Check, Crown, Sigma, X } from 'lucide-react';
import type { BuiltinCall } from '../types';
import { useT } from '../i18n';
import { Card } from './StatementPanels';

export const BUILTIN_COLOR = '#a3e635';
const OK = '#2cbb5d';
const ERR = '#ef4743';
const STAGGER = 0.12;

/** 一個元素格子 */
function Chip({ children, delay = 0, tone, faded, struck, layout, title }: {
  children: ReactNode;
  delay?: number;
  tone?: string;
  faded?: boolean;
  struck?: boolean;
  layout?: boolean;
  title?: string;
}) {
  return (
    <motion.span
      layout={layout}
      title={title}
      className="inline-flex min-w-7 items-center justify-center rounded-md border px-1.5 py-0.5 font-mono text-xs text-ink-100"
      style={{
        borderColor: tone ? `${tone}aa` : '#3e3e3e',
        backgroundColor: tone ? `${tone}1f` : '#2a2a2a',
        textDecoration: struck ? 'line-through' : 'none',
      }}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: faded ? 0.35 : 1, y: 0 }}
      transition={{ delay, duration: 0.2, layout: { type: 'spring', stiffness: 260, damping: 26 } }}
    >
      {children}
    </motion.span>
  );
}

function Below({ children, delay, color }: { children: ReactNode; delay: number; color?: string }) {
  return (
    <motion.span
      className="font-mono text-[10px] leading-3"
      style={{ color: color ?? '#8a8a8a' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay }}
    >
      {children}
    </motion.span>
  );
}

function Result({ value, delay }: { value: string; delay: number }) {
  return (
    <motion.span
      className="inline-flex items-center gap-1.5 font-mono text-sm"
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.2 }}
      data-builtin-result
    >
      <span className="text-ink-400">→</span>
      <span className="font-semibold" style={{ color: BUILTIN_COLOR }}>
        {value}
      </span>
    </motion.span>
  );
}

function More({ n }: { n?: number }) {
  const t = useT();
  return n ? <span className="self-center text-[11px] text-ink-400">{t('bMore', { n })}</span> : null;
}

/** 排序 / 反轉：先照原本順序排開，再滑到新位置 */
function Reorder({ call }: { call: BuiltinCall }) {
  const items = call.items ?? [];
  const order = call.order ?? items.map((_, i) => i);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setDone(true), 650);
    return () => clearTimeout(timer);
  }, []);
  const shown = done ? order : items.map((_, i) => i);
  return (
    <div className="flex flex-wrap gap-1.5" data-reorder={done ? 'done' : 'start'}>
      {shown.map((i) => (
        <span key={i} className="inline-flex flex-col items-center gap-0.5">
          <Chip layout delay={0}>
            {items[i]}
          </Chip>
          {call.keys && <Below delay={0.2}>{call.keys[i]}</Below>}
        </span>
      ))}
    </div>
  );
}

export function BuiltinPanel({ call, line }: { call: BuiltinCall; line: number }) {
  const t = useT();
  const items = call.items ?? [];
  const n = items.length;
  const end = STAGGER * n + 0.2;
  let note: ReactNode = null;
  let body: ReactNode;

  switch (call.func) {
    case 'sum':
      note = t('bSum');
      body = (
        <div className="flex flex-wrap items-start gap-1.5">
          {items.map((v, i) => (
            <span key={i} className="inline-flex flex-col items-center gap-0.5">
              <Chip delay={STAGGER * i}>{v}</Chip>
              <Below delay={STAGGER * i + 0.08} color={BUILTIN_COLOR}>
                {call.running?.[i]}
              </Below>
            </span>
          ))}
          <More n={call.more} />
        </div>
      );
      break;
    case 'min':
    case 'max':
      note = (
        <>
          {t(call.func === 'min' ? 'bMin' : 'bMax')}
          {call.keys && <span className="text-ink-400"> · {t('bByKey')}</span>}
        </>
      );
      body = (
        // 上方留空間給勝出元素的皇冠
        <div className="flex flex-wrap items-start gap-1.5 pt-1.5">
          {items.map((v, i) => (
            <span key={i} className="relative inline-flex flex-col items-center gap-0.5" data-pick={i === call.pick || undefined}>
              <Chip delay={STAGGER * i} tone={i === call.pick ? OK : undefined}>
                {v}
              </Chip>
              {call.keys && <Below delay={STAGGER * i + 0.05}>{call.keys[i]}</Below>}
              {i === call.pick && (
                <motion.span
                  className="absolute -top-2.5 -right-1.5"
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: end, type: 'spring', stiffness: 500, damping: 20 }}
                >
                  <Crown size={12} style={{ color: OK }} />
                </motion.span>
              )}
            </span>
          ))}
          <More n={call.more} />
        </div>
      );
      break;
    case 'sorted':
    case 'sort':
    case 'reversed':
      note =
        call.func === 'reversed' ? (
          t('bReversed')
        ) : (
          <>
            {call.func === 'sort' ? t('bSort', { target: call.target ?? '' }) : t('bSorted')}
            {call.reverse && ` ${t('bReverseOrder')}`}
            {call.keys && <span className="text-ink-400"> · {t('bByKey')}</span>}
          </>
        );
      body = call.order ? <Reorder call={call} /> : <div className="flex flex-wrap gap-1.5">{items.map((v, i) => <Chip key={i}>{v}</Chip>)}<More n={call.more} /></div>;
      break;
    case 'any':
    case 'all': {
      const stopColor = call.func === 'any' ? OK : ERR;
      note = (
        <>
          {t(call.func === 'any' ? 'bAny' : 'bAll')}
          {call.elt && call.elt !== call.var && <span className="text-ink-400"> · {t('bCheck', { elt: call.elt, var: call.var ?? '' })}</span>}
        </>
      );
      body = (
        <div className="flex flex-wrap items-start gap-1.5">
          {items.map((v, i) => {
            const ok = call.truth?.[i];
            return (
              <span key={i} className="inline-flex flex-col items-center gap-0.5" data-truth={ok ? 'true' : 'false'}>
                <Chip delay={STAGGER * i} tone={i === call.stop ? stopColor : undefined}>
                  {v}
                </Chip>
                <motion.span initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: STAGGER * i + 0.08 }}>
                  {ok ? <Check size={11} style={{ color: OK }} /> : <X size={11} style={{ color: ERR }} />}
                </motion.span>
              </span>
            );
          })}
          <More n={call.more} />
        </div>
      );
      break;
    }
    case 'enumerate':
      note = t('bEnumerate', { start: call.start ?? 0 });
      body = (
        <div className="flex flex-wrap items-end gap-1.5">
          {items.map((v, i) => (
            <span key={i} className="inline-flex flex-col items-center gap-0.5">
              <Below delay={STAGGER * i + 0.05} color={BUILTIN_COLOR}>
                {(call.start ?? 0) + i}
              </Below>
              <Chip delay={STAGGER * i}>{v}</Chip>
            </span>
          ))}
          <More n={call.more} />
        </div>
      );
      break;
    case 'zip': {
      const cols = call.columns ?? [];
      const width = Math.max(0, ...cols.map((c) => c.length));
      note = t('bZip', { n: call.count ?? 0 });
      body = (
        <div className="flex items-start gap-2">
          <div className="flex flex-col gap-1.5 pt-0.5 font-mono text-[11px] text-ink-400">
            {(call.names ?? []).map((name) => (
              <span key={name} className="leading-[22px]">
                {name}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: width }, (_, k) => (
              <motion.span
                key={k}
                className="inline-flex flex-col gap-1.5 rounded-md p-0.5"
                style={{ outline: k < (call.count ?? 0) ? `1px dashed ${BUILTIN_COLOR}66` : 'none' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: k < (call.count ?? 0) ? 1 : 0.35 }}
                transition={{ delay: STAGGER * k }}
              >
                {cols.map((c, j) => (
                  <Chip key={j} delay={STAGGER * k}>
                    {c[k] ?? '·'}
                  </Chip>
                ))}
              </motion.span>
            ))}
          </div>
        </div>
      );
      break;
    }
    case 'set':
      note = t('bSet');
      body = (
        <div className="flex flex-wrap gap-1.5">
          {items.map((v, i) => (
            <Chip key={i} delay={STAGGER * i} faded={!call.kept?.[i]} struck={!call.kept?.[i]}>
              {v}
            </Chip>
          ))}
          <More n={call.more} />
        </div>
      );
      break;
    case 'Counter':
      note = t('bCounter');
      body = (
        <div className="grid gap-1.5">
          <div className="flex flex-wrap gap-1.5">
            {items.map((v, i) => (
              <Chip key={i} delay={STAGGER * i}>
                {v}
              </Chip>
            ))}
            <More n={call.more} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(call.counts ?? []).map(([k, c], i) => (
              <motion.span
                key={k}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-xs"
                style={{ backgroundColor: `${BUILTIN_COLOR}1f` }}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: end + 0.08 * i }}
              >
                <span className="text-ink-100">{k}</span>
                <span className="font-semibold" style={{ color: BUILTIN_COLOR }}>
                  ×{c}
                </span>
              </motion.span>
            ))}
          </div>
        </div>
      );
      break;
    case 'join':
      note = call.sep === "''" || !call.sep ? t('bJoinEmpty') : t('bJoin', { sep: call.sep });
      body = (
        <div className="flex flex-wrap items-center gap-1">
          {items.map((v, i) => (
            <span key={i} className="inline-flex items-center gap-1">
              {i > 0 && call.sep !== "''" && (
                <Below delay={STAGGER * i} color={BUILTIN_COLOR}>
                  {call.sep}
                </Below>
              )}
              <Chip delay={STAGGER * i}>{v}</Chip>
            </span>
          ))}
          <More n={call.more} />
        </div>
      );
      break;
  }

  const stopped = (call.func === 'any' || call.func === 'all') && (
    <motion.span className="text-[11px] text-ink-400" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: end }}>
      {call.stop !== undefined ? t('bStopped') : t('bNoStop')}
    </motion.span>
  );

  return (
    <Card color={BUILTIN_COLOR} title={`${t('builtinTitle')} · ${call.func}`} line={line} data="data-builtin">
      <div className="flex items-start gap-2">
        <Sigma size={15} className="mt-0.5 shrink-0" style={{ color: BUILTIN_COLOR }} />
        <div className="min-w-0 flex-1">
          <code className="block truncate font-mono text-sm text-ink-300">{call.src}</code>
          <div className="mt-0.5 text-xs text-ink-200">{note}</div>
          <div className="mt-2">{body}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            {call.result !== undefined && <Result value={call.result} delay={call.order ? 1.0 : end} />}
            {stopped}
          </div>
        </div>
      </div>
    </Card>
  );
}
