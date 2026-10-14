/** Python 值序列化後的帶標籤結構（由 tracer.py 的 _ser 產生）。 */
export type PyValue =
  | { type: 'none' }
  | { type: 'bool'; value: boolean }
  | { type: 'int'; value: number | string }
  | { type: 'float'; value: number | string }
  | { type: 'str'; value: string }
  | { type: 'list' | 'tuple' | 'deque' | 'set'; items: PyValue[]; truncated?: number }
  | { type: 'dict'; entries: [PyValue, PyValue][]; cls?: string; truncated?: number }
  | { type: 'repr'; value: string; cls?: string };

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
  error?: TraceError;
  stdout: string;
}
