import { isPointerName } from './pointers';

/** 某個容器在程式碼中被哪些變數當作索引使用。 */
export interface IndexInfo {
  /**
   * dims[d]：第 d 層方括號內出現的索引變數 → 該變數出現時的常數位移集合。
   * 例如 `text1[i - 1]` → i: {-1}；無法解析成「變數 ± 常數」時記為 null。
   */
  dims: Map<string, Set<number | null>>[];
  /** 二維索引的變數組合，例如 grid[r][c] → "r,c" */
  pairs: Set<string>;
}

export type IndexMap = Map<string, IndexInfo>;

const IDENT = /[A-Za-z_]\w*/g;
const KEYWORDS = new Set([
  'return', 'in', 'not', 'and', 'or', 'if', 'elif', 'else', 'for', 'while', 'is', 'yield', 'lambda',
  'assert', 'del', 'await', 'print',
]);
const VAR_OFFSET = /^\s*([A-Za-z_]\w*)\s*(?:([+-])\s*(\d+))?\s*$/;

/** 從索引運算式取出「代表位置」的變數：只有一個識別字時取它，否則只取看起來像指針的名稱。 */
function indexVars(expr: string): [string, number | null][] {
  const m = expr.match(VAR_OFFSET);
  if (m) return [[m[1], m[2] ? (m[2] === '-' ? -1 : 1) * Number(m[3]) : 0]];
  const ids = [...new Set(expr.match(IDENT) ?? [])];
  const vars = ids.length === 1 ? ids : ids.filter(isPointerName);
  return vars.map((v) => [v, null]);
}

/**
 * 靜態掃描程式碼中的 `name[...]`（含 `name[...][...]`），
 * 用來判斷指針變數到底指向哪一個 list / string / grid。
 */
export function analyzeIndexing(code: string): IndexMap {
  const map: IndexMap = new Map();
  // self.stack[-1] 也算：設計類題目的狀態以 self.xxx 變數顯示
  const re = /((?:self\.|this\.)?[A-Za-z_]\w*)\s*\[/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    const name = m[1];
    // `return [a, i]`、`x in [1, 2]` 是 list 字面值，不是索引
    if (KEYWORDS.has(name)) continue;
    let pos = m.index + m[0].length;
    const exprs: string[] = [];
    for (;;) {
      const start = pos;
      let depth = 1;
      while (pos < code.length && depth > 0) {
        const ch = code[pos];
        if (ch === '[' || ch === '(') depth++;
        else if (ch === ']' || ch === ')') depth--;
        pos++;
      }
      exprs.push(code.slice(start, pos - 1));
      if (code[pos] !== '[') break;
      pos++;
    }

    let info = map.get(name);
    if (!info) map.set(name, (info = { dims: [], pairs: new Set() }));
    const vars = exprs.map(indexVars);
    vars.forEach((vs, d) => {
      const dim = (info.dims[d] ??= new Map());
      for (const [v, off] of vs) {
        if (!dim.has(v)) dim.set(v, new Set());
        dim.get(v)!.add(off);
      }
    });
    if (vars.length >= 2) for (const [a] of vars[0]) for (const [b] of vars[1]) info.pairs.add(`${a},${b}`);
  }
  return map;
}

/** 變數在這個容器上「一律」帶著同一個非零位移（例如永遠是 i - 1）時回傳該位移，否則 0。 */
export function consistentOffset(offsets: Set<number | null> | undefined): number {
  if (!offsets || offsets.size !== 1) return 0;
  const [only] = offsets;
  return only ?? 0;
}
