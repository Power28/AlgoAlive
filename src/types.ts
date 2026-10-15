/** Python 值序列化後的帶標籤結構（由 tracer.py 的 _ser 產生）。 */
export type PyValue =
  | { type: 'none' }
  | { type: 'bool'; value: boolean }
  | { type: 'int'; value: number | string }
  | { type: 'float'; value: number | string }
  | { type: 'str'; value: string }
  | { type: 'list' | 'tuple' | 'deque' | 'set'; items: PyValue[]; truncated?: number }
  | { type: 'dict'; entries: [PyValue, PyValue][]; cls?: string; truncated?: number }
  | { type: 'repr'; value: string; cls?: string }
  /** 自訂類別實例（ListNode、TreeNode…）的參照，內容在 step.heap[id] */
  | { type: 'ref'; id: string; cls: string };

export interface HeapObject {
  cls: string;
  fields: Record<string, PyValue>;
}

export type Heap = Record<string, HeapObject>;

export type SequenceValue = Extract<PyValue, { items: PyValue[] }>;
export type DictValue = Extract<PyValue, { type: 'dict' }>;

export interface ExecutionStep {
  stepIndex: number;
  /** 對應 Monaco Editor 的行數（line 事件代表「即將執行」這一行） */
  lineNumber: number;
  variables: Record<string, PyValue>;
  event: 'line' | 'return' | 'exception';
  returnValue?: PyValue;
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
  value?: PyValue;
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
}

export interface LoopInfo {
  /** 迴圈 header 所在行 */
  line: number;
  kind: 'for' | 'while';
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
  result: PyValue;
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
  value?: PyValue;
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
  value?: PyValue;
}

export interface LogicNode {
  op: 'and' | 'or' | 'not' | 'cmp' | 'leaf';
  src: string;
  display?: string;
  truthy?: boolean | null;
  value?: PyValue;
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
}

export interface TraceResult {
  steps: ExecutionStep[];
  returnValue?: PyValue;
  returnHeap?: Heap;
  error?: TraceError;
  stdout: string;
}
