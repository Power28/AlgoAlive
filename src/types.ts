/** 執行期的值序列化後的帶標籤結構（與語言無關；Python 由 languages/python/tracer.py 的 _ser 產生）。 */
export type Value =
  | { type: 'none' }
  | { type: 'bool'; value: boolean }
  | { type: 'int'; value: number | string }
  | { type: 'float'; value: number | string }
  | { type: 'str'; value: string }
  | { type: 'list' | 'tuple' | 'deque' | 'set'; items: Value[]; truncated?: number }
  | { type: 'dict'; entries: [Value, Value][]; cls?: string; truncated?: number }
  | { type: 'repr'; value: string; cls?: string }
  /** 自訂類別實例（ListNode、TreeNode…）的參照，內容在 step.heap[id] */
  | { type: 'ref'; id: string; cls: string };

export interface HeapObject {
  cls: string;
  fields: Record<string, Value>;
}

export type Heap = Record<string, HeapObject>;

export type SequenceValue = Extract<Value, { items: Value[] }>;
export type DictValue = Extract<Value, { type: 'dict' }>;

export interface ExecutionStep {
  stepIndex: number;
  /** 對應 Monaco Editor 的行數（line 事件代表「即將執行」這一行） */
  lineNumber: number;
  variables: Record<string, Value>;
  event: 'line' | 'return' | 'exception';
  returnValue?: Value;
  exception?: string;
  funcName: string;
  /** 使用者函式的呼叫深度（遞迴時 > 1） */
  depth: number;
  /** 到此步為止累積的 print 輸出 */
  stdout: string;
  /** 這一步（含外層 frame）可達的所有自訂物件 */
  heap?: Heap;
  /** 外層呼叫中指向節點的變數（遞迴路徑） */
  stackRefs?: { depth: number; name: string; id: string }[];
  /** 這一行若是條件式（if / while / return a < b…），其求值過程 */
  condition?: Condition;
  /** 這一行若是算術賦值（mid = (lo + hi) // 2、left += 1、return 1 + x…），其逐步計算過程 */
  calc?: Calc;
  /** 由外而內正在進行的迴圈 */
  loops?: LoopInfo[];
  /** 由外而內的呼叫堆疊（最後一個是目前的 frame） */
  stack?: StackFrame[];
  /** 這一步是剛進入一次新的函式呼叫 */
  entered?: boolean;
  /** 這一行的容器操作（append / pop / heappush…），值在操作發生前以唯讀方式算出 */
  op?: ContainerOp;
  /** 同時賦值 a, b = b, a */
  multi?: MultiAssign;
  /** 這一行用到的切片範圍 */
  slices?: SliceInfo[];
  /** 推導式這一圈的進度 */
  comp?: CompInfo;
  /** 這一行是 break / continue */
  jump?: { kind: 'break' | 'continue'; loopLine: number; loopSrc: string };
  /** 例外發生時（event = exception）：會被哪個 except 接住，或往外拋 */
  exc?: ExcFlow;
  /** try: / except 比對 / else / finally 這幾行在做什麼 */
  tryFlow?: TryFlow;
  /** 這一行呼叫的 sum / max / sorted / any… 如何處理每個元素（執行前以唯讀方式算出） */
  builtins?: BuiltinCall[];
  /** 設計類題目（run_design）：目前是第幾個操作、已完成操作的輸出（LeetCode 寫法） */
  design?: { index: number; outputs: string[] };
}

