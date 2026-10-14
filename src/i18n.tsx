import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type Lang = 'en' | 'zh';
/** 雙語文字 */
export type L = { en: string; zh: string };

const STRINGS = {
  slogan: { en: 'Bring your LeetCode algorithms to life', zh: '讓你的 LeetCode 演算法動起來' },
  code: { en: 'Code', zh: '程式碼' },
  guide: { en: 'Guide', zh: '教學' },
  testCall: { en: 'Test call', zh: '測試呼叫' },
  visualize: { en: 'Visualize', zh: '視覺化' },
  visualizeHint: { en: 'Visualize (Ctrl+Enter)', zh: '視覺化（Ctrl+Enter）' },
  visualization: { en: 'Visualization', zh: '視覺化' },
  nextToRun: { en: 'next to run', zh: '即將執行' },
  eventReturn: { en: 'return', zh: '回傳' },
  eventException: { en: 'exception', zh: '例外' },
  depth: { en: 'depth {n}', zh: '深度 {n}' },
  line: { en: 'line {n}', zh: '第 {n} 行' },
  stale: { en: 'Code or input changed — press Visualize to refresh the trace.', zh: '程式碼或測資已修改，請按「視覺化」重新執行。' },
  runtimeLoading: { en: 'Loading Python…', zh: '載入 Python 中…' },
  runtimeReady: { en: 'Pyodide ready', zh: 'Python 已就緒' },
  runtimeFailed: { en: 'Runtime failed to load', zh: 'Python 載入失敗' },
  emptyLoading: { en: 'Downloading the Python runtime (first load takes a few seconds)…', zh: '正在下載 Python 執行環境（第一次載入需要幾秒）…' },
  emptyIdle: {
    en: 'Write a Python function, set the test call, then press Visualize (Ctrl+Enter) to watch it run step by step.',
    zh: '寫好 Python 函式、設定測試呼叫，按下「視覺化」（Ctrl+Enter）就能一步步看它執行。',
  },
  atLine: { en: 'at line {n}', zh: '位於第 {n} 行' },
  timeoutNote: { en: 'Showing the steps recorded before the limit.', zh: '以下顯示達到上限前已記錄的步驟。' },
  finished: { en: 'Execution finished.', zh: '執行結束。' },
  stdout: { en: 'stdout', zh: '輸出' },
  returned: { en: '{f}() returned', zh: '{f}() 回傳' },
  variables: { en: 'Variables', zh: '變數' },
  noLocals: { en: 'No local variables yet.', zh: '目前還沒有區域變數。' },
  dictKey: { en: 'key', zh: '鍵' },
  dictValue: { en: 'value', zh: '值' },
  dictEmpty: { en: 'empty', zh: '空' },
  more: { en: 'more', zh: '筆' },
  lookupHint: { en: 'A local variable currently holds this key', zh: '目前有區域變數的值等於這個 key' },
  step: { en: 'Step', zh: '步驟' },
  first: { en: 'First step (Home)', zh: '第一步（Home）' },
  prev: { en: 'Previous step (←)', zh: '上一步（←）' },
  playPause: { en: 'Play / Pause (Space)', zh: '播放 / 暫停（空白鍵）' },
  next: { en: 'Next step (→)', zh: '下一步（→）' },
  last: { en: 'Last step (End)', zh: '最後一步（End）' },
  timeline: { en: 'Timeline', zh: '時間軸' },
  newTab: { en: 'New tab', zh: '新增頁籤' },
  newBlank: { en: 'Blank tab', zh: '空白頁籤' },
  newBlankDesc: { en: 'Start from an empty function', zh: '從空白函式開始' },
  newFromLibrary: { en: 'From a tutorial…', zh: '從教學範例開啟…' },
  newFromLibraryDesc: { en: 'Pick an example problem', zh: '挑一題範例題目' },
  untitled: { en: 'Untitled {n}', zh: '未命名 {n}' },
  closeTab: { en: 'Close tab', zh: '關閉頁籤' },
  renameHint: { en: 'Double-click to rename', zh: '雙擊可重新命名' },
  learn: { en: 'Learn', zh: '演算法教學' },
  library: { en: 'Algorithm tutorials', zh: '演算法教學' },
  searchTopics: { en: 'Search topics or problems…', zh: '搜尋主題或題目…' },
  noResults: { en: 'No matching topics.', zh: '找不到符合的主題。' },
  close: { en: 'Close', zh: '關閉' },
  whenToUse: { en: 'When to use', zh: '什麼時候用' },
  coreIdea: { en: 'Core idea', zh: '核心觀念' },
  template: { en: 'Template', zh: '程式模板' },
  complexity: { en: 'Complexity', zh: '複雜度' },
  time: { en: 'Time', zh: '時間' },
  space: { en: 'Space', zh: '空間' },
  pitfalls: { en: 'Common pitfalls', zh: '常見陷阱' },
  practice: { en: 'Practice problems', zh: '練習題' },
  openInNewTab: { en: 'Open in new tab', zh: '在新頁籤開啟' },
  openedInTab: { en: 'Open', zh: '前往' },
  noGuide: { en: 'This tab is not linked to a tutorial.', zh: '這個頁籤沒有對應的教學。' },
  browseTutorials: { en: 'Browse tutorials', zh: '瀏覽所有教學' },
  backToList: { en: 'All topics', zh: '所有主題' },
  easy: { en: 'Easy', zh: '簡單' },
  medium: { en: 'Medium', zh: '中等' },
  hard: { en: 'Hard', zh: '困難' },
  copy: { en: 'Copy', zh: '複製' },
  copied: { en: 'Copied', zh: '已複製' },
  condTitle: { en: 'Condition', zh: '條件判斷' },
  calcTitle: { en: 'Calculation', zh: '計算' },
  callStack: { en: 'Calls', zh: '呼叫堆疊' },
  waitingAt: { en: 'waiting at line {n} for the call to return', zh: '停在第 {n} 行，等待下一層呼叫回傳' },
  loopsLabel: { en: 'Loops', zh: '迴圈' },
  iterOf: { en: 'pass {k} / {n}', zh: '第 {k} / {n} 圈' },
  iterOpen: { en: 'pass {k}', zh: '第 {k} 圈' },
  loopDone: { en: 'done', zh: '結束' },
  notInLoop: { en: 'not in a loop', zh: '不在迴圈中' },
  slotEmpty: { en: 'No condition or calculation on this line', zh: '這一行沒有條件或計算' },
  logicTitle: { en: 'Logic', zh: '邏輯運算' },
  shortAnd: { en: 'and stops at the first False — the rest is not evaluated', zh: 'and 遇到 False 就停止，後面不用算' },
  shortOr: { en: 'or stops at the first True — the rest is not evaluated', zh: 'or 遇到 True 就停止，後面不用算' },
  andOrReturnsOperand: {
    en: 'and / or return one of the operands itself (the one that decided the result), not just True / False',
    zh: 'and / or 回傳的是決定結果的那個運算元本身，不只是 True / False',
  },
  truthNone: { en: 'None is False', zh: 'None 為 False' },
  truthZero: { en: '0 is False', zh: '0 為 False' },
  truthNonZero: { en: 'non-zero is True', zh: '非零為 True' },
  truthEmptyStr: { en: 'empty string is False', zh: '空字串為 False' },
  truthEmpty: { en: 'empty container is False', zh: '空的容器為 False' },
  truthNonEmpty: { en: 'non-empty is True', zh: '非空為 True' },
  truthObject: { en: 'an object is True', zh: '物件為 True' },
  bitsTitle: { en: 'Bitwise', zh: '位元運算' },
  condSkipped: { en: 'skipped (short-circuit)', zh: '跳過（短路）' },
  condUnknown: { en: 'not evaluated', zh: '未求值' },
  condUnknownHint: {
    en: 'Contains a call that might change data (e.g. stack.pop()), so it is not evaluated ahead of time',
    zh: '含有可能修改資料的呼叫（例如 stack.pop()），所以不預先求值',
  },
  demo: { en: 'Animated walkthrough', zh: '動畫示範' },
  demoLoading: { en: 'Running the example…', zh: '正在執行範例…' },
  play: { en: 'Play', zh: '播放' },
  pause: { en: 'Pause', zh: '暫停' },
  replay: { en: 'Replay', zh: '從頭播放' },
  linkedList: { en: 'linked list', zh: '鏈結串列' },
  binaryTree: { en: 'binary tree', zh: '二元樹' },
  nodeCount: { en: '{n} nodes', zh: '{n} 個節點' },
  graphMeta: { en: '{n} nodes · {e} edges', zh: '{n} 個節點 · {e} 條邊' },
  graphVisited: { en: 'visited', zh: '已拜訪' },
  graphFrontier: { en: 'in queue / stack', zh: '在佇列 / 堆疊中' },
  graphActiveEdge: { en: 'current edge / path', zh: '目前的邊 / 路徑' },
} satisfies Record<string, L>;

export type StringKey = keyof typeof STRINGS;

const STORAGE_KEY = 'algoalive.lang';

function initialLang(): Lang {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (q === 'en' || q === 'zh') return q;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'zh') return saved;
  } catch {
    // 無法存取 storage 時用瀏覽器語言
  }
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

interface LangState {
  lang: Lang;
  setLang: (l: Lang) => void;
}

const LangContext = createContext<LangState>({ lang: 'en', setLang: () => {} });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(initialLang);
  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : 'en';
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // 忽略：只是記住偏好
    }
  }, [lang]);
  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);

/** 取得翻譯函式：t('line', { n: 3 }) */
export function useT() {
  const { lang } = useLang();
  return useCallback(
    (key: StringKey, params?: Record<string, string | number>) => {
      let s: string = STRINGS[key][lang];
      if (params) for (const [k, v] of Object.entries(params)) s = s.replace(`{${k}}`, String(v));
      return s;
    },
    [lang],
  );
}

/** 雙語內容取目前語言 */
export function useL() {
  const { lang } = useLang();
  return useCallback((l: L) => l[lang], [lang]);
}
