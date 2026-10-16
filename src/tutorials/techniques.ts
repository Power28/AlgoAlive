import type { Tutorial } from './types';

export const TECHNIQUE_TUTORIALS: Tutorial[] = [
  {
    id: 'greedy',
    category: 'techniques',
    title: { en: 'Greedy', zh: '貪心法' },
    tagline: {
      en: 'Make the locally best choice at every step and never look back — when you can prove it is safe.',
      zh: '每一步都做當下最好的選擇、不回頭——前提是你能證明這樣做不會錯。',
    },
    whenToUse: [
      { en: 'A single pass with a running "best so far" is enough (min price, farthest reach).', zh: '一次掃描、維護「目前為止最好」就夠了（最低價、最遠可達位置）。' },
      { en: 'Exchange argument: swapping any choice for the greedy one never makes things worse.', zh: '交換論證：把任何選擇換成貪心選擇都不會變差。' },
      { en: 'Interval scheduling, jump games, stock trading.', zh: '區間排程、跳躍遊戲、股票買賣。' },
    ],
    idea: [
      { en: 'Identify the one quantity worth tracking (e.g. the cheapest price seen so far).', zh: '找出唯一值得追蹤的量（例如目前看過的最低價）。' },
      { en: 'Update it and the answer in the same loop.', zh: '在同一個迴圈中同時更新它和答案。' },
      { en: 'If you cannot convince yourself it is correct, it is probably a DP problem instead.', zh: '如果說服不了自己貪心是對的，那多半其實是 DP 題。' },
    ],
    complexity: { time: 'O(n)', space: 'O(1)' },
    pitfalls: [
      { en: 'Greedy that "looks right" but fails on a counter-example — always test edge cases.', zh: '看起來對的貪心卻有反例——一定要測邊界情況。' },
    ],
    examples: [
      {
        id: 'lc121',
        number: 121,
        title: { en: 'Best Time to Buy and Sell Stock', zh: '買賣股票的最佳時機' },
        difficulty: 'easy',
        note: { en: 'Selling today is best if you bought at the cheapest price seen so far.', zh: '今天賣的話，最好的買點就是到目前為止的最低價。' },
        code: `def maxProfit(prices: List[int]) -> int:
    min_price = float('inf')
    best = 0
    for i, price in enumerate(prices):
        min_price = min(min_price, price)
        best = max(best, price - min_price)
    return best
`,
        call: 'maxProfit([7, 1, 5, 3, 6, 4])',
        expected: '5',
        js: {
          code: `/**
 * @param {number[]} prices
 * @return {number}
 */
var maxProfit = function(prices) {
    let minPrice = Infinity;
    let best = 0;
    for (const price of prices) {
        minPrice = Math.min(minPrice, price);
        best = Math.max(best, price - minPrice);
    }
    return best;
};
`,
          call: 'maxProfit([7, 1, 5, 3, 6, 4])',
          expected: '5',
        },
      },
      {
        id: 'lc55',
        number: 55,
        title: { en: 'Jump Game', zh: '跳躍遊戲' },
        difficulty: 'medium',
        note: { en: 'Track the farthest reachable index; if `i` ever passes it, you are stuck.', zh: '追蹤最遠能到的位置；一旦 `i` 超過它就卡住了。' },
        code: `def canJump(nums: List[int]) -> bool:
    farthest = 0
    for i in range(len(nums)):
        if i > farthest:
            return False
        farthest = max(farthest, i + nums[i])
    return True
`,
        call: 'canJump([2, 3, 1, 1, 4])',
        expected: 'True',
        js: {
          code: `/**
 * @param {number[]} nums
 * @return {boolean}
 */
var canJump = function(nums) {
    let farthest = 0;
    for (let i = 0; i < nums.length; i++) {
        if (i > farthest) {
            return false;
        }
        farthest = Math.max(farthest, i + nums[i]);
    }
    return true;
};
`,
          call: 'canJump([2, 3, 1, 1, 4])',
          expected: 'true',
        },
      },
    ],
  },
  {
    id: 'recursion',
    category: 'techniques',
    title: { en: 'Recursion & Memoization', zh: '遞迴與記憶化' },
    tagline: {
      en: 'Solve a problem by calling yourself on smaller inputs; remember answers you already computed so each subproblem is solved once.',
      zh: '把問題交給「更小的自己」去解；把算過的答案記下來，每個子問題只算一次。',
    },
    whenToUse: [
      { en: 'The answer for `n` is defined by answers for smaller inputs (Fibonacci, climbing stairs, tree problems).', zh: '`n` 的答案由更小輸入的答案組成（費氏數列、爬樓梯、樹的問題）。' },
      { en: 'The recursion tree has the **same subproblem** in many branches — that is when memoization pays off.', zh: '遞迴樹的很多分支出現**相同的子問題**——這時記憶化就很划算。' },
      { en: 'You want a top-down version of a DP before turning it into a table.', zh: '想先寫出「由上而下」的 DP，之後再改成表格。' },
    ],
    idea: [
      { en: '**Base case** first: the smallest inputs return directly.', zh: '先寫**終止條件**：最小的輸入直接回傳。' },
      { en: 'Each call waits for its sub-calls, then combines their results — watch the recursion tree grow downward and the return values flow back up.', zh: '每次呼叫都會等子呼叫回傳再組合結果——觀察遞迴樹往下長、回傳值再一層層往上傳。' },
      { en: 'Memoization: check a dict before recursing, store the result after computing. Repeated branches disappear from the tree.', zh: '記憶化：遞迴前先查 dict，算完把結果存起來。重複的分支就會從樹上消失。' },
    ],
    template: `memo = {}

def solve(n):
    if n < 2:
        return base
    if n in memo:
        return memo[n]
    memo[n] = combine(solve(n - 1), solve(n - 2))
    return memo[n]`,
    complexity: {
      time: 'O(2ⁿ) → O(n)',
      space: 'O(n)',
      note: { en: 'Naive Fibonacci makes exponentially many calls; with memoization each n is computed once.', zh: '沒有記憶化的費氏數列呼叫次數是指數級；加上記憶化後每個 n 只算一次。' },
    },
    pitfalls: [
      { en: 'Missing or wrong base case → infinite recursion (`RecursionError`).', zh: '缺少或寫錯終止條件 → 無窮遞迴（`RecursionError`）。' },
      { en: 'Using a mutable default argument (`memo={}`) as the cache — it is shared across calls of the function.', zh: '用可變的預設參數（`memo={}`）當快取——它會在不同次呼叫之間共用。' },
    ],
    examples: [
      {
        id: 'lc509',
        number: 509,
        title: { en: 'Fibonacci Number', zh: '費氏數列' },
        difficulty: 'easy',
        note: {
          en: 'No memoization: look how often fib(2) and fib(1) appear in the recursion tree.',
          zh: '沒有記憶化：看看遞迴樹裡 fib(2)、fib(1) 被重複算了幾次。',
        },
        code: `def fib(n: int) -> int:
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)
`,
        call: 'fib(5)',
        expected: '5',
        js: {
          code: `/**
 * @param {number} n
 * @return {number}
 */
var fib = function(n) {
    if (n < 2) {
        return n;
    }
    return fib(n - 1) + fib(n - 2);
};
`,
          call: 'fib(5)',
          expected: '5',
        },
      },
      {
        id: 'lc1137',
        number: 1137,
        title: { en: 'N-th Tribonacci Number', zh: '第 N 個泰波那契數' },
        difficulty: 'easy',
        note: {
          en: 'With memoization the second visit to a subproblem returns immediately — the tree stays small even though each call branches three ways.',
          zh: '有了記憶化，第二次遇到同一個子問題會直接回傳——即使每次呼叫分成三支，遞迴樹還是很小。',
        },
        code: `def tribonacci(n: int) -> int:
    memo = {}

    def t(k: int) -> int:
        if k < 3:
            return 1 if k else 0
        if k in memo:
            return memo[k]
        memo[k] = t(k - 1) + t(k - 2) + t(k - 3)
        return memo[k]

    return t(n)
`,
        call: 'tribonacci(6)',
        expected: '13',
        js: {
          code: `/**
 * @param {number} n
 * @return {number}
 */
var tribonacci = function(n) {
    const memo = new Map();
    const t = (k) => {
        if (k < 3) {
            return k === 0 ? 0 : 1;
        }
        if (memo.has(k)) {
            return memo.get(k);
        }
        memo.set(k, t(k - 1) + t(k - 2) + t(k - 3));
        return memo.get(k);
    };
    return t(n);
};
`,
          call: 'tribonacci(6)',
          expected: '13',
        },
      },
    ],
  },
  {
    id: 'backtracking',
    category: 'techniques',
    title: { en: 'Backtracking', zh: '回溯法' },
    tagline: {
      en: 'Build a candidate step by step; after exploring a choice, undo it and try the next one.',
      zh: '一步步建構候選解；探索完一個選擇後把它撤銷，再試下一個。',
    },
    whenToUse: [
      { en: '"Generate all" subsets, permutations, combinations.', zh: '「列出所有」子集、排列、組合。' },
      { en: 'Constraint puzzles (N-Queens, Sudoku, word search).', zh: '限制滿足問題（N 皇后、數獨、單字搜尋）。' },
      { en: 'The input is small (n ≤ ~15) — the output itself is exponential.', zh: '輸入很小（n ≤ ~15）——因為答案本身就是指數級。' },
    ],
    idea: [
      { en: 'Keep a `path` of current choices and a `result` list.', zh: '維護目前選擇的 `path` 與結果 `result`。' },
      { en: 'Choose → recurse → **un-choose** (`append` / recurse / `pop`).', zh: '選擇 → 遞迴 → **撤銷選擇**（`append` / 遞迴 / `pop`）。' },
      { en: 'Save a **copy** (`path[:]`) when recording a result.', zh: '記錄結果時要存**副本**（`path[:]`）。' },
    ],
    template: `def backtrack(start):
    result.append(path[:])
    for i in range(start, len(nums)):
        path.append(nums[i])
        backtrack(i + 1)
        path.pop()`,
    complexity: { time: 'O(2ⁿ · n) / O(n! · n)', space: 'O(n)', note: { en: 'Recursion depth is O(n), not counting the output.', zh: '不計輸出，遞迴深度為 O(n)。' } },
    pitfalls: [
      { en: '`result.append(path)` stores a reference — every entry ends up as the same (empty) list.', zh: '`result.append(path)` 存的是參照，最後每一筆都會變成同一個（空的）list。' },
      { en: 'Forgetting to undo state (`pop()`, `used[i] = False`) after the recursive call.', zh: '遞迴呼叫後忘了還原狀態（`pop()`、`used[i] = False`）。' },
    ],
    examples: [
      {
        id: 'lc78',
        number: 78,
        title: { en: 'Subsets', zh: '子集' },
        difficulty: 'medium',
        note: { en: 'Watch the depth indicator: each level of recursion decides whether to include more elements.', zh: '觀察深度指示：每一層遞迴決定要不要再加入後面的元素。' },
        code: `def subsets(nums: List[int]) -> List[List[int]]:
    result = []
    path = []

    def backtrack(start: int) -> None:
        result.append(path[:])
        for i in range(start, len(nums)):
            path.append(nums[i])
            backtrack(i + 1)
            path.pop()

    backtrack(0)
    return result
`,
        call: 'subsets([1, 2, 3])',
        expected: '[[], [1], [1, 2], [1, 2, 3], [1, 3], [2], [2, 3], [3]]',
        js: {
          code: `/**
 * @param {number[]} nums
 * @return {number[][]}
 */
var subsets = function(nums) {
    const result = [];
    const path = [];
    const backtrack = (start) => {
        result.push([...path]);
        for (let i = start; i < nums.length; i++) {
            path.push(nums[i]);
            backtrack(i + 1);
            path.pop();
        }
    };
    backtrack(0);
    return result;
};
`,
          call: 'subsets([1, 2, 3])',
          expected: '[[], [1], [1, 2], [1, 2, 3], [1, 3], [2], [2, 3], [3]]',
        },
      },
      {
        id: 'lc46',
        number: 46,
        title: { en: 'Permutations', zh: '全排列' },
        difficulty: 'medium',
        note: { en: '`used` marks which numbers are already in `path` (T = used).', zh: '`used` 標記哪些數字已經放進 `path`（T = 已使用）。' },
        code: `def permute(nums: List[int]) -> List[List[int]]:
    result = []
    path = []
    used = [False] * len(nums)

    def backtrack() -> None:
        if len(path) == len(nums):
            result.append(path[:])
            return
        for i in range(len(nums)):
            if used[i]:
                continue
            used[i] = True
            path.append(nums[i])
            backtrack()
            path.pop()
            used[i] = False

    backtrack()
    return result
`,
        call: 'permute([1, 2, 3])',
        expected: '[[1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1]]',
        js: {
          code: `/**
 * @param {number[]} nums
 * @return {number[][]}
 */
var permute = function(nums) {
    const result = [];
    const path = [];
    const used = new Array(nums.length).fill(false);
    const backtrack = () => {
        if (path.length === nums.length) {
            result.push([...path]);
            return;
        }
        for (let i = 0; i < nums.length; i++) {
            if (used[i]) {
                continue;
            }
            used[i] = true;
            path.push(nums[i]);
            backtrack();
            path.pop();
            used[i] = false;
        }
    };
    backtrack();
    return result;
};
`,
          call: 'permute([1, 2, 3])',
          expected: '[[1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1]]',
        },
      },
    ],
  },
  {
    id: 'intervals',
    category: 'techniques',
    title: { en: 'Intervals', zh: '區間問題' },
    tagline: {
      en: 'Sort intervals by start time, then sweep once while merging or counting overlaps.',
      zh: '先依起點排序，再掃一次，邊掃邊合併或計算重疊。',
    },
    whenToUse: [
      { en: 'Merging overlapping intervals or inserting a new one.', zh: '合併重疊區間、插入新區間。' },
      { en: 'Meeting rooms: how many overlap at once?', zh: '會議室問題：同時最多有幾個重疊？' },
      { en: 'Minimum number of intervals to remove to avoid overlaps.', zh: '至少移除幾個區間才能不重疊。' },
    ],
    idea: [
      { en: 'After sorting by start, an interval can only overlap with the **last** merged interval.', zh: '依起點排序後，一個區間只可能和**最後一個**合併好的區間重疊。' },
      { en: 'Overlap check: `current_start <= last_end`.', zh: '重疊判斷：`current_start <= last_end`。' },
      { en: 'Merge by extending `last_end = max(last_end, current_end)`.', zh: '合併時延伸 `last_end = max(last_end, current_end)`。' },
    ],
    complexity: { time: 'O(n log n)', space: 'O(n)' },
    pitfalls: [
      { en: 'Using `current_end` instead of `max(...)` — a short interval inside a long one would shrink it.', zh: '直接用 `current_end` 而不是 `max(...)`——長區間內的短區間會把它縮短。' },
    ],
    examples: [
      {
        id: 'lc56',
        number: 56,
        title: { en: 'Merge Intervals', zh: '合併區間' },
        difficulty: 'medium',
        note: { en: '`merged` is drawn as a grid — watch its last row grow when an overlap is found.', zh: '`merged` 以格子顯示——遇到重疊時觀察最後一列的結尾被延伸。' },
        code: `def merge(intervals: List[List[int]]) -> List[List[int]]:
    intervals.sort()
    merged = []
    for interval in intervals:
        if merged and interval[0] <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], interval[1])
        else:
            merged.append(interval[:])
    return merged
`,
        call: 'merge([[1, 3], [8, 10], [2, 6], [15, 18]])',
        expected: '[[1, 6], [8, 10], [15, 18]]',
        js: {
          code: `/**
 * @param {number[][]} intervals
 * @return {number[][]}
 */
var merge = function(intervals) {
    intervals.sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const interval of intervals) {
        const last = merged[merged.length - 1];
        if (last && interval[0] <= last[1]) {
            last[1] = Math.max(last[1], interval[1]);
        } else {
            merged.push([...interval]);
        }
    }
    return merged;
};
`,
          call: 'merge([[1, 3], [8, 10], [2, 6], [15, 18]])',
          expected: '[[1, 6], [8, 10], [15, 18]]',
          note: { en: 'JavaScript `sort()` compares strings by default, so pass `(a, b) => a[0] - b[0]` to sort by start.', zh: 'JavaScript 的 `sort()` 預設依字串比較，所以要傳入 `(a, b) => a[0] - b[0]` 依起點排序。' },
        },
      },
    ],
  },
  {
    id: 'bit-manipulation',
    category: 'techniques',
    title: { en: 'Bit Manipulation', zh: '位元運算' },
    tagline: {
      en: 'Use XOR, AND and shifts to solve problems in `O(1)` space.',
      zh: '用 XOR、AND 與位移，以 `O(1)` 空間解題。',
    },
    whenToUse: [
      { en: 'Every number appears twice except one → XOR them all.', zh: '每個數都出現兩次、只有一個例外 → 全部 XOR 起來。' },
      { en: 'Counting set bits, checking powers of two.', zh: '計算位元 1 的個數、判斷是否為 2 的次方。' },
      { en: 'Representing small sets as bitmasks.', zh: '用位元遮罩表示小集合。' },
    ],
    idea: [
      { en: '`a ^ a = 0` and `a ^ 0 = a`, so pairs cancel out.', zh: '`a ^ a = 0`、`a ^ 0 = a`，成對的數會互相抵消。' },
      { en: '`n & (n - 1)` clears the lowest set bit.', zh: '`n & (n - 1)` 會清掉最低位的 1。' },
      { en: '`format(x, "b")` shows the binary form — handy while debugging.', zh: '`format(x, "b")` 可以看二進位，除錯很好用。' },
      { en: "Negative numbers are two's complement with infinitely many 1s on the left: `-x == ~x + 1`. `& 0xFFFFFFFF` keeps only the low 32 bits, like a 32-bit integer.", zh: '負數是左邊有無限多個 1 的二補數：`-x == ~x + 1`。`& 0xFFFFFFFF` 只留下低 32 位，就像 32 位元整數。' },
    ],
    complexity: { time: 'O(n) / O(bits)', space: 'O(1)' },
    pitfalls: [
      { en: 'Python ints are unbounded — negative numbers do not behave like 32-bit integers without masking.', zh: 'Python 整數沒有位數上限，負數不做遮罩的話不會像 32 位元整數那樣運作。' },
    ],
    examples: [
      {
        id: 'lc136',
        number: 136,
        title: { en: 'Single Number', zh: '只出現一次的數字' },
        difficulty: 'easy',
        note: { en: 'Follow `bits`: pairs flip the same bits twice and vanish.', zh: '觀察 `bits`：成對的數字會把同樣的位元翻兩次，等於沒變。' },
        code: `def singleNumber(nums: List[int]) -> int:
    result = 0
    for num in nums:
        result ^= num
        bits = format(result, "04b")
    return result
`,
        call: 'singleNumber([4, 1, 2, 1, 2])',
        expected: '4',
        js: {
          code: `/**
 * @param {number[]} nums
 * @return {number}
 */
var singleNumber = function(nums) {
    let result = 0;
    for (const num of nums) {
        result ^= num;
    }
    return result;
};
`,
          call: 'singleNumber([4, 1, 2, 1, 2])',
          expected: '4',
        },
      },
      {
        id: 'lc191',
        number: 191,
        title: { en: 'Number of 1 Bits', zh: '位元 1 的個數' },
        difficulty: 'easy',
        note: { en: 'Each `n &= n - 1` removes exactly one 1-bit.', zh: '每次 `n &= n - 1` 都剛好移除一個 1。' },
        code: `def hammingWeight(n: int) -> int:
    count = 0
    while n:
        bits = format(n, "b")
        n &= n - 1
        count += 1
    return count
`,
        call: 'hammingWeight(11)',
        expected: '3',
        js: {
          code: `/**
 * @param {number} n
 * @return {number}
 */
var hammingWeight = function(n) {
    let count = 0;
    while (n !== 0) {
        n &= n - 1;
        count++;
    }
    return count;
};
`,
          call: 'hammingWeight(11)',
          expected: '3',
        },
      },
      {
        id: 'lc371',
        number: 371,
        title: { en: 'Sum of Two Integers', zh: '兩整數之和' },
        difficulty: 'medium',
        note: {
          en: 'XOR adds without carrying, `(a & b) << 1` is the carry. The mask keeps 32 bits; at the end a value above 0x7FFFFFFF is turned back into a negative number.',
          zh: 'XOR 是不進位的加法，`(a & b) << 1` 是進位。遮罩只保留 32 位；最後超過 0x7FFFFFFF 的值再轉回負數。',
        },
        code: `def getSum(a: int, b: int) -> int:
    mask = 0xFFFFFFFF
    a &= mask
    b &= mask
    while b:
        carry = ((a & b) << 1) & mask
        a = a ^ b
        b = carry
    if a > 0x7FFFFFFF:
        a = ~(a ^ mask)
    return a
`,
        call: 'getSum(2, -5)',
        expected: '-3',
        js: {
          code: `/**
 * @param {number} a
 * @param {number} b
 * @return {number}
 */
var getSum = function(a, b) {
    while (b !== 0) {
        const carry = (a & b) << 1;
        a = a ^ b;
        b = carry;
    }
    return a;
};
`,
          call: 'getSum(2, -5)',
          expected: '-3',
          note: { en: 'JavaScript bitwise operators already work on 32-bit integers, so no mask is needed — watch the negative numbers in the bits view.', zh: 'JavaScript 的位元運算本來就是 32 位元整數，不需要遮罩——看位元表裡的負數。' },
        },
      },
    ],
  },
];
