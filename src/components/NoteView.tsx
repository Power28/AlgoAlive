import { useEffect, useState } from 'react';
import { Eye, EyeOff, ExternalLink, Pencil, Play, Trash2 } from 'lucide-react';
import { useT } from '../i18n';
import { getLanguage } from '../languages';
import { dueInDays, type Note, type ReviewResult, type Solution } from '../lib/notes';
import { Markdown } from './Markdown';
import { DifficultyBadge } from './TutorialView';

interface Props {
  note: Note;
  onEdit: () => void;
  onDelete: () => void;
  onReview: (result: ReviewResult) => void;
  onOpenSolution: (solution: Solution) => void;
}

/** 「還有幾天複習」的文字 */
export function useDueLabel() {
  const t = useT();
  return (note: Note) => {
    const days = dueInDays(note, Date.now());
    if (days < 0) return t('overdue', { n: -days });
    if (days === 0) return t('dueToday');
    if (days === 1) return t('dueTomorrow');
    return t('dueIn', { n: days });
  };
}

const STATUS_STYLE = { solved: 'text-ok bg-ok/10', hint: 'text-brand bg-brand/10', stuck: 'text-err bg-err/10' } as const;
const STATUS_KEY = { solved: 'statusSolved', hint: 'statusHint', stuck: 'statusStuck' } as const;

export function StatusBadge({ status }: { status: Note['status'] }) {
  const t = useT();
  return <span className={`rounded px-1.5 py-px text-[10px] font-semibold ${STATUS_STYLE[status]}`}>{t(STATUS_KEY[status])}</span>;
}

/**
 * 一則筆記：先只顯示題目重點；思路與解法收起來，先自己想一遍再打開對照。
 * 打開後可以記下這次複習的結果（很順 / 有點卡 / 不會），排好下次複習的日子。
 */
