// 解題筆記的資料與邏輯（不碰畫面、不 import 其他模組，讓 Node 可以直接執行這個檔案做測試）：
// 筆記格式、間隔重複的複習排程、匯出 / 匯入（含格式檢查與合併）、搜尋與篩選。
import type { LanguageId } from '../languages/types';

export type Difficulty = 'easy' | 'medium' | 'hard';
/** 這題當時解得怎樣：自己解出 / 看了提示或題解 / 還不會 */
export type NoteStatus = 'solved' | 'hint' | 'stuck';
/** 複習後的自我評估：很順 / 有點卡 / 不會 */
export type ReviewResult = 'easy' | 'ok' | 'again';

/** 一個解法：從頁籤存下的程式碼與測資（一題可以有多個，例如暴力法與最佳解、Python 與 JavaScript） */
export interface Solution {
  id: string;
  label: string;
  language: LanguageId;
  code: string;
  call: string;
}

export interface Review {
  /** 下次該複習的日子（當地時間那天 00:00 的時間戳） */
  due: number;
  /** 目前在 INTERVALS 的第幾階 */
  level: number;
  history: { at: number; result: ReviewResult }[];
}

export interface Note {
  id: string;
  /** LeetCode 題號（沒有就是 null） */
  number: number | null;
  title: string;
  url: string;
  difficulty: Difficulty | null;
  tags: string[];
  /** 題目重點：用自己的話寫 */
  summary: string;
  /** 我的思路（Markdown） */
  approach: string;
  time: string;
  space: string;
  status: NoteStatus;
  solutions: Solution[];
  createdAt: number;
  updatedAt: number;
  review: Review;
}

/** 複習間隔（天）：很順往上一階、有點卡留在同一階、不會回到第一階 */
export const INTERVALS = [1, 3, 7, 14, 30, 60, 120];
const DAY = 24 * 60 * 60 * 1000;

/** 當地時間那天的 00:00 */
export function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** 從 day 那天往後 n 天（用日曆日計算，不受夏令時間影響） */
function addDays(day: number, n: number): number {
  const d = new Date(day);
  d.setDate(d.getDate() + n);
  return startOfDay(d.getTime());
}

/** 第一次存成筆記時的複習階：自己解出 → 3 天後；看了提示或還不會 → 明天 */
export function initialReview(status: NoteStatus, now: number): Review {
  const level = status === 'solved' ? 1 : 0;
  return { due: addDays(startOfDay(now), INTERVALS[level]), level, history: [] };
}

/** 記下一次複習的結果，排好下次複習的日子 */
export function scheduleReview(review: Review, result: ReviewResult, now: number): Review {
  const level = result === 'again' ? 0 : result === 'easy' ? Math.min(review.level + 1, INTERVALS.length - 1) : review.level;
  return { due: addDays(startOfDay(now), INTERVALS[level]), level, history: [...review.history, { at: now, result }] };
}

/** 距離該複習還有幾天（今天 0、明天 1、已經過期為負數） */
export function dueInDays(note: Note, now: number): number {
  return Math.round((startOfDay(note.review.due) - startOfDay(now)) / DAY);
}

export const isDue = (note: Note, now: number) => dueInDays(note, now) <= 0;

export const newId = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** 題名開頭的題號：「167. Two Sum II」→ 167 */
export function numberFromTitle(title: string): number | null {
  const m = title.trim().match(/^(\d{1,5})\s*[.、:：]/);
  return m ? Number(m[1]) : null;
}

/** 清掉題名開頭的題號（題號另外存） */
export const titleWithoutNumber = (title: string) => title.trim().replace(/^\d{1,5}\s*[.、:：]\s*/, '');

/** 標籤：逗號或頓號分隔，去掉空白與重複 */
export function parseTags(text: string): string[] {
  return [...new Set(text.split(/[,，、]/).map((s) => s.trim()).filter(Boolean))].slice(0, MAX.tags);
}

/** 只接受 http(s) 連結（顯示成超連結時才安全） */
export function safeUrl(url: string): string {
  const u = url.trim();
  return /^https?:\/\/[^\s]+$/i.test(u) ? u : '';
}

// ─────────────── 搜尋與篩選 ───────────────

export interface NoteFilter {
  query?: string;
  dueOnly?: boolean;
  difficulty?: Difficulty | '';
  status?: NoteStatus | '';
  tag?: string;
}

export type NoteSort = 'due' | 'updated' | 'number';

export function filterNotes(notes: Note[], filter: NoteFilter, sort: NoteSort, now: number): Note[] {
  const q = (filter.query ?? '').trim().toLowerCase();
  const out = notes.filter((n) => {
    if (filter.dueOnly && !isDue(n, now)) return false;
    if (filter.difficulty && n.difficulty !== filter.difficulty) return false;
    if (filter.status && n.status !== filter.status) return false;
    if (filter.tag && !n.tags.includes(filter.tag)) return false;
    if (!q) return true;
    const hay = [n.number ?? '', n.title, n.tags.join(' '), n.summary, n.approach].join(' ').toLowerCase();
    return q.split(/\s+/).every((word) => hay.includes(word));
  });
  const byNumber = (a: Note, b: Note) => (a.number ?? Infinity) - (b.number ?? Infinity) || a.title.localeCompare(b.title);
  return out.sort((a, b) =>
    sort === 'due' ? a.review.due - b.review.due || byNumber(a, b) : sort === 'updated' ? b.updatedAt - a.updatedAt : byNumber(a, b),
  );
}

