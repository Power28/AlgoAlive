// Python 專用的程式碼分析：heapq 操作的 list 額外畫成堆積樹

const HEAP_CALL = /\b(?:heapq\s*\.\s*)?(?:heappush|heappop|heapify|heappushpop|heapreplace)\s*\(\s*([A-Za-z_]\w*)/g;
const HEAP_NAME = /^(heap|min_?heap|max_?heap|pq|priority_?queue)$/i;

/** 被 heapq 操作（或名稱就是 heap）的 list，額外畫成堆積樹 */
export function analyzeHeaps(code: string, varNames: Iterable<string> = []): Set<string> {
  const names = new Set<string>();
  for (const m of code.matchAll(HEAP_CALL)) names.add(m[1]);
  for (const n of varNames) if (HEAP_NAME.test(n)) names.add(n);
  return names;
}
