import { motion } from 'framer-motion';
import { ArrowDown, Check, CornerDownRight, ShieldAlert, X, Zap } from 'lucide-react';
import type { ExcFlow, TryFlow } from '../types';
import { useT } from '../i18n';
import { useValueFormat } from '../lib/heapContext';
import { Card } from './StatementPanels';

export const EXC_COLOR = '#ef4743';
export const TRY_COLOR = '#2dd4bf';
const OK = '#2cbb5d';

function MatchIcon({ match }: { match: boolean | null }) {
  if (match === true) return <Check size={12} style={{ color: OK }} />;
  if (match === false) return <X size={12} style={{ color: EXC_COLOR }} />;
  return <span className="text-[10px] text-ink-400">?</span>;
}

/** 例外發生：依序比對每個 except，最後被接住 / 經過 finally / 往外拋 */
export function ExcPanel({ exc, line, func }: { exc: ExcFlow; line: number; func: string }) {
  const t = useT();
  const fmt = useValueFormat();
  let delay = 0.15;
  const next = () => (delay += 0.18);
  const { outcome } = exc;
  return (
    <Card color={EXC_COLOR} title={t('excTitle')} line={line} data="data-exc">
      <motion.div
        className="flex items-start gap-2 font-mono text-sm font-semibold"
        style={{ color: EXC_COLOR }}
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
      >
        <Zap size={15} className="mt-0.5 shrink-0" />
        <span className="break-all">
          {exc.type}
          {exc.message && <span className="font-normal text-ink-300">: {exc.message}</span>}
        </span>
      </motion.div>
      <div className="mt-2 grid gap-1.5 pl-6 text-xs">
        {exc.route.length === 0 && outcome.kind !== 'caught' && <div className="text-ink-400">{t('excNoTry')}</div>}
        {exc.route.map((r) => (
          <div key={r.line} className="flex flex-wrap items-center gap-1.5">
            <span className="text-ink-400">{t('excInTry', { n: r.line })}</span>
            {r.handlers.map((h) => (
              <motion.span
                key={h.line}
                className="flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono"
                style={{ borderColor: h.match ? `${OK}88` : '#3e3e3e', backgroundColor: h.match ? `${OK}1a` : 'transparent' }}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: next(), duration: 0.2 }}
                data-handler={h.match === true ? 'match' : h.match === false ? 'miss' : 'unknown'}
              >
                <span className="text-ink-300">{h.src}</span>
                <MatchIcon match={h.match} />
              </motion.span>
            ))}
            {r.finally !== null && (
              <motion.span
                className="rounded-md px-1.5 py-0.5 text-ink-300"
                style={{ backgroundColor: `${TRY_COLOR}1f` }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: next() }}
              >
                {t('excFinallyFirst', { n: r.finally })}
              </motion.span>
            )}
          </div>
        ))}
        <motion.div
          className="flex items-start gap-1.5"
          style={{ color: outcome.kind === 'caught' ? OK : outcome.kind === 'uncaught' ? EXC_COLOR : '#fbbf24' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: next() }}
          data-outcome={outcome.kind}
        >
          {outcome.kind === 'caught' ? <CornerDownRight size={13} className="mt-px shrink-0" /> : <ArrowDown size={13} className="mt-px shrink-0" />}
          <span>
            {outcome.kind === 'caught'
              ? t(fmt.handler === 'catch' ? 'excCaughtJs' : 'excCaught', { n: outcome.line })
              : outcome.kind === 'propagate'
                ? t('excPropagate', { f: func, caller: outcome.func, n: outcome.line })
                : t('excUncaught')}
          </span>
        </motion.div>
      </div>
    </Card>
  );
}

/** try: / except 比對 / else / finally：說明程式為什麼走到這一行 */
export function TryPanel({ flow, line }: { flow: TryFlow; line: number }) {
  const t = useT();
  const fmt = useValueFormat();
  const js = fmt.handler === 'catch';
  const title = flow.kind === 'except' ? fmt.handler : flow.kind;
  const color = flow.kind === 'except' && flow.match === false ? '#9a9a9a' : TRY_COLOR;
  let body;
  if (flow.kind === 'try') {
    body = (
      <>
        <div>{flow.handlers.length ? t(js ? 'tryStartJs' : 'tryStart') : t(js ? 'tryOnlyFinallyJs' : 'tryOnlyFinally')}</div>
        {flow.handlers.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {flow.handlers.map((h, i) => (
              <motion.span
                key={h}
                className="rounded-md border border-ink-700 px-1.5 py-0.5 font-mono text-xs text-ink-300"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + 0.12 * i, duration: 0.2 }}
              >
                {i + 1}. {h}
              </motion.span>
            ))}
          </div>
        )}
        {flow.finally !== null && <div className="mt-1 text-xs text-ink-400">{t('tryFinallyAlways', { n: flow.finally })}</div>}
      </>
    );
  } else if (flow.kind === 'except') {
    body = (
      <>
        <div className="font-mono text-[13px]">
          {/* JavaScript 的 catch 不比對型別：接住所有例外 */}
          {js ? t('catchAll', { type: flow.type }) : t('exceptCheck', { type: flow.type, src: flow.src })}
        </div>
        <motion.div
          className="mt-1 flex items-center gap-1.5 text-xs font-semibold"
          style={{ color: flow.match ? OK : flow.match === false ? EXC_COLOR : '#9a9a9a' }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25, type: 'spring', stiffness: 400, damping: 24 }}
        >
          <MatchIcon match={flow.match} />
          {flow.match
            ? flow.as
              ? t(js ? 'catchYesAs' : 'exceptYesAs', { name: flow.as })
              : t(js ? 'catchYes' : 'exceptYes')
            : flow.match === false
              ? t('exceptNo')
              : t('exceptUnknown')}
        </motion.div>
      </>
    );
  } else if (flow.kind === 'else') {
    body = <div>{t('elseRuns')}</div>;
  } else {
    body = (
      <div style={{ color: flow.reraise ? '#fbbf24' : undefined }}>
        {flow.exc ? t(flow.reraise ? 'finallyReraise' : js ? 'finallyHandledJs' : 'finallyHandled', { exc: flow.exc }) : t('finallyAlways')}
      </div>
    );
  }
  return (
    <Card color={color} title={title} line={line} data="data-try">
      <motion.div
        className="flex items-start gap-2 text-sm text-ink-100"
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
      >
        <ShieldAlert size={15} className="mt-0.5 shrink-0" style={{ color }} />
        <div className="min-w-0 flex-1">{body}</div>
      </motion.div>
    </Card>
  );
}