export interface BuiltinCall {
  func: 'sum' | 'min' | 'max' | 'sorted' | 'sort' | 'reversed' | 'any' | 'all' | 'enumerate' | 'zip' | 'set' | 'Counter' | 'join';
  src: string;
  /** 輸入的元素（顯示用，最多 16 個） */
  items?: string[];
  /** 超過 16 個時省略的數量 */
  more?: number;
  result?: string;
  /** sum：每加一個之後的累計 */
  running?: string[];
  /** min / max：勝出的元素 */
  pick?: number;
  /** key= 算出的比較值 */
  keys?: string[];
  /** sorted / sort / reversed：結果中第 k 個是原本的第 order[k] 個 */
  order?: number[];
  reverse?: boolean;
  /** list.sort() 的 list 名稱 */
  target?: string;
  /** any / all：每個元素的真假，stop 為短路停下的位置；elt / var 來自產生器運算式 */
  truth?: boolean[];
  stop?: number;
  elt?: string;
  var?: string;
  /** enumerate 的起始編號 */
  start?: number;
  /** zip */
  names?: string[];
  columns?: string[][];
  count?: number;
  /** set：是否第一次出現（保留） */
  kept?: boolean[];
  /** Counter：[值, 次數] */
  counts?: [string, number][];
  /** join 的分隔字串 */
  sep?: string;
}

export interface ExcFlow {
  type: string;
  message: string;
  /** 由內往外經過的 try；handlers 是依序比對過的 except（match 為 null 代表無法安全判斷） */
  route: { line: number; handlers: { line: number; src: string; match: boolean | null }[]; finally: number | null }[];
  outcome: { kind: 'caught'; line: number } | { kind: 'propagate'; func: string; line: number } | { kind: 'uncaught' };
}

export type TryFlow =
  | { kind: 'try'; handlers: string[]; finally: number | null }
  | { kind: 'except'; src: string; type: string; message: string; match: boolean | null; as?: string }
  | { kind: 'else' }
  | { kind: 'finally'; exc?: string; reraise?: boolean };

export interface MultiAssign {
  src: string;
  pairs: { target: string; valueSrc: string; value: Value; display: string; loc?: TermLocation; targetLoc?: TermLocation }[];
  /** 左右兩邊是同一組名稱、順序不同 */
  swap: boolean;
}

export interface SliceInfo {
  var: string;
  src: string;
  /** slice.indices() 正規化後的範圍 */
  start: number;
  stop: number;
  step: number;
  display: string;
}

export interface CompInfo {
  src: string;
  kind: 'list' | 'set' | 'dict';
  /** 迭代變數名稱 */
  item: string;
  /** 已處理幾個元素（0 = 剛開始） */
  count: number;
  itemDisplay?: string;
  /** 條件是否通過（沒有 if 時永遠是 true） */
  kept?: boolean;
  valueDisplay?: string;
  /** 到目前為止組出來的結果 */
  result: Value;
}

export interface ContainerOp {
  kind:
    | 'push' | 'pushleft' | 'pop' | 'popleft' | 'insert' | 'extend' | 'remove'
    | 'add' | 'discard' | 'clear'
    | 'heappush' | 'heappop' | 'heapify' | 'heappushpop' | 'heapreplace'
    | 'setitem' | 'delitem';
  /** 容器變數名稱 */
  target: string;
  container: 'list' | 'deque' | 'set' | 'dict' | 'heap';
  src: string;
  /** 放入 / 取出的值 */
  value?: Value;
  display?: string;
  /** 受影響的位置（放入的位置、被取出的格子） */
  index?: number;
  key?: string;
  /** x = stack.pop()：結果寫入的變數 */
  assignTo?: string;
  existed?: boolean;
  missing?: boolean;
  empty?: boolean;
  /** heapreplace / heappushpop 會取出的最小值 */
  popped?: string;
  unordered?: boolean;
  size: number;
  /** b.append(a.pop())：放入的元素是從另一個容器的尾端 / 前端取出來的 */
  from?: { target: string; end: 'back' | 'front' };
}

export interface LoopInfo {
  /** 迴圈 header 所在行 */
  line: number;
  kind: 'for' | 'while' | 'comp';
  /** header 原文，例如 "for i in range(3, n + 1)" */
  src: string;
  /** 第幾圈（1 起算）；在 header 行時代表正在檢查是否還有這一圈 */
  iteration: number;
  /** 總圈數（可以安全得知時才有，例如 range / 序列長度） */
  total?: number;
  /** 最後一次檢查，迴圈即將結束 */
  done?: boolean;
  /** for item in seq：被走訪的序列與目標變數，用來在序列上標出目前那一格 */
  seq?: string;
  item?: string;
}

