import { useEffect, useState, type ReactNode } from 'react';
import { useT } from '../i18n';
import { useVarJump } from '../lib/stepSearch';

/**
 * 變數名稱：在主畫面中可以點，跳到這個變數下一次改變的步驟（Shift + 點：上一次）。
 * 不是變數（例如「鏈結串列」標題）或從來沒有改變過時，維持純文字。
 */
export function VarName({ name, className, children }: { name: string; className?: string; children?: ReactNode }) {
  const t = useT();
  const jump = useVarJump();
  const [changes, setChanges] = useState<number[] | null>(() => jump?.cached(name) ?? null);
  // 長的執行中，指向節點的變數要比較每一步走得到的節點，可能要算上百毫秒：
  // 先畫出畫面，下一個空檔再算（每個變數整段執行只算一次）
  useEffect(() => {
    if (!jump) return;
    const cached = jump.cached(name);
    setChanges(cached ?? null);
    if (cached) return;
    const id = window.setTimeout(() => setChanges(jump.changes(name)), 0);
    return () => window.clearTimeout(id);
  }, [jump, name]);

  if (!jump || !changes || changes.length < 2) return <span className={className}>{children ?? name}</span>;
  return (
    <button
      type="button"
      className={`${className ?? ''} cursor-pointer underline decoration-ink-400 decoration-dotted underline-offset-4 transition hover:text-brand hover:decoration-brand`}
      title={t('varJumpHint', { name, n: changes.length })}
      onClick={(e) => {
        jump.jump(name, e.shiftKey ? -1 : 1);
        // 讓方向鍵繼續控制播放
        e.currentTarget.blur();
      }}
      data-var-jump={name}
    >
      {children ?? name}
    </button>
  );
}
