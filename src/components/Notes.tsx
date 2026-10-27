import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Download, NotebookPen, Search, TriangleAlert, Upload, X } from 'lucide-react';
import { useT } from '../i18n';
import type { useNotes } from '../hooks/useNotes';
import { allTags, dueInDays, filterNotes, initialReview, type Difficulty, type Note, type NoteSort, type NoteStatus, type Solution } from '../lib/notes';
import { NoteEditor } from './NoteEditor';
import { NoteView, StatusBadge, useDueLabel } from './NoteView';
import { DifficultyBadge } from './TutorialView';

interface Props {
  store: ReturnType<typeof useNotes>;
  /** 打開時要編輯的筆記（從頁籤「存成筆記」：新的筆記，或既有筆記加上這個頁籤的程式碼） */
  initialDraft?: Note;
  /** 打開時要顯示的筆記 */
  initialNoteId?: string;
  onClose: () => void;
  /** 儲存了從頁籤帶來的筆記：讓頁籤記住它對應的筆記 */
  onDraftSaved?: (note: Note) => void;
  onOpenSolution: (note: Note, solution: Solution) => void;
}

const SELECT = 'rounded-md border border-ink-600 bg-ink-900 px-1.5 py-1 text-xs text-ink-100 outline-none focus:border-brand';

