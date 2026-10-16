import type { TraceResult, Value } from '../types';
import type { IndexMap } from '../lib/indexing';
import type { StringKey } from '../i18n';

/**
 * 支援的程式語言。
 *
 * 加入新語言時：在 src/languages/<id>/ 實作 Language（執行環境 + 追蹤器、值的格式、程式碼分析），
 * 再登記到 src/languages/index.ts。追蹤器要輸出與 Python 相同的 TraceResult（每一步的行號、
 * 帶型別標籤的 Value、heap、呼叫堆疊…），視覺化元件就能直接沿用。
 */
export type LanguageId = 'python' | 'javascript';

export type RuntimeStatus = 'loading' | 'ready' | 'running' | 'error';

export interface RunOptions {
  /** 背景執行（例如教學動畫）：不改變執行狀態，主畫面的「視覺化」按鈕不會因此變成忙碌中 */
  background?: boolean;
}

/** 執行環境：在背景（Web Worker）執行程式並回傳逐步的追蹤結果 */
export interface LanguageRuntime {
  status: RuntimeStatus;
  /** 訂閱狀態變化；回傳取消訂閱的函式。訂閱時會立刻收到目前狀態 */
  onStatus(fn: (status: RuntimeStatus, detail?: string) => void): () => void;
  run(code: string, call: string, options?: RunOptions): Promise<TraceResult>;
}

/** 值的顯示規則（各語言的字面值寫法不同：None / null、True / true、引號…） */
export interface ValueFormat {
  none: string;
  /** 型別標籤中「空值」的型別名稱，例如 NoneType */
  noneType: string;
  bool: (b: boolean) => string;
  /** 數值；value 為字串時是 inf / -inf / nan 這類特殊值 */
  float: (value: number | string) => string;
  str: (s: string) => string;
  /** 容器：parts 是已格式化的元素（dict 為 "k: v"），more 是被截斷的數量提示 */
  container: (type: 'list' | 'tuple' | 'set' | 'deque' | 'dict', parts: string[], more: string) => string;
  /** 邏輯運算子的寫法：and / or / not，或 && / || / ! */
  logic: { and: string; or: string; not: string };
  /** 非布林值為什麼是真 / 假（Python 的空 list 為 False；JavaScript 的 [] 為 true） */
  truthReason: (v: Value) => StringKey | null;
  /** 短路的說明 */
  shortCircuit: { and: StringKey; or: StringKey };
  /** 接住例外的關鍵字：except（依型別比對）或 catch（接住所有例外） */
  handler: 'except' | 'catch';
}

/** 程式碼中可以當成測試入口的函式 */
export interface FuncDef {
  name: string;
  /** 是 class Solution 的方法 */
  method: boolean;
  params: { name: string; annotation: string }[];
}

export interface Language {
  id: LanguageId;
  /** 顯示名稱，例如 "Python 3" */
  label: string;
  /** 執行環境的名稱（載入中 / 已就緒的提示），例如 "Python" */
  runtimeName: string;
  /** Monaco 編輯器的語言 id */
  monaco: string;
  /** 執行環境；第一次呼叫時才建立（例如開始下載 Pyodide） */
  runtime(): LanguageRuntime;
  format: ValueFormat;
  /** 新頁籤的預設程式碼與測試呼叫 */
  blank: { code: string; call: string };
  /** 程式碼分析：指針對應的容器、要畫成堆積樹的 list */
  analyzeIndexing(code: string): IndexMap;
  analyzeHeaps(code: string, varNames?: Iterable<string>): Set<string>;
  /** 測試呼叫的輔助：找出函式、產生範例呼叫、判斷呼叫是否對不上程式碼 */
  findFunctions(code: string): FuncDef[];
  exampleCall(f: FuncDef): string;
  callNeedsHelp(call: string, funcs: FuncDef[], code: string): boolean;
  /** 測試呼叫輸入框的提示文字與「可以怎麼寫？」的格式清單 */
  callPlaceholder: string;
  callFormats: { example: string; note: StringKey }[];
}
