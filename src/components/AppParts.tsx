import type { ReactNode } from 'react';
import { Loader2, RefreshCw, TriangleAlert, Zap } from 'lucide-react';
import { useT } from '../i18n';
import type { RuntimeStatus } from '../languages/types';

/** 主畫面用的小元件：左側模式切換、事件標籤、執行環境狀態、錯誤框、空白狀態、更新提示 */

export function ModeButton({
  active,
  onClick,
  icon,
  children,
  ...rest
}: { active: boolean; onClick: () => void; icon: ReactNode; children: ReactNode; 'data-action'?: string }) {
  return (
    <button
      onClick={onClick}
      {...rest}
      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold tracking-wide uppercase transition ${
        active ? 'bg-ink-700 text-ink-100' : 'text-ink-400 hover:text-ink-100'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

export function EventChip({ event }: { event: 'line' | 'return' | 'exception' }) {
  const t = useT();
  const map = {
    line: [t('nextToRun'), 'bg-ink-700 text-ink-300'],
    return: [t('eventReturn'), 'bg-ok/20 text-ok'],
    exception: [t('eventException'), 'bg-err/20 text-err'],
  } as const;
  const [label, cls] = map[event];
  return <span className={`rounded px-1.5 py-px ${cls}`}>{label}</span>;
}

export function RuntimeBadge({ status, detail, name }: { status: RuntimeStatus; detail?: string; name: string }) {
  const t = useT();
  const lang = { lang: name };
  if (status === 'loading')
    return (
      <span className="flex items-center gap-1.5 text-xs text-ink-400">
        <Loader2 size={14} className="animate-spin" /> <span className="hidden md:inline">{t('runtimeLoading', lang)}</span>
      </span>
    );
  if (status === 'error')
    return (
      <span className="flex items-center gap-1.5 text-xs text-err" title={detail}>
        <TriangleAlert size={14} /> <span className="hidden md:inline">{t('runtimeFailed', lang)}</span>
      </span>
    );
  return (
    <span className="flex items-center gap-1.5 text-xs text-ok" data-runtime="ready" title={t('runtimeReady', lang)}>
      <Zap size={14} /> <span className="hidden md:inline">{t('runtimeReady', lang)}</span>
    </span>
  );
}

export function ErrorBox({ message, line }: { message: string; line?: number | null }) {
  const t = useT();
  return (
    <div data-error className="mb-5 flex items-start gap-2 rounded-lg border border-err/40 bg-err/10 px-3 py-2 text-sm text-err">
      <TriangleAlert size={16} className="mt-0.5 shrink-0" />
      <div>
        <div className="font-mono">{message}</div>
        {line ? <div className="mt-0.5 text-xs text-err/80">{t('atLine', { n: line })}</div> : null}
      </div>
    </div>
  );
}

export function EmptyState({ status, name }: { status: RuntimeStatus; name: string }) {
  const t = useT();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-ink-400">
      <div className="flex gap-2">
        {[3, 8, 11, 2].map((n, i) => (
          <div
            key={i}
            className={`flex size-11 items-center justify-center rounded-md border font-mono text-sm ${
              i === 0 || i === 3 ? 'border-brand/60 text-ink-100' : 'border-ink-600'
            }`}
          >
            {n}
          </div>
        ))}
      </div>
      <p className="max-w-sm text-sm">{t(status === 'loading' ? 'emptyLoading' : 'emptyIdle', { lang: name })}</p>
    </div>
  );
}

/** 新版本已在背景下載好：按下更新才切換（重新整理頁面） */
export function UpdateToast({ onUpdate }: { onUpdate: () => void }) {
  const t = useT();
  return (
    <div className="fixed right-4 bottom-4 z-40 flex items-center gap-3 rounded-lg border border-brand/40 bg-ink-850 px-4 py-3 text-sm shadow-2xl" role="status" data-update-ready>
      <RefreshCw size={16} className="shrink-0 text-brand" />
      <span className="text-ink-100">{t('updateReady')}</span>
      <button onClick={onUpdate} className="rounded-md bg-brand px-3 py-1 text-xs font-semibold text-ink-950 transition hover:brightness-110" data-action="update">
        {t('updateNow')}
      </button>
    </div>
  );
}
