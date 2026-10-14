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
      },
    ],
  },
];
