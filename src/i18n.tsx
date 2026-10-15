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
  opTitle: { en: 'Container op', zh: '容器操作' },
  trieTitle: { en: 'trie', zh: '字典樹' },
  trieMeta: { en: '{n} nodes · ◎ = end of a word', zh: '{n} 個節點 · ◎ = 單字結尾' },
  jumpBreak: { en: 'break: leave the loop "{loop}"', zh: 'break：跳出迴圈「{loop}」' },
  jumpContinue: { en: 'continue: skip the rest of this pass of "{loop}"', zh: 'continue：跳過「{loop}」這一圈剩下的部分' },
  jumpNextBreak: { en: 'next: line {n}, after the loop', zh: '接著執行迴圈後面的第 {n} 行' },
  jumpNextContinue: { en: 'next: back to line {n} for the next pass', zh: '回到第 {n} 行開始下一圈' },
  jumpNextDone: { en: 'that was the last pass — the loop ends', zh: '這已經是最後一圈，迴圈結束' },
  loopBreak: { en: 'break', zh: '跳出' },
  excTitle: { en: 'exception', zh: '例外' },
  designTitle: { en: 'operations', zh: '操作順序' },
  designMeta: { en: '{k} / {n}', zh: '第 {k} / {n} 個' },
  designSeek: { en: 'Jump to this operation', zh: '跳到這個操作' },
  designOutput: { en: 'outputs of all operations', zh: '所有操作的輸出' },
  builtinTitle: { en: 'built-in', zh: '內建函式' },
  bSum: { en: 'add the items one by one', zh: '一個一個加起來' },
  bMin: { en: 'compare one by one and keep the smallest (the first one on ties)', zh: '逐一比較，留下最小的（一樣小時取最先出現的）' },
  bMax: { en: 'compare one by one and keep the largest (the first one on ties)', zh: '逐一比較，留下最大的（一樣大時取最先出現的）' },
  bKey: { en: 'key', zh: 'key' },
  bByKey: { en: 'compared by key', zh: '依 key 的值比較' },
  bSorted: { en: 'returns a new sorted list — the original is unchanged', zh: '回傳排序好的新 list，原本的不變' },
  bSort: { en: 'sorts {target} in place', zh: '直接排序 {target}（原地修改）' },
  bReverseOrder: { en: '(largest first)', zh: '（由大到小）' },
  bStable: { en: 'equal items keep their original order', zh: '相等的元素維持原本的先後' },
  bReversed: { en: 'walk the items from the back', zh: '由後往前走訪' },
  bAny: { en: 'any: stops at the first True', zh: 'any：遇到第一個 True 就停' },
  bAll: { en: 'all: stops at the first False', zh: 'all：遇到第一個 False 就停' },
  bCheck: { en: 'check {elt} for each {var}', zh: '對每個 {var} 檢查 {elt}' },
  bStopped: { en: 'stopped here — the rest is never checked', zh: '在這裡停下，後面的不會再檢查' },
  bNoStop: { en: 'checked every item', zh: '每個元素都檢查過了' },
  bEnumerate: { en: 'pair each item with its index, starting at {start}', zh: '每個元素配上從 {start} 開始的編號' },
  bZip: { en: 'pair items at the same position; stops when the shortest runs out ({n} pairs)', zh: '相同位置的元素配成一組，最短的用完就停（{n} 組）' },
  bSet: { en: 'keep one of each value — duplicates are dropped', zh: '每個值只留一個，重複的丟掉' },
  bCounter: { en: 'count how many times each value appears', zh: '數每個值出現幾次' },
  bJoin: { en: 'glue the strings together with {sep}', zh: '用 {sep} 把字串接起來' },
  bJoinEmpty: { en: 'glue the strings together with nothing in between', zh: '直接把字串接起來（沒有分隔字元）' },
  bMore: { en: '+{n} more', zh: '還有 {n} 個' },
  excInTry: { en: 'try on line {n}', zh: '第 {n} 行的 try' },
  excFinallyFirst: { en: 'finally (line {n}) runs first', zh: '先執行 finally（第 {n} 行）' },
  excCaught: { en: 'caught by the except on line {n} — execution continues there', zh: '被第 {n} 行的 except 接住，從那裡繼續執行' },
  excNoTry: { en: 'no try here catches it', zh: '這裡沒有 try 接得住' },
  excPropagate: { en: 'the exception leaves {f}() and is raised again in {caller}() at line {n}', zh: '例外離開 {f}()，丟回呼叫者 {caller}() 的第 {n} 行' },
  excUncaught: { en: 'nothing catches it — the program stops here', zh: '沒有任何 try 接住，程式在這裡中止' },
  tryTitle: { en: 'try', zh: 'try' },
  tryStart: { en: 'Try the block below. If it raises, Python checks in order:', zh: '嘗試執行下面的區塊；如果出錯，依序比對：' },
  tryOnlyFinally: { en: 'Try the block below — there is no except, so an exception still leaves this try.', zh: '嘗試執行下面的區塊；沒有 except，出錯時例外照樣往外拋。' },
  tryFinallyAlways: { en: 'finally (line {n}) runs at the end no matter what', zh: '不論有沒有出錯，最後都會執行 finally（第 {n} 行）' },
  exceptCheck: { en: 'Is {type} a match for {src}?', zh: '{type} 符合 {src} 嗎？' },
  exceptYes: { en: 'yes — caught! Run this except block', zh: '符合，接住了！執行這個 except 區塊' },
  exceptYesAs: { en: 'yes — caught! {name} = the exception; run this except block', zh: '符合，接住了！{name} = 這個例外，執行這個 except 區塊' },
  exceptNo: { en: 'no — try the next except', zh: '不符合，繼續比對下一個' },
  exceptUnknown: { en: 'cannot tell safely', zh: '無法安全判斷' },
  elseRuns: { en: 'The try block finished without an exception, so else runs.', zh: 'try 區塊沒有發生例外，所以執行 else。' },
  finallyAlways: { en: 'finally always runs — with or without an exception.', zh: '不論有沒有例外，finally 一定會執行。' },
  finallyHandled: { en: '{exc} was already handled by except; finally still runs.', zh: '{exc} 已經被 except 處理，finally 照樣執行。' },
  finallyReraise: { en: '{exc} has not been caught: after finally it keeps propagating.', zh: '{exc} 還沒被接住：finally 執行完後會繼續往外拋。' },
  loopContinue: { en: 'continue', zh: '跳過' },
  multiTitle: { en: 'Simultaneous assignment', zh: '同時賦值' },
  swapTitle: { en: 'Swap', zh: '交換' },
  multiStep1: { en: '① evaluate every value on the right first', zh: '① 先把右邊每一個值都算好' },
  multiStep2: { en: '② then assign them all at once', zh: '② 再同時寫到左邊' },
  swapNote: {
    en: 'Because the right side is fully evaluated before anything is assigned, no temporary variable is needed.',
    zh: '右邊會先全部算完才開始寫入，所以交換不需要暫存變數。',
  },
  compTitle: { en: 'Comprehension', zh: '推導式' },
  compStart: { en: 'Start iterating — the result is empty', zh: '開始走訪，結果還是空的' },
  compItem: { en: 'Element #{k}: {item} = {value}', zh: '第 {k} 個元素：{item} = {value}' },
  compAdd: { en: 'add {value}', zh: '加入 {value}' },
  compSkip: { en: 'condition is False — skipped', zh: '條件不成立，略過' },
  compResult: { en: 'result so far', zh: '目前結果' },
  slices: { en: 'slice', zh: '切片' },
  recursionTree: { en: 'recursion tree', zh: '遞迴樹' },
  callsCount: { en: '{n} calls', zh: '{n} 次呼叫' },
  recursionHint: { en: 'click a call to jump to it', zh: '點節點跳到那次呼叫' },
  jumpToCall: { en: 'Jump to the start of this call', zh: '跳到這次呼叫開始的那一步' },
  heapKind: { en: 'heap', zh: '堆積' },
  heapMeta: { en: 'parent ≤ children', zh: '父節點 ≤ 子節點' },
  heapTop: { en: 'min', zh: '最小' },
  heapTruncated: { en: '+{n} more nodes not drawn', zh: '另外還有 {n} 個節點未畫出' },
  opPush: { en: 'Put {value} at the end of {target}', zh: '把 {value} 放到 {target} 的尾端' },
  opPushLeft: { en: 'Put {value} at the front of {target}', zh: '把 {value} 放到 {target} 的前端' },
  opMoveBack: { en: 'Take {value} off the end of {from} and put it at the {to} of {target}', zh: '從 {from} 的尾端取出 {value}，放到 {target} 的{to}' },
  opMoveFront: { en: 'Take {value} off the front of {from} and put it at the {to} of {target}', zh: '從 {from} 的前端取出 {value}，放到 {target} 的{to}' },
  opEndBack: { en: 'end', zh: '尾端' },
  opEndFront: { en: 'front', zh: '前端' },
  opPop: { en: 'Take {value} off the end of {target}', zh: '從 {target} 的尾端取出 {value}' },
  opPopAt: { en: 'Take {value} out of {target} at index {index}', zh: '從 {target} 取出第 {index} 格的 {value}' },
  opPopLeft: { en: 'Take {value} off the front of {target}', zh: '從 {target} 的前端取出 {value}' },
  opDictPop: { en: 'Take the value {value} of key {key} out of {target}', zh: '從 {target} 取出 key {key} 的值 {value}' },
  opSetPop: { en: 'Take an arbitrary element out of the set {target}', zh: '從集合 {target} 取出任意一個元素' },
  opInsert: { en: 'Insert {value} into {target} at index {index}', zh: '把 {value} 插入 {target} 的第 {index} 格' },
  opExtend: { en: 'Append each of {value} to the end of {target}', zh: '把 {value} 逐一加到 {target} 的尾端' },
  opRemove: { en: 'Remove the first {value} from {target} (index {index})', zh: '從 {target} 移除第一個 {value}（第 {index} 格）' },
  opRemoveMissing: { en: '{value} is not in {target} — this raises ValueError', zh: '{target} 裡沒有 {value}，會拋出 ValueError' },
  opAdd: { en: 'Add {value} to the set {target}', zh: '把 {value} 加入集合 {target}' },
  opAddExisted: { en: '{value} is already in {target} — nothing changes', zh: '{value} 已經在集合 {target} 中，不會改變' },
  opDiscard: { en: 'Remove {value} from the set {target}', zh: '從集合 {target} 移除 {value}' },
  opDiscardMissing: { en: '{value} is not in {target} — nothing changes', zh: '{value} 不在集合 {target} 中，不會改變' },
  opClear: { en: 'Empty {target}', zh: '清空 {target}' },
  opHeapPush: {
    en: 'Push {value} onto the heap {target}: it goes into the last slot, then swaps upward while smaller than its parent',
    zh: '把 {value} 推入堆積 {target}：先放在最後一格，比父節點小就往上交換',
  },
  opHeapPop: {
    en: 'Pop the smallest value {value} (the top) from {target}: the last element moves to the top and sinks down',
    zh: '取出堆積 {target} 的最小值 {value}（頂端）：最後一格補到頂端，再往下調整',
  },
  opHeapify: { en: 'Rearrange {target} into a heap in place: the smallest value rises to the top', zh: '把 {target} 原地整理成堆積：最小值會移到頂端' },
  opHeapPushPop: { en: 'Push {value}, then pop the smallest value', zh: '先推入 {value}，再取出最小值' },
  opHeapReplace: { en: 'Pop the smallest value {popped}, then push {value}', zh: '先取出最小值 {popped}，再推入 {value}' },
  opSetNew: { en: 'Add {target}[{key}] = {value}', zh: '新增 {target}[{key}] = {value}' },
  opSetUpdate: { en: 'Update {target}[{key}] = {value}', zh: '更新 {target}[{key}] = {value}' },
  opDel: { en: 'Delete {target}[{key}] (was {value})', zh: '刪除 {target}[{key}]（原本是 {value}）' },
  opMissingKey: { en: '{target} has no key {key} — this raises KeyError', zh: '{target} 沒有 key {key}，會拋出 KeyError' },
  opEmpty: { en: '{target} is empty — this raises an exception', zh: '{target} 是空的，這個操作會拋出例外' },
  opAssign: { en: ', and store it in {assign}', zh: '，寫入 {assign}' },
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
  bitsWidth: { en: "two's complement, {w} bits shown", zh: '二補數，畫出 {w} 位' },
  bitsExtend: { en: 'Python integers have no fixed width: a negative number continues with infinitely many 1s to the left', zh: 'Python 的整數沒有固定位數：負數的左邊有無限多個 1' },
  bitsSignBit: { en: 'sign bit: 1 means negative', zh: '符號位：1 代表負數' },
  bitsSignedNote: { en: "Negative numbers use two's complement: -x = ~x + 1, and the 1s continue forever to the left (…1).", zh: '負數用二補數表示：-x = ~x + 1，左邊的 1 會無限延伸下去（…1）。' },
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