/** 解題筆記：左側清單（搜尋、篩選、排序、匯出 / 匯入），右側檢視、複習或編輯 */
export function Notes({ store, initialDraft, initialNoteId, onClose, onDraftSaved, onOpenSolution }: Props) {
  const t = useT();
  const dueLabel = useDueLabel();
  const { notes } = store;
  const [query, setQuery] = useState('');
  const [dueOnly, setDueOnly] = useState(() => !initialDraft && !initialNoteId && store.dueCount > 0);
  const [difficulty, setDifficulty] = useState<Difficulty | ''>('');
  const [status, setStatus] = useState<NoteStatus | ''>('');
  const [tag, setTag] = useState('');
  const [sort, setSort] = useState<NoteSort>('due');
  // 桌面版直接選好清單的第一題（有該複習的就是第一個該複習的）；手機版先顯示清單
  const [selectedId, setSelectedId] = useState<string | undefined>(() => {
    if (initialDraft || initialNoteId) return initialDraft?.id ?? initialNoteId;
    if (!window.matchMedia?.('(min-width: 768px)').matches) return undefined;
    return filterNotes(notes, { dueOnly: store.dueCount > 0 }, 'due', Date.now())[0]?.id;
  });
  const [editing, setEditing] = useState<{ note: Note; fromTab: boolean } | null>(initialDraft ? { note: initialDraft, fromTab: true } : null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  // 手機版：選了一則之後只顯示右側
  const [showDetailOnMobile, setShowDetailOnMobile] = useState(!!(initialDraft || initialNoteId));
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !editing && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, editing]);

  const now = Date.now();
  const tags = useMemo(() => allTags(notes), [notes]);
  const list = useMemo(() => filterNotes(notes, { query, dueOnly, difficulty, status, tag }, sort, Date.now()), [notes, query, dueOnly, difficulty, status, tag, sort]);
  const selected = notes.find((n) => n.id === selectedId);

  const select = (id: string) => {
    setSelectedId(id);
    setEditing(null);
    setShowDetailOnMobile(true);
  };

  const exportFile = () => {
    const text = store.exportJson();
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `algoalive-notes-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const importFile = async (file: File) => {
    try {
      const r = store.importJson(await file.text());
      setMessage({ text: t('importDone', { added: r.added, updated: r.updated, kept: r.kept }) + (r.invalid ? t('importInvalid', { n: r.invalid }) : '') });
    } catch (err) {
      setMessage({ text: t((err as Error).message === 'not-json' ? 'importNotJson' : 'importNotNotes'), error: true });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 p-0 backdrop-blur-sm sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && !editing && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={t('notes')}
      data-notes
    >
      <div className="flex w-full max-w-6xl flex-col overflow-hidden border border-ink-700 bg-ink-850 shadow-2xl sm:rounded-xl">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-ink-700 px-4">
          <NotebookPen size={16} className="text-brand" />
          <h2 className="text-sm font-semibold">{t('notes')}</h2>
          <span className="text-xs text-ink-400">· {notes.length}</span>
          <div className="ml-auto flex items-center gap-1">
            <button onClick={exportFile} disabled={!notes.length} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-ink-300 hover:bg-ink-700 hover:text-ink-100 disabled:opacity-40" data-action="export-notes">
              <Download size={13} />
              <span className="hidden sm:inline">{t('exportNotes')}</span>
            </button>
            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-ink-300 hover:bg-ink-700 hover:text-ink-100" data-action="import-notes">
              <Upload size={13} />
              <span className="hidden sm:inline">{t('importNotes')}</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importFile(file);
                e.target.value = '';
              }}
              data-import-input
            />
            <button onClick={onClose} className="rounded-md p-1.5 text-ink-400 hover:bg-ink-700 hover:text-ink-100" title={t('close')}>
              <X size={16} />
            </button>
          </div>
        </header>

        {(message || store.saveError || store.backupReminder) && (
          <div
            className={`flex shrink-0 items-center gap-2 border-b px-4 py-2 text-xs ${
              message?.error || store.saveError ? 'border-err/30 bg-err/10 text-err' : 'border-ink-700 bg-ink-900 text-ink-300'
            }`}
            data-notes-message
          >
            {(message?.error || store.saveError) && <TriangleAlert size={13} className="shrink-0" />}
            <span>
              {message?.text ?? (store.saveError ? t('saveFailed') : t('backupReminder'))}
              {!message && !store.saveError && store.exportedAt && (
                <span className="text-ink-400"> {t('lastBackup', { date: new Date(store.exportedAt).toLocaleDateString() })}</span>
              )}
            </span>
            {message && (
              <button onClick={() => setMessage(null)} className="ml-auto rounded p-0.5 hover:bg-ink-700" title={t('close')}>
                <X size={12} />
              </button>
            )}
          </div>
        )}

        <div className="flex min-h-0 flex-1">
          {/* 左：清單 */}
          <aside className={`${showDetailOnMobile ? 'hidden md:flex' : 'flex'} w-full shrink-0 flex-col border-r border-ink-700 md:w-80`}>
            <div className="flex flex-col gap-2 border-b border-ink-700 p-3">
              <label className="flex items-center gap-2 rounded-md border border-ink-600 bg-ink-900 px-2.5 py-1.5 focus-within:border-brand">
                <Search size={14} className="shrink-0 text-ink-400" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('notesSearch')} className="min-w-0 flex-1 bg-transparent text-sm outline-none" data-notes-search />
              </label>
              <div className="flex gap-1">
                <FilterChip active={!dueOnly} onClick={() => setDueOnly(false)}>
                  {t('filterAll')}
                </FilterChip>
                <FilterChip active={dueOnly} onClick={() => setDueOnly(true)} data-filter="due">
                  {t('filterDue')}
                  {store.dueCount > 0 && <span className="rounded-full bg-brand px-1.5 text-[10px] font-bold text-ink-950">{store.dueCount}</span>}
                </FilterChip>
              </div>
              <div className="flex flex-wrap gap-1">
                <select className={SELECT} value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty | '')} aria-label={t('fieldDifficulty')}>
                  <option value="">{t('anyDifficulty')}</option>
                  <option value="easy">{t('easy')}</option>
                  <option value="medium">{t('medium')}</option>
                  <option value="hard">{t('hard')}</option>
                </select>
                <select className={SELECT} value={status} onChange={(e) => setStatus(e.target.value as NoteStatus | '')} aria-label={t('fieldStatus')}>
                  <option value="">{t('anyStatus')}</option>
                  <option value="solved">{t('statusSolved')}</option>
                  <option value="hint">{t('statusHint')}</option>
                  <option value="stuck">{t('statusStuck')}</option>
                </select>
                {tags.length > 0 && (
                  <select className={SELECT} value={tag} onChange={(e) => setTag(e.target.value)} aria-label={t('fieldTags')}>
                    <option value="">{t('anyTag')}</option>
                    {tags.map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                )}
                <select className={SELECT} value={sort} onChange={(e) => setSort(e.target.value as NoteSort)} aria-label="sort">
                  <option value="due">{t('sortDue')}</option>
                  <option value="updated">{t('sortUpdated')}</option>
                  <option value="number">{t('sortNumber')}</option>
                </select>
              </div>
            </div>
            <ul className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-2" data-notes-list>
              {!notes.length && <li className="px-2 py-6 text-center text-sm text-ink-400">{t('notesEmpty')}</li>}
              {notes.length > 0 && !list.length && <li className="px-2 py-6 text-center text-sm text-ink-400">{t('notesNoMatch')}</li>}
              {list.map((n) => {
                const days = dueInDays(n, now);
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => select(n.id)}
                      className={`flex w-full flex-col gap-1 rounded-md px-2.5 py-2 text-left transition ${n.id === selectedId ? 'bg-ink-700' : 'hover:bg-ink-800'}`}
                      data-note-item={n.id}
                    >
                      <span className="truncate text-sm text-ink-100">
                        {n.number !== null && <span className="text-ink-400">{n.number}. </span>}
                        {n.title}
                      </span>
                      <span className="flex flex-wrap items-center gap-1.5">
                        {n.difficulty && <DifficultyBadge d={n.difficulty} />}
                        <StatusBadge status={n.status} />
                        <span className={`ml-auto text-[11px] ${days <= 0 ? 'font-semibold text-brand' : 'text-ink-400'}`}>{dueLabel(n)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          {/* 右：檢視 / 編輯 */}
          <div className={`${showDetailOnMobile ? 'flex' : 'hidden md:flex'} min-w-0 flex-1 flex-col`}>
            <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <button
                onClick={() => {
                  setShowDetailOnMobile(false);
                  if (editing && !editing.fromTab) setEditing(null);
                }}
                className="mb-3 flex items-center gap-1 text-xs text-ink-400 hover:text-ink-100 md:hidden"
              >
                <ArrowLeft size={12} />
                {t('notesBack')}
              </button>
              {editing ? (
                <NoteEditor
                  key={editing.note.id}
                  note={editing.note}
                  onCancel={() => {
                    setEditing(null);
                    if (!notes.some((n) => n.id === editing.note.id)) setShowDetailOnMobile(false);
                  }}
                  onSave={(note) => {
                    // 新的筆記：依這次解得怎樣排第一次複習（自己解出 → 3 天後；其他 → 明天）
                    const isNew = !notes.some((n) => n.id === note.id);
                    const saved = store.save(isNew ? { ...note, review: initialReview(note.status, Date.now()) } : note);
                    if (editing.fromTab) onDraftSaved?.(saved);
                    setEditing(null);
                    setSelectedId(saved.id);
                  }}
                />
              ) : selected ? (
                <NoteView
                  note={selected}
                  onEdit={() => setEditing({ note: selected, fromTab: false })}
                  onDelete={() => {
                    store.remove(selected.id);
                    setSelectedId(undefined);
                    setShowDetailOnMobile(false);
                  }}
                  onReview={(result) => store.review(selected.id, result)}
                  onOpenSolution={(s) => onOpenSolution(selected, s)}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-ink-400">
                  <NotebookPen size={28} className="text-ink-600" />
                  <p className="max-w-sm">{notes.length ? t('notesPick') : t('notesEmpty')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children, ...rest }: { active: boolean; onClick: () => void; children: React.ReactNode; 'data-filter'?: string }) {
  return (
    <button
      onClick={onClick}
      {...rest}
      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${active ? 'bg-ink-700 text-ink-100' : 'text-ink-400 hover:text-ink-100'}`}
    >
      {children}
    </button>
  );
}
