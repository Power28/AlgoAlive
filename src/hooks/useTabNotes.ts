import { useCallback, useEffect, useRef, useState } from 'react';
import { useL } from '../i18n';
import type { Language, RuntimeStatus } from '../languages/types';
import { initialReview, newId, numberFromTitle, titleWithoutNumber, type Note, type Solution } from '../lib/notes';
import { getExample } from '../tutorials';
import { useNotes } from './useNotes';
import type { Tab } from './useTabs';

interface Options {
  active: Tab;
  language: Language;
  status: RuntimeStatus;
  update: (id: string, patch: Partial<Omit<Tab, 'id'>>) => void;
  add: (tab: Omit<Tab, 'id'>) => string;
  visualize: () => void;
}

/** 筆記視窗打開時要做什麼：編輯從頁籤帶來的草稿，或顯示某一則筆記 */
export type NotesOpen = { draft?: Note; noteId?: string };

/**
 * 頁籤與解題筆記的串接：
 * - 「存成筆記」：用目前頁籤的程式碼與測資建立筆記草稿（從教學範例開的頁籤會帶入題號、題名、難度、主題）；
 *   頁籤已經對應到某則筆記時，改成更新那則筆記裡的這個解法
 * - 存檔後頁籤記住對應的筆記與解法
 * - 從筆記開啟解法：開新頁籤，等執行環境就緒後自動視覺化
 */
export function useTabNotes({ active, language, status, update, add, visualize }: Options) {
  const l = useL();
  const store = useNotes();
  const [open, setOpen] = useState<NotesOpen | null>(null);
  /** 草稿裡代表這個頁籤的解法 id（存檔後寫回頁籤） */
  const draftSolution = useRef<string | null>(null);
  /** 開好、等著自動視覺化的頁籤 */
  const [pendingRun, setPendingRun] = useState<string | null>(null);

  const linked = active.noteId ? store.notes.find((n) => n.id === active.noteId) : undefined;

  const draftFromTab = useCallback((): Note => {
    const now = Date.now();
    const existing = linked?.solutions.find((s) => s.id === active.solutionId);
    const solution: Solution = {
      id: existing?.id ?? newId('s'),
      label: existing?.label ?? language.label,
      language: language.id,
      code: active.code,
      call: active.call,
    };
    draftSolution.current = solution.id;
    if (linked) {
      const solutions = existing ? linked.solutions.map((s) => (s.id === existing.id ? solution : s)) : [...linked.solutions, solution];
      return { ...linked, solutions };
    }
    const found = active.exampleId ? getExample(active.exampleId) : undefined;
    return {
      id: newId('n'),
      number: found?.example.number ?? numberFromTitle(active.title),
      title: found ? l(found.example.title) : titleWithoutNumber(active.title),
      url: '',
      difficulty: found?.example.difficulty ?? null,
      tags: found ? [l(found.tutorial.title)] : [],
      summary: '',
      approach: '',
      time: '',
      space: '',
      status: 'solved',
      solutions: [solution],
      createdAt: now,
      updatedAt: now,
      review: initialReview('solved', now),
    };
  }, [active, language, linked, l]);

  /** 存檔後：頁籤記住對應的筆記與解法；沒有自訂名稱的空白頁籤改用題名 */
  const onDraftSaved = useCallback(
    (note: Note) => {
      const solutionId = note.solutions.some((s) => s.id === draftSolution.current) ? draftSolution.current! : undefined;
      const title = !active.title && !active.exampleId ? `${note.number !== null ? `${note.number}. ` : ''}${note.title}` : active.title;
      update(active.id, { noteId: note.id, solutionId, title });
    },
    [active, update],
  );

  const openSolution = useCallback(
    (note: Note, s: Solution) => {
      const id = add({
        title: `${note.number !== null ? `${note.number}. ` : ''}${note.title}`,
        code: s.code,
        call: s.call,
        language: s.language,
        noteId: note.id,
        solutionId: s.id,
      });
      setOpen(null);
      setPendingRun(id);
    },
    [add],
  );

  // 從筆記開啟的頁籤：切過去、執行環境就緒後自動執行一次
  useEffect(() => {
    if (pendingRun && active.id === pendingRun && status === 'ready') {
      setPendingRun(null);
      visualize();
    }
  }, [pendingRun, active.id, status, visualize]);

  return {
    store,
    open,
    linked,
    /** 從頁籤存成筆記（或更新對應的筆記） */
    saveTab: () => setOpen({ draft: draftFromTab() }),
    openNotes: (noteId?: string) => setOpen({ noteId }),
    close: () => setOpen(null),
    onDraftSaved,
    openSolution,
  };
}
