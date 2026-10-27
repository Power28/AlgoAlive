import { useCallback, useEffect, useRef, useState } from 'react';
import { exportNotes, importNotes, isDue, scheduleReview, sanitizeNote, type ImportResult, type Note, type ReviewResult } from '../lib/notes';

const STORAGE_KEY = 'algoalive.notes.v1';
/** 上次匯出備份的時間（提醒備份用） */
const EXPORTED_KEY = 'algoalive.notes.exported';

function load(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    const now = Date.now();
    return Array.isArray(data) ? data.flatMap((x) => sanitizeNote(x, now) ?? []) : [];
  } catch {
    return [];
  }
}

function readNumber(key: string): number | null {
  try {
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

/**
 * 解題筆記：存在這個瀏覽器的 localStorage，可以匯出 / 匯入 JSON 檔備份或搬到別台電腦。
 * 第一次存筆記時向瀏覽器申請持久儲存，降低空間不足時被自動清掉的機會。
 */
export function useNotes() {
  const [notes, setNotes] = useState<Note[]>(load);
  const [exportedAt, setExportedAt] = useState<number | null>(() => readNumber(EXPORTED_KEY));
  /** 寫入失敗（例如容量滿、私密模式）時提示 */
  const [saveError, setSaveError] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    // 第一次 render 是剛讀出來的資料，不用寫回
    if (first.current) {
      first.current = false;
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
  }, [notes]);

  const persist = useCallback(() => {
    navigator.storage?.persist?.().catch(() => {});
  }, []);

  /** 新增或更新一則筆記（id 相同就取代），更新時間設為現在 */
  const save = useCallback(
    (note: Note) => {
      persist();
      const saved = { ...note, updatedAt: Date.now() };
      setNotes((list) => (list.some((n) => n.id === note.id) ? list.map((n) => (n.id === note.id ? saved : n)) : [...list, saved]));
      return saved;
    },
    [persist],
  );

  const remove = useCallback((id: string) => setNotes((list) => list.filter((n) => n.id !== id)), []);

  /** 記下複習結果並排好下次複習的日子 */
  const review = useCallback((id: string, result: ReviewResult) => {
    const now = Date.now();
    setNotes((list) => list.map((n) => (n.id === id ? { ...n, updatedAt: now, review: scheduleReview(n.review, result, now) } : n)));
  }, []);

  /** 匯出成 JSON 文字，並記下備份時間 */
  const exportJson = useCallback(() => {
    const now = Date.now();
    try {
      localStorage.setItem(EXPORTED_KEY, String(now));
    } catch {
      // 記不住也沒關係，只是之後還會提醒備份
    }
    setExportedAt(now);
    return exportNotes(notes, now);
  }, [notes]);

  /** 匯入並合併；檔案格式不對時丟出錯誤（message 為 not-json / not-notes） */
  const importJson = useCallback(
    (text: string): ImportResult => {
      const result = importNotes(notes, text, Date.now());
      persist();
      setNotes(result.notes);
      return result;
    },
    [notes, persist],
  );

  const now = Date.now();
  const dueCount = notes.filter((n) => isDue(n, now)).length;
  // 有筆記在上次備份之後改過，而且距離上次備份超過一週（或從來沒有備份）
  const lastChange = notes.reduce((m, n) => Math.max(m, n.updatedAt), 0);
  const backupReminder = notes.length > 0 && (!exportedAt || (lastChange > exportedAt && now - exportedAt > 7 * 24 * 60 * 60 * 1000));

  return { notes, save, remove, review, exportJson, importJson, dueCount, exportedAt, backupReminder, saveError };
}