/** 所有筆記用到的標籤（依使用次數排序） */
export function allTags(notes: Note[]): string[] {
  const count = new Map<string, number>();
  for (const n of notes) for (const t of n.tags) count.set(t, (count.get(t) ?? 0) + 1);
  return [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
}

// ─────────────── 匯出 / 匯入 ───────────────

const FILE_KIND = 'algoalive-notes';
const FILE_VERSION = 1;

/** 每個欄位的長度上限：匯入別人的檔案時避免塞爆瀏覽器的儲存空間 */
export const MAX = { notes: 2000, text: 20_000, title: 200, code: 100_000, solutions: 20, tags: 20, tag: 40, history: 500 };

export function exportNotes(notes: Note[], now: number): string {
  return JSON.stringify({ kind: FILE_KIND, version: FILE_VERSION, exportedAt: new Date(now).toISOString(), notes }, null, 2);
}

const str = (x: unknown, max: number) => (typeof x === 'string' ? x.slice(0, max) : '');
const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const oneOf = <T extends string>(x: unknown, values: readonly T[]): T | null => (values.includes(x as T) ? (x as T) : null);

/** 一筆資料轉成合法的筆記；缺少必要欄位（id、題名）時回傳 null。其他欄位不合格式就用預設值 */
export function sanitizeNote(x: unknown, now: number): Note | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const id = str(o.id, 60);
  const title = str(o.title, MAX.title).trim();
  if (!id || !title) return null;
  const status = oneOf(o.status, ['solved', 'hint', 'stuck'] as const) ?? 'solved';
  const r = (o.review && typeof o.review === 'object' ? o.review : {}) as Record<string, unknown>;
  const level = Math.max(0, Math.min(INTERVALS.length - 1, Math.trunc(num(r.level) ?? 0)));
  const history = (Array.isArray(r.history) ? r.history : [])
    .slice(-MAX.history)
    .flatMap((h) => {
      const at = num((h as Record<string, unknown>)?.at);
      const result = oneOf((h as Record<string, unknown>)?.result, ['easy', 'ok', 'again'] as const);
      return at !== null && result ? [{ at, result }] : [];
    });
  const solutions = (Array.isArray(o.solutions) ? o.solutions : []).slice(0, MAX.solutions).flatMap((s) => {
    const so = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>;
    const code = str(so.code, MAX.code);
    if (!code) return [];
    return [{
      id: str(so.id, 60) || newId('s'),
      label: str(so.label, MAX.title),
      language: oneOf(so.language, ['python', 'javascript'] as const) ?? 'python',
      code,
      call: str(so.call, MAX.text),
    }];
  });
  const due = num(r.due);
  // 題名開頭寫了題號（「1. Two Sum」）：和編輯器一樣拆開存，避免顯示成「1. 1. Two Sum」
  const given = num(o.number) !== null && Number.isInteger(o.number) && (o.number as number) > 0 ? (o.number as number) : null;
  const inTitle = numberFromTitle(title);
  const number = given ?? inTitle;
  return {
    id,
    number,
    title: inTitle !== null && inTitle === number ? titleWithoutNumber(title) || title : title,
    url: safeUrl(str(o.url, 500)),
    difficulty: oneOf(o.difficulty, ['easy', 'medium', 'hard'] as const),
    tags: (Array.isArray(o.tags) ? o.tags : []).map((t) => str(t, MAX.tag).trim()).filter(Boolean).slice(0, MAX.tags),
    summary: str(o.summary, MAX.text),
    approach: str(o.approach, MAX.text),
    time: str(o.time, 100),
    space: str(o.space, 100),
    status,
    solutions,
    createdAt: num(o.createdAt) ?? now,
    updatedAt: num(o.updatedAt) ?? now,
    review: due !== null ? { due: startOfDay(due), level, history } : initialReview(status, now),
  };
}

export interface ImportResult {
  notes: Note[];
  added: number;
  updated: number;
  /** 本機的版本比較新（或一樣），保留本機的 */
  kept: number;
  /** 格式不對、讀不進來的筆數 */
  invalid: number;
}

/**
 * 讀取匯出的檔案並和現有的筆記合併：同一則筆記（id 相同）留下比較新的版本（updatedAt 較大），其他的新增。
 * 檔案格式不對時丟出錯誤。
 */
export function importNotes(existing: Note[], text: string, now: number): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('not-json');
  }
  const d = data as Record<string, unknown>;
  if (!d || d.kind !== FILE_KIND || !Array.isArray(d.notes)) throw new Error('not-notes');
  const byId = new Map(existing.map((n) => [n.id, n]));
  let added = 0;
  let updated = 0;
  let kept = 0;
  let invalid = 0;
  for (const raw of d.notes) {
    const note = sanitizeNote(raw, now);
    if (!note) {
      invalid++;
      continue;
    }
    const mine = byId.get(note.id);
    if (!mine) {
      if (byId.size >= MAX.notes) {
        invalid++;
        continue;
      }
      added++;
      byId.set(note.id, note);
    } else if (note.updatedAt > mine.updatedAt) {
      updated++;
      byId.set(note.id, note);
    } else {
      kept++;
    }
  }
  return { notes: [...byId.values()], added, updated, kept, invalid };
}