export function NoteView({ note, onEdit, onDelete, onReview, onOpenSolution }: Props) {
  const t = useT();
  const dueLabel = useDueLabel();
  const [revealed, setRevealed] = useState(false);
  const [reviewed, setReviewed] = useState(false);

  // 換到另一則筆記時重新收起來
  useEffect(() => {
    setRevealed(false);
    setReviewed(false);
  }, [note.id]);

  const days = dueInDays(note, Date.now());
  return (
    <article className="flex flex-col gap-5" data-note-view={note.id}>
      <header className="flex flex-col gap-2">
        <h3 className="text-lg font-bold text-ink-100" data-note-title>
          {note.number !== null && <span className="text-ink-400">{note.number}. </span>}
          {note.title}
        </h3>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {note.difficulty && <DifficultyBadge d={note.difficulty} />}
          <StatusBadge status={note.status} />
          {note.tags.map((tag) => (
            <span key={tag} className="rounded bg-ink-700 px-1.5 py-px text-[10px] text-ink-300">
              {tag}
            </span>
          ))}
          <span className={`ml-auto ${days <= 0 ? 'font-semibold text-brand' : 'text-ink-400'}`} data-note-due>
            {dueLabel(note)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {note.url && (
            <a href={note.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-brand hover:bg-brand/10">
              <ExternalLink size={12} />
              {t('openOnLeetCode')}
            </a>
          )}
          <span className="text-[11px] text-ink-400">{t('reviewedTimes', { n: note.review.history.length })}</span>
          <button onClick={onEdit} className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-xs text-ink-300 hover:bg-ink-700 hover:text-ink-100" data-action="edit-note">
            <Pencil size={12} />
            {t('editNote')}
          </button>
          <button
            onClick={() => window.confirm(t('deleteNoteConfirm', { title: note.title })) && onDelete()}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-ink-400 hover:bg-err/10 hover:text-err"
            data-action="delete-note"
          >
            <Trash2 size={12} />
            {t('deleteNote')}
          </button>
        </div>
      </header>

      {note.summary.trim() && (
        <Section title={t('noteSummary')}>
          <Markdown text={note.summary} />
        </Section>
      )}

      {!revealed ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-ink-600 px-4 py-6 text-center">
          <p className="text-xs text-ink-400">{t('revealHint')}</p>
          <button
            onClick={() => setRevealed(true)}
            className="flex items-center gap-1.5 rounded-md bg-brand/15 px-3 py-1.5 text-sm font-semibold text-brand hover:bg-brand/25"
            data-action="reveal-note"
          >
            <Eye size={14} />
            {t('revealThoughts')}
          </button>
        </div>
      ) : (
        <>
          <div className="-mb-3 flex justify-end">
            <button onClick={() => setRevealed(false)} className="flex items-center gap-1 text-xs text-ink-400 hover:text-ink-100">
              <EyeOff size={12} />
              {t('hideThoughts')}
            </button>
          </div>
          {note.approach.trim() && (
            <Section title={t('noteApproach')}>
              <Markdown text={note.approach} />
            </Section>
          )}
          {(note.time || note.space) && (
            <Section title={t('noteComplexity')}>
              <div className="flex gap-4 font-mono text-sm text-ink-100">
                {note.time && <span>{t('noteTime')} {note.time}</span>}
                {note.space && <span>{t('noteSpace')} {note.space}</span>}
              </div>
            </Section>
          )}
          {note.solutions.length > 0 && (
            <Section title={t('noteSolutions')}>
              <ul className="flex flex-col gap-3">
                {note.solutions.map((s) => (
                  <li key={s.id} className="overflow-hidden rounded-md border border-ink-700">
                    <div className="flex items-center gap-2 border-b border-ink-700 bg-ink-900 px-2.5 py-1.5">
                      <span className="rounded bg-ink-700 px-1.5 py-px font-mono text-[10px] text-ink-300">{getLanguage(s.language).label}</span>
                      <span className="truncate text-xs text-ink-100">{s.label}</span>
                      <button
                        onClick={() => onOpenSolution(s)}
                        className="ml-auto flex shrink-0 items-center gap-1 rounded-md bg-ok px-2 py-1 text-xs font-semibold text-white hover:brightness-110"
                        data-action="open-solution"
                      >
                        <Play size={11} fill="currentColor" />
                        {t('openSolution')}
                      </button>
                    </div>
                    <pre className="scrollbar-thin max-h-72 overflow-auto bg-ink-950 px-3 py-2 font-mono text-xs text-ink-100">{s.code}</pre>
                    {s.call && <div className="border-t border-ink-700 bg-ink-900 px-3 py-1 font-mono text-[11px] text-ink-400">{s.call}</div>}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <div className="flex flex-col items-center gap-2 rounded-lg border border-ink-700 bg-ink-900/60 px-4 py-3" data-review>
            {reviewed ? (
              <p className="text-sm text-ok" data-review-saved>
                {t('reviewSaved', { when: dueLabel(note) })}
              </p>
            ) : (
              <>
                <p className="text-xs text-ink-300">{t('reviewPrompt')}</p>
                <div className="flex gap-2">
                  {(
                    [
                      ['easy', 'reviewEasy', 'bg-ok/15 text-ok hover:bg-ok/25'],
                      ['ok', 'reviewOk', 'bg-brand/15 text-brand hover:bg-brand/25'],
                      ['again', 'reviewAgain', 'bg-err/15 text-err hover:bg-err/25'],
                    ] as const
                  ).map(([result, label, style]) => (
                    <button
                      key={result}
                      onClick={() => {
                        onReview(result);
                        setReviewed(true);
                      }}
                      className={`rounded-md px-3 py-1.5 text-sm font-semibold ${style}`}
                      data-review-result={result}
                    >
                      {t(label)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h4 className="text-[11px] font-semibold tracking-wide text-ink-400 uppercase">{title}</h4>
      {children}
    </section>
  );
}
