import type { LanguageId } from '../languages/types';
import type { L } from '../i18n';

export type Difficulty = 'easy' | 'medium' | 'hard';

/** 可以在頁籤中直接執行的範例題目 */
export interface Example {
  /** 唯一 id，例如 "lc167" */
  id: string;
  /** LeetCode 題號 */
  number: number;
  title: L;
  difficulty: Difficulty;
  /** 範例程式的語言；省略時為 Python */
  language?: LanguageId;
  code: string;
  call: string;
  /**
   * 預期的回傳值，寫法與畫面上「returned」橫幅相同（例如 `[3, 4]`、`5 → 4 → 3 → 2 → 1`）。
   * scripts/check_examples.py 與 scripts/e2e.mjs 都會拿它比對。
   */
  expected: string;
  /** 這題觀察重點 */
  note?: L;
}

export type CategoryId = 'arrays' | 'hashing' | 'linked-list' | 'tree' | 'stack-queue' | 'graph' | 'dp' | 'techniques';

export interface Tutorial {
  id: string;
  category: CategoryId;
  title: L;
  /** 一句話說明 */
  tagline: L;
  whenToUse: L[];
  idea: L[];
  template?: string;
  complexity: { time: string; space: string; note?: L };
  pitfalls: L[];
  examples: Example[];
}

export const CATEGORIES: { id: CategoryId; title: L }[] = [
  { id: 'arrays', title: { en: 'Arrays & Pointers', zh: '陣列與指針' } },
  { id: 'hashing', title: { en: 'Hashing', zh: '雜湊' } },
  { id: 'linked-list', title: { en: 'Linked List', zh: '鏈結串列' } },
  { id: 'tree', title: { en: 'Trees', zh: '樹' } },
  { id: 'stack-queue', title: { en: 'Stack, Queue & Heap', zh: '堆疊、佇列與堆積' } },
  { id: 'graph', title: { en: 'Graph & Grid', zh: '圖與網格' } },
  { id: 'dp', title: { en: 'Dynamic Programming', zh: '動態規劃' } },
  { id: 'techniques', title: { en: 'Other Techniques', zh: '其他技巧' } },
];
