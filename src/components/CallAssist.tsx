import { useMemo, useState } from 'react';
import { CircleHelp, Lightbulb, Wand2, Wrench } from 'lucide-react';
import type { CallHint, CallInfo } from '../types';
import { callNeedsHelp, exampleCall, findFunctions } from '../lib/callSuggest';
import { useT } from '../i18n';

const KIND_KEY = { ListNode: 'convListNode', TreeNode: 'convTreeNode', Node: 'convGraph' } as const;

/** 測試呼叫下方：解讀結果、對不上程式碼時的範例建議、格式說明 */
export function CallAssist({ code, call, info, hasFix, onFill }: {
  code: string;
  call: string;
  /** 最近一次執行如何解讀測試呼叫（測資沒改過時才傳入） */
  info?: CallInfo;
  /** 右邊的錯誤說明已經提供一鍵修正：不再另外建議範例，避免兩種改法混在一起 */
  hasFix?: boolean;
  onFill: (call: string) => void;
}) {
  const t = useT();
  const [help, setHelp] = useState(false);
  const funcs = useMemo(() => findFunctions(code), [code]);
  const suggestions = !hasFix && callNeedsHelp(call, funcs, code) ? funcs.slice(0, 2).map(exampleCall) : [];

  return (
    <div className="mt-1.5 grid gap-1.5 text-xs">
      {info && (info.inferred || info.conversions.length > 0) && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-ink-400" data-call-info>
          <Wand2 size={12} className="shrink-0 text-brand" />
          <span>{t('callInterpreted')}</span>
          <code className="rounded bg-ink-900 px-1.5 py-px font-mono text-ink-200">{info.display}</code>
          {info.conversions.map((c) => (
            <span key={c.param} className="rounded bg-brand/15 px-1.5 py-px text-brand">
              {t('convNote', { param: c.param, kind: t(KIND_KEY[c.to]) })}
            </span>
          ))}
        </div>
      )}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" data-call-suggest>
          <Lightbulb size={12} className="shrink-0 text-brand" />
          <span className="text-ink-400">{t(call.trim() ? 'callMismatch' : 'callEmpty')}</span>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onFill(s)}
              className="rounded border border-brand/40 bg-brand/10 px-1.5 py-0.5 font-mono text-brand transition hover:bg-brand/20"
              title={t('fillHint')}
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <div>
        <button type="button" onClick={() => setHelp((h) => !h)} className="flex items-center gap-1 text-ink-400 transition hover:text-ink-200" data-call-help-toggle>
          <CircleHelp size={12} />
          {t('callFormats')}
        </button>
        {help && (
          <ul className="mt-1.5 grid gap-1 rounded-md border border-ink-700 bg-ink-900 p-2.5 text-ink-300" data-call-help>
            <li>
              <code className="text-ink-100">twoSum([2, 7, 11, 15], 9)</code> — {t('fmtCall')}
            </li>
            <li>
              <code className="text-ink-100">nums = [2,7,11,15], target = 9</code> — {t('fmtLeetCode')}
            </li>
            <li>
              <code className="text-ink-100">[2,7,11,15]</code> ⏎ <code className="text-ink-100">9</code> — {t('fmtLines')}
            </li>
            <li>
              <code className="text-ink-100">head = [1,2,3]</code>、<code className="text-ink-100">root = [3,9,20,null,null,15,7]</code> — {t('fmtNodes')}
            </li>
            <li>
              <code className="text-ink-100">["MinStack","push"], [[],[1]]</code> — {t('fmtDesign')}
            </li>
          </ul>
        )}
      </div>
    </div>
  );
}

/** 測試呼叫寫錯時的說明：用使用者的語言說清楚哪裡不對，能自動修正時提供按鈕 */
export function CallHintBox({ hint, onFix }: { hint: CallHint; onFix: (call: string) => void }) {
  const t = useT();
  let text: string;
  switch (hint.kind) {
    case 'empty':
      text = t('hintEmpty');
      break;
    case 'name':
      text = hint.suggest ? t('hintNameSuggest', { got: hint.got, suggest: hint.suggest }) : t('hintName', { got: hint.got, funcs: hint.funcs.join('、') || '—' });
      break;
    case 'noSolution':
      text = t('hintNoSolution', { got: hint.got });
      break;
    case 'noFunction':
      text = t('hintNoFunction');
      break;
    case 'args':
      text = t('hintArgs', { func: hint.func, params: hint.params.join(', ') }) + ' ' +
        (typeof hint.got === 'number' ? t('hintGotCount', { n: hint.got }) : t('hintGotNames', { names: hint.got.join(', ') }));
      break;
  }
  const fix = 'fix' in hint ? hint.fix : undefined;
  return (
    <div data-error data-call-hint={hint.kind} className="mb-5 rounded-lg border border-brand/40 bg-brand/10 px-3 py-2.5 text-sm">
      <div className="flex items-start gap-2">
        <Wrench size={16} className="mt-0.5 shrink-0 text-brand" />
        <div className="min-w-0">
          <div className="font-semibold text-brand">{t('hintTitle')}</div>
          <div className="mt-0.5 text-ink-200">{text}</div>
          {fix && (
            <button
              type="button"
              onClick={() => onFix(fix)}
              className="mt-2 flex items-center gap-1.5 rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-ink-900 transition hover:brightness-110"
              data-action="apply-fix"
            >
              <Wand2 size={13} />
              {t('hintFix', { fix })}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
