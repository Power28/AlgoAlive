import { useMemo } from 'react';
import { ChevronsRight, Infinity as InfinityIcon, Loader2, Repeat } from 'lucide-react';
import type { ExecutionStep } from '../types';
import { findRepeatedState, nextStepLimit } from '../lib/stepLimit';
import { useT } from '../i18n';

/**
 * 到達步數上限：判斷是不是無窮迴圈（狀態完全重複），不是的話可以繼續追蹤更多步。
 * 已記錄的步驟照常可以播放。
 */
export function StepLimitBox({ steps, limit, line, busy, onMore, onSeek }: {
  steps: ExecutionStep[];
  limit: number;
  line?: number | null;
  busy: boolean;
  onMore: (limit: number) => void;
  onSeek: (step: number) => void;
}) {
  const t = useT();
  const repeat = useMemo(() => findRepeatedState(steps), [steps]);
  const next = nextStepLimit(limit);
  const fmt = (n: number) => n.toLocaleString('en-US');
  return (
    <div data-error data-step-limit={repeat ? 'loop' : 'more'} className="mb-5 rounded-lg border border-brand/40 bg-brand/10 px-3 py-2.5 text-sm">
      <div className="flex items-start gap-2">
        {repeat ? <Repeat size={16} className="mt-0.5 shrink-0 text-err" /> : <InfinityIcon size={16} className="mt-0.5 shrink-0 text-brand" />}
        <div className="min-w-0">
          <div className="font-semibold text-brand">{t('limitTitle', { n: fmt(limit) })}</div>
          {line ? <div className="mt-0.5 text-xs text-ink-400">{t('atLine', { n: line })}</div> : null}
          {repeat ? (
            <>
              <div className="mt-1 text-ink-200">{t('limitLoop', { a: repeat.first + 1, b: repeat.second + 1 })}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {[repeat.first, repeat.second].map((i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onSeek(i)}
                    className="rounded-md border border-ink-600 px-2 py-0.5 text-xs text-ink-200 transition hover:border-brand hover:text-brand"
                    data-action="seek-repeat"
                  >
                    {t('limitJump', { n: i + 1 })}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="mt-1 text-ink-200">{t(next ? 'limitMaybe' : 'limitMax', { n: fmt(limit) })}</div>
              {next && (
                <button
                  type="button"
                  onClick={() => onMore(next)}
                  disabled={busy}
                  className="mt-2 flex items-center gap-1.5 rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-ink-900 transition hover:brightness-110 disabled:opacity-50"
                  data-action="more-steps"
                >
                  {busy ? <Loader2 size={13} className="animate-spin" /> : <ChevronsRight size={13} />}
                  {t('limitMore', { n: fmt(next) })}
                </button>
              )}
            </>
          )}
          <div className="mt-2 text-xs text-ink-400">{t('timeoutNote')}</div>
        </div>
      </div>
    </div>
  );
}