export interface StackFrame {
  func: string;
  /** 這一層目前停在哪一行（外層代表呼叫下一層的那一行） */
  line: number;
  /** [參數名, 簡短的值] */
  args: [string, string][];
}

export interface Calc {
  /** assign：一般賦值；aug：+= 這類；return：回傳算式 */
  kind: 'assign' | 'aug' | 'return';
  /** 敘述原文，例如 "mid = (lo + hi) // 2" */
  src: string;
  expr: string;
  /** 逐步化簡，例如 ["(0 + 7) // 2", "7 // 2", "3"] */
  stages: string[];
  result: Value;
  resultDisplay: string;
  /** 右邊讀到的變數 / 格子 / 節點 */
  terms: ConditionTerm[];
  /** 寫入的目標，例如 "mid"、"dp[i]" */
  target?: string;
  targetLoc?: TermLocation;
  /** 位元運算的二進位運算元（例如 result ^= num） */
  bits?: { op: string; left: number; right: number; result: number }[];
}

/** 比較運算元在畫面上的位置，用來替被比較的格子 / 變數 / 節點加框 */
export interface TermLocation {
  var?: string;
  index?: number;
  col?: number;
  ref?: string;
}

export interface ConditionTerm {
  src: string;
  /** 顯示用：短的純量顯示值，否則為原本的寫法 */
  display: string;
  value?: Value;
  loc?: TermLocation;
}

export interface ConditionPart {
  /** cmp：比較運算；truth：取真假值（例如 while queue: 的 queue） */
  kind: 'cmp' | 'truth';
  src: string;
  /** and / or 短路，沒有被求值 */
  skipped?: boolean;
  terms?: ConditionTerm[];
  ops?: string[];
  display?: string;
  /** null：含有不能安全求值的部分（例如 stack.pop()） */
  result?: boolean | null;
}

export interface Condition {
  src: string;
  /** 代入數值後的整個條件式，例如 "0 < 6"、"stack and …" */
  display: string;
  /** 真假值 */
  result: boolean | null;
  parts: ConditionPart[];
  /** 邏輯樹：and / or / not 的結構與求值順序 */
  tree?: LogicNode;
  /** test：if / while 只看真假；value：賦值 / 回傳，and / or 回傳的是運算元本身 */
  context?: 'test' | 'value';
  /** 整個運算式實際的值（例如 list1 or list2 回傳的那個節點） */
  value?: Value;
}

export interface LogicNode {
  op: 'and' | 'or' | 'not' | 'cmp' | 'leaf';
  src: string;
  display?: string;
  truthy?: boolean | null;
  value?: Value;
  /** 被 and / or 短路跳過 */
  skipped?: boolean;
  /** 比較與取值的求值順序（0 起算），動畫照這個順序播放 */
  order?: number;
  children?: LogicNode[];
  /** and / or 在第幾個運算元就決定了結果 */
  shortCircuitAt?: number;
}

export interface TraceError {
  type: string;
  message: string;
  line: number | null;
  timeout: boolean;
  /** 測試呼叫寫錯（type 為 CallError）：結構化的說明與自動修正 */
  hint?: CallHint;
}

export type CallHint =
  | { kind: 'empty'; funcs: string[] }
  | { kind: 'name'; got: string; funcs: string[]; suggest?: string; fix?: string }
  | { kind: 'noSolution'; got: string; fix: string }
  | { kind: 'noFunction' }
  | { kind: 'args'; func: string; params: string[]; got: number | string[] };

/** 測試呼叫被解讀成什麼：LeetCode 的範例格式、自動補上 Solution().、list 轉成鏈結串列 / 樹… */
export interface CallInfo {
  display: string;
  inferred: boolean;
  conversions: { param: string; to: 'ListNode' | 'TreeNode' | 'Node' }[];
}

export interface TraceResult {
  steps: ExecutionStep[];
  returnValue?: Value;
  returnHeap?: Heap;
  error?: TraceError;
  stdout: string;
  /** 測試呼叫是 LeetCode 設計題的兩個陣列時：每個操作的寫法 */
  design?: { ops: string[]; calls: string[] };
  call?: CallInfo;
}
