import { useState, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import { useT } from '../i18n';
import { getLanguage } from '../languages';
import { numberFromTitle, parseTags, safeUrl, titleWithoutNumber, type Difficulty, type Note, type NoteStatus } from '../lib/notes';
import { Markdown } from './Markdown';

interface Props {
  note: Note;
  onSave: (note: Note) => void;
  onCancel: () => void;
}

const INPUT = 'w-full rounded-md border border-ink-600 bg-ink-900 px-2.5 py-1.5 text-sm text-ink-100 outline-none focus:border-brand';

/** 編輯一則筆記（新的或既有的）；按「儲存」才寫回 */
export function NoteEditor({ note, onSave, onCancel }: Props) {
  const t = useT();
  const [draft, setDraft] = useState(note);
  const [tags, setTags] = useState(note.tags.join(', '));
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<Note>) => setDraft((d) => ({ ...d, ...patch }));

  const submit = () => {
    const raw = draft.title.trim();
    if (!raw) {
      setError(t('titleRequired'));
      return;
    }
    // 題名開頭寫了題號（「167. Two Sum II」）而題號欄是空的：拆開存
    const number = draft.number ?? numberFromTitle(raw);
    const title = number !== null && numberFromTitle(raw) === number ? titleWithoutNumber(raw) || raw : raw;
    onSave({ ...draft, number, title, url: safeUrl(draft.url), tags: parseTags(tags) });
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      data-note-editor
    >
      <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3">
        <Field label={t('fieldNumber')}>
          <input
            className={INPUT}
            inputMode="numeric"
            value={draft.number ?? ''}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 5);
              set({ number: v ? Number(v) : null });
            }}
            data-field="number"
          />
        </Field>
        <Field label={t('fieldTitle')} error={error}>
          <input
            className={INPUT}
            value={draft.title}
            onChange={(e) => {
              set({ title: e.target.value });
              setError(null);
            }}
            autoFocus={!note.title}
            data-field="title"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label={t('fieldDifficulty')}>
          <select className={INPUT} value={draft.difficulty ?? ''} onChange={(e) => set({ difficulty: (e.target.value || null) as Difficulty | null })} data-field="difficulty">
            <option value="">—</option>
            {(['easy', 'medium', 'hard'] as const).map((d) => (
              <option key={d} value={d}>
                {t(d)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('fieldStatus')}>
          <select className={INPUT} value={draft.status} onChange={(e) => set({ status: e.target.value as NoteStatus })} data-field="status">
            <option value="solved">{t('statusSolved')}</option>
            <option value="hint">{t('statusHint')}</option>
            <option value="stuck">{t('statusStuck')}</option>
          </select>
        </Field>
        <Field label={t('fieldUrl')}>
          <input className={INPUT} value={draft.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://leetcode.com/problems/…" data-field="url" />
        </Field>
      </div>

      <Field label={t('fieldTags')} hint={t('fieldTagsHint')}>
        <input className={INPUT} value={tags} onChange={(e) => setTags(e.target.value)} data-field="tags" />
      </Field>

      <Field label={t('noteSummary')} hint={t('fieldSummaryHint')}>
        <textarea className={`${INPUT} min-h-20 resize-y`} value={draft.summary} onChange={(e) => set({ summary: e.target.value })} data-field="summary" />
      </Field>

      <Field
        label={t('noteApproach')}
        hint={t('fieldApproachHint')}
        action={
          <button type="button" className="text-xs text-brand hover:underline" onClick={() => setPreview((p) => !p)}>
            {preview ? t('fieldWrite') : t('fieldPreview')}
          </button>
        }
      >
        {preview ? (
          <div className="min-h-32 rounded-md border border-ink-700 bg-ink-900/60 px-3 py-2">
            <Markdown text={draft.approach} />
          </div>
        ) : (
          <textarea
            className={`${INPUT} min-h-32 resize-y font-mono text-[13px]`}
            value={draft.approach}
            onChange={(e) => set({ approach: e.target.value })}
            data-field="approach"
          />
        )}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={`${t('noteComplexity')} · ${t('noteTime')}`}>
          <input className={`${INPUT} font-mono`} value={draft.time} onChange={(e) => set({ time: e.target.value })} placeholder="O(n)" data-field="time" />
        </Field>
        <Field label={`${t('noteComplexity')} · ${t('noteSpace')}`}>
          <input className={`${INPUT} font-mono`} value={draft.space} onChange={(e) => set({ space: e.target.value })} placeholder="O(1)" data-field="space" />
        </Field>
      </div>

      <Field label={t('noteSolutions')} group>
        {draft.solutions.length === 0 ? (
          <p className="text-xs text-ink-400">{t('noSolutions')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {draft.solutions.map((s) => (
              <li key={s.id} className="rounded-md border border-ink-700 bg-ink-900/60 p-2">
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="rounded bg-ink-700 px-1.5 py-px font-mono text-[10px] text-ink-300">{getLanguage(s.language).label}</span>
                  <input
                    className={`${INPUT} py-1 text-xs`}
                    value={s.label}
                    aria-label={t('solutionLabel')}
                    placeholder={t('solutionLabel')}
                    onChange={(e) => set({ solutions: draft.solutions.map((x) => (x.id === s.id ? { ...x, label: e.target.value } : x)) })}
                  />
                  <button
                    type="button"
                    className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-ink-400 hover:bg-err/10 hover:text-err"
                    onClick={() => set({ solutions: draft.solutions.filter((x) => x.id !== s.id) })}
                  >
                    <Trash2 size={12} />
                    {t('removeSolution')}
                  </button>
                </div>
                <pre className="scrollbar-thin max-h-40 overflow-auto rounded bg-ink-950 px-2 py-1.5 font-mono text-[11px] text-ink-300">{s.code}</pre>
              </li>
            ))}
          </ul>
        )}
      </Field>

      <div className="flex justify-end gap-2 border-t border-ink-700 pt-3">
        <button type="button" onClick={onCancel} className="rounded-md px-3 py-1.5 text-sm text-ink-300 hover:bg-ink-700">
          {t('cancel')}
        </button>
        <button type="submit" className="rounded-md bg-brand px-4 py-1.5 text-sm font-semibold text-ink-950 hover:brightness-110" data-action="save-note">
          {t('saveNote')}
        </button>
      </div>
    </form>
  );
}

/** 表單欄位；group：裡面有多個輸入框或按鈕（不能包在 <label> 裡） */
function Field({ label, hint, error, action, group, children }: { label: string; hint?: string; error?: string | null; action?: ReactNode; group?: boolean; children: ReactNode }) {
  const Tag = group ? 'div' : 'label';
  return (
    <Tag className="flex flex-col gap-1">
      <span className="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-ink-400 uppercase">
        {label}
        {action && <span className="ml-auto normal-case">{action}</span>}
      </span>
      {children}
      {hint && <span className="text-[11px] text-ink-400">{hint}</span>}
      {error && <span className="text-xs text-err">{error}</span>}
    </Tag>
  );
}
