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
  result: boolean | null;
  parts: ConditionPart[];
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
