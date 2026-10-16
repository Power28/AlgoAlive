import type { Tutorial } from './types';

export const MORE_TUTORIALS: Tutorial[] = [
  {
    id: 'trie',
    category: 'tree',
    title: { en: 'Trie (Prefix Tree)', zh: '字典樹（Trie）' },
    tagline: {
      en: 'Store words character by character in a tree, so words sharing a prefix share the same path.',
      zh: '把單字一個字元一個字元存進樹裡，有相同前綴的單字會共用同一條路徑。',
    },
    whenToUse: [
      { en: 'Many prefix questions: autocomplete, "does any word start with…", longest common prefix.', zh: '大量前綴相關的查詢：自動完成、「有沒有單字以…開頭」、最長公共前綴。' },
      { en: 'Building words step by step where every prefix must also be a word.', zh: '逐字元組出單字，而且每個前綴也必須是單字。' },
      { en: 'Word search on a grid with many dictionary words (prune paths that are not prefixes).', zh: '在網格上同時找很多單字（不是前綴的路徑可以直接剪掉）。' },
    ],
    idea: [
      { en: 'Each node has `children` (a dict: character → child node) and an `is_end` flag.', zh: '每個節點有 `children`（字元 → 子節點的 dict）與 `is_end` 標記。' },
      { en: 'Insert: walk from the root, creating missing children, and mark the last node `is_end = True`.', zh: '插入：從根往下走，缺的子節點就建立，最後一個節點標記 `is_end = True`。' },
      { en: 'Search / prefix: walk the same way; a missing child means the word (or prefix) is not there.', zh: '搜尋 / 前綴：用同樣方式往下走，遇到缺的子節點就代表不存在。' },
    ],
    template: `root = TrieNode()

def insert(word):
    node = root
    for ch in word:
        if ch not in node.children:
            node.children[ch] = TrieNode()
        node = node.children[ch]
    node.is_end = True`,
    complexity: { time: 'O(L) per word', space: 'O(total characters)', note: { en: 'L is the length of the word.', zh: 'L 是單字長度。' } },
    pitfalls: [
      { en: 'Forgetting `is_end` — then "app" would be found just because "apple" was inserted.', zh: '忘了 `is_end`——只插入 "apple"，查 "app" 也會被當成存在。' },
      { en: 'Moving `node` before creating the child (`node = node.children[ch]` raises KeyError).', zh: '還沒建立子節點就往下走（`node = node.children[ch]` 會 KeyError）。' },
    ],
    examples: [
      {
        id: 'lc14',
        number: 14,
        title: { en: 'Longest Common Prefix', zh: '最長公共前綴' },
        difficulty: 'easy',
        note: {
          en: 'After inserting every word, walk down while there is exactly one child and no word ends here.',
          zh: '所有單字插入後，從根往下走：只要這個節點只有一個子節點、而且沒有單字在這裡結束，就繼續往下。',
        },
        code: `def longestCommonPrefix(strs: List[str]) -> str:
    root = TrieNode()
    for word in strs:
        node = root
        for ch in word:
            if ch not in node.children:
                node.children[ch] = TrieNode()
            node = node.children[ch]
        node.is_end = True
    prefix = ""
    node = root
    while len(node.children) == 1 and not node.is_end:
        ch = next(iter(node.children))
        prefix += ch
        node = node.children[ch]
    return prefix
`,
        call: 'longestCommonPrefix(["flower", "flow", "flight"])',
        expected: '\'fl\'',
      },
      {
        id: 'lc720',
        number: 720,
        title: { en: 'Longest Word in Dictionary', zh: '詞典中最長的單字' },
        difficulty: 'medium',
        note: {
          en: 'Only walk into children marked as the end of a word, so every prefix of the answer is itself a word.',
          zh: '只往「是單字結尾」的子節點走，答案的每個前綴就一定也是單字。',
        },
        code: `def longestWord(words: List[str]) -> str:
    root = TrieNode()
    for word in words:
        node = root
        for ch in word:
            node = node.children.setdefault(ch, TrieNode())
        node.is_end = True
    best = ""
    stack = [(root, "")]
    while stack:
        node, word = stack.pop()
        if len(word) > len(best) or (len(word) == len(best) and word < best):
            best = word
        for ch, child in node.children.items():
            if child.is_end:
                stack.append((child, word + ch))
    return best
`,
        call: 'longestWord(["w", "wo", "wor", "worl", "world", "a", "ap"])',
        expected: '\'world\'',
      },
    ],
  },
  {
    id: 'matrix',
    category: 'arrays',
    title: { en: 'Matrix', zh: '矩陣' },
    tagline: {
      en: 'Treat a 2D grid as rows and columns: transform it in place with swaps, or index it like a 1D array.',
      zh: '把二維格子看成列與欄：用交換原地轉換，或把它當成一維陣列來索引。',
    },
    whenToUse: [
      { en: 'Rotating, transposing or flipping an image / board in place.', zh: '原地旋轉、轉置、翻轉圖片或棋盤。' },
      { en: 'A sorted matrix that can be searched like one long sorted array.', zh: '排序過的矩陣，可以當成一條長的排序陣列來搜尋。' },
    ],
    idea: [
      { en: 'Transpose: swap `matrix[i][j]` with `matrix[j][i]` for `j > i` only (otherwise every pair swaps back).', zh: '轉置：只在 `j > i` 時交換 `matrix[i][j]` 與 `matrix[j][i]`（否則每一對會換回去）。' },
      { en: 'Rotate 90° clockwise = transpose, then reverse every row.', zh: '順時針旋轉 90° = 先轉置，再把每一列反轉。' },
      { en: 'Index `k` of an `m × n` matrix flattened row by row is `(k // n, k % n)`.', zh: '`m × n` 矩陣逐列攤平後的第 `k` 個位置是 `(k // n, k % n)`。' },
    ],
    complexity: { time: 'O(m × n)', space: 'O(1)', note: { en: 'Binary search on the flattened matrix is O(log(m × n)).', zh: '在攤平的矩陣上做二分搜尋是 O(log(m × n))。' } },
    pitfalls: [
      { en: 'Transposing over the whole matrix instead of half — the result is the original matrix.', zh: '整個矩陣都做轉置交換而不是只做一半——結果會換回原本的矩陣。' },
      { en: 'Mixing up rows and columns: `matrix[r][c]` is row `r`, column `c`.', zh: '列與欄弄反：`matrix[r][c]` 是第 `r` 列、第 `c` 欄。' },
    ],
    examples: [
      {
        id: 'lc48',
        number: 48,
        title: { en: 'Rotate Image', zh: '旋轉圖像' },
        difficulty: 'medium',
        note: {
          en: 'Watch the cells move: first each pair swaps across the diagonal, then every row flips.',
          zh: '看格子移動：先沿著對角線兩兩交換，再把每一列左右翻轉。',
        },
        code: `def rotate(matrix: List[List[int]]) -> List[List[int]]:
    n = len(matrix)
    for i in range(n):
        for j in range(i + 1, n):
            matrix[i][j], matrix[j][i] = matrix[j][i], matrix[i][j]
    for row in matrix:
        row.reverse()
    return matrix
`,
        call: 'rotate([[1, 2, 3], [4, 5, 6], [7, 8, 9]])',
        expected: '[[7, 4, 1], [8, 5, 2], [9, 6, 3]]',
      },
      {
        id: 'lc74',
        number: 74,
        title: { en: 'Search a 2D Matrix', zh: '搜尋二維矩陣' },
        difficulty: 'medium',
        note: {
          en: 'Binary search over positions 0 … m × n - 1; `divmod(mid, n)` turns a position back into (row, column).',
          zh: '在位置 0 … m × n - 1 上做二分搜尋；`divmod(mid, n)` 把位置換回（列, 欄）。',
        },
        code: `def searchMatrix(matrix: List[List[int]], target: int) -> bool:
    m, n = len(matrix), len(matrix[0])
    lo, hi = 0, m * n - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        r, c = divmod(mid, n)
        if matrix[r][c] == target:
            return True
        elif matrix[r][c] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return False
`,
        call: 'searchMatrix([[1, 3, 5, 7], [10, 11, 16, 20], [23, 30, 34, 60]], 16)',
        expected: 'True',
      },
    ],
  },
  {
    id: 'exceptions',
    category: 'techniques',
    title: { en: 'Exceptions (try / except)', zh: '例外處理（try / except）' },
    tagline: {
      en: 'Let a conversion or a deep helper fail, and decide in one place what happens when it does.',
      zh: '讓轉換或深層的輔助函式直接出錯，再在一個地方決定出錯時要怎麼辦。',
    },
    whenToUse: [
      { en: 'Parsing / validating input: `int(s)`, `float(s)` raise ValueError on bad text.', zh: '解析、驗證輸入：`int(s)`、`float(s)` 遇到不合法的字串會拋出 ValueError。' },
      { en: 'A helper deep in the call stack finds an invalid case — `raise` and let the caller stop everything.', zh: '呼叫堆疊深處的輔助函式發現不合法——直接 `raise`，讓外層一次停下來。' },
      { en: 'Cleanup that must always run (closing, restoring state): put it in `finally`.', zh: '一定要執行的收尾（關閉、恢復狀態）：放在 `finally`。' },
    ],
    idea: [
      { en: 'When a line raises, Python leaves the try block right away and checks each `except` from top to bottom; the first match handles it.', zh: '某一行出錯時，Python 立刻離開 try 區塊，由上往下比對每個 `except`，第一個符合的負責處理。' },
      { en: 'No match (or no try at all) → the exception leaves the function and is raised again at the caller\'s line, and so on outward.', zh: '沒有符合的（或根本沒有 try）→ 例外離開這個函式，在呼叫者那一行再次拋出，一路往外。' },
      { en: '`else` runs only when the try block finished without an exception; `finally` runs in every case.', zh: '`else` 只在 try 區塊沒出錯時執行；`finally` 不論如何都會執行。' },
    ],
    template: `try:
    value = int(text)
except ValueError:
    value = 0          # 出錯時
else:
    value += 1         # 沒出錯時
finally:
    print("done")      # 一定會執行`,
    complexity: { time: 'O(1) extra', space: 'O(1)', note: { en: 'A try block costs almost nothing when nothing is raised.', zh: '沒有拋出例外時，try 幾乎沒有額外成本。' } },
    pitfalls: [
      { en: 'A bare `except:` also catches bugs such as NameError or KeyboardInterrupt — catch the specific exception.', zh: '只寫 `except:` 會連 NameError、KeyboardInterrupt 這類錯誤也接住——要指定例外型別。' },
      { en: 'Order matters: put the more specific `except` first; a broad one above it hides it.', zh: '順序很重要：較精確的 `except` 放前面，寬鬆的放在上面會把它擋掉。' },
      { en: 'Putting too much code in the try block can swallow exceptions you did not expect.', zh: 'try 區塊放太多程式碼，可能會吞掉沒預料到的例外。' },
    ],
    examples: [
      {
        id: 'lc468',
        number: 468,
        title: { en: 'Validate IP Address', zh: '驗證 IP 位址' },
        difficulty: 'medium',
        note: {
          en: 'The helpers only `raise`; the exception travels out of the helper and is caught once in the caller.',
          zh: '輔助函式只負責 `raise`；例外從輔助函式丟出來，在外層一次接住。',
        },
        code: `def validIPAddress(queryIP: str) -> str:
    def check_v4(part):
        if str(int(part)) != part or not 0 <= int(part) <= 255:
            raise ValueError("bad part: " + part)

    def check_v6(part):
        if not 1 <= len(part) <= 4 or "-" in part:
            raise ValueError("bad part: " + part)
        int(part, 16)

    try:
        if queryIP.count(".") == 3:
            for part in queryIP.split("."):
                check_v4(part)
            return "IPv4"
        if queryIP.count(":") == 7:
            for part in queryIP.split(":"):
                check_v6(part)
            return "IPv6"
    except ValueError:
        pass
    return "Neither"
`,
        call: 'validIPAddress("192.168.01.1")',
        expected: '\'Neither\'',
      },
      {
        id: 'lc65',
        number: 65,
        title: { en: 'Valid Number', zh: '有效數字' },
        difficulty: 'hard',
        note: {
          en: 'Let `float()` do the parsing; Python also accepts "inf" / "nan", so rule those out first.',
          zh: '交給 `float()` 解析；Python 也接受 "inf" / "nan"，所以先把它們排除。',
        },
        code: `def isNumber(s: str) -> bool:
    lower = s.lower()
    if "inf" in lower or "nan" in lower:
        return False
    try:
        float(s)
    except ValueError:
        return False
    else:
        return True
`,
        call: 'isNumber("1e1.5")',
        expected: 'False',
      },
    ],
  },
  {
    id: 'builtins',
    category: 'techniques',
    title: { en: 'Built-in Functions', zh: '內建函式' },
    tagline: {
      en: 'sum, min, max, sorted, any, all, zip, enumerate… replace whole loops with one call — know what each one does inside.',
      zh: 'sum、min、max、sorted、any、all、zip、enumerate……一個呼叫就取代整個迴圈——要知道它們在裡面做了什麼。',
    },
    whenToUse: [
      { en: 'Aggregates over a whole sequence: total, smallest, largest, "is every / any item …".', zh: '對整個序列做彙總：總和、最小、最大、「是不是每個 / 有沒有任何一個……」。' },
      { en: 'Sorting by a custom rule with `key=`, e.g. intervals by start: `intervals.sort(key=lambda x: x[0])`.', zh: '用 `key=` 自訂排序規則，例如區間依起點排序：`intervals.sort(key=lambda x: x[0])`。' },
      { en: 'Walking several sequences together (`zip`) or with indexes (`enumerate`).', zh: '同時走訪多個序列（`zip`）或連同索引一起走訪（`enumerate`）。' },
    ],
    idea: [
      { en: '`sum` adds one by one; `min` / `max` compare one by one and keep the first best item.', zh: '`sum` 一個一個加；`min` / `max` 逐一比較，留下最先出現的最佳元素。' },
      { en: '`sorted(x)` returns a new list; `x.sort()` sorts in place and returns None. Both are stable.', zh: '`sorted(x)` 回傳新的 list；`x.sort()` 原地排序、回傳 None。兩者都是穩定排序。' },
      { en: '`any` stops at the first True, `all` at the first False — later items are never looked at.', zh: '`any` 遇到第一個 True 就停，`all` 遇到第一個 False 就停——後面的元素完全不會被看。' },
      { en: '`zip` stops when the shortest sequence runs out.', zh: '`zip` 在最短的序列用完時就停。' },
    ],
    template: `total = sum(nums)
largest = max(nums)
longest = max(words, key=len)
ordered = sorted(nums, reverse=True)
ok = all(a <= b for a, b in zip(nums, nums[1:]))
for i, x in enumerate(nums):
    ...`,
    complexity: { time: 'O(n); sorting O(n log n)', space: 'O(1); sorted O(n)', note: { en: 'Each call still walks the data — calling max() inside a loop makes it O(n²).', zh: '每個呼叫仍然要走訪資料——在迴圈裡呼叫 max() 會變成 O(n²)。' } },
    pitfalls: [
      { en: '`x = x.sort()` sets x to None — use `x.sort()` alone, or `x = sorted(x)`.', zh: '`x = x.sort()` 會讓 x 變成 None——單獨寫 `x.sort()`，或用 `x = sorted(x)`。' },
      { en: '`max([])` raises ValueError; pass `default=` when the sequence can be empty.', zh: '`max([])` 會拋出 ValueError；序列可能是空的時候要給 `default=`。' },
      { en: '`sorted("bca")` returns a list of characters — join it back with `"".join(...)`.', zh: '`sorted("bca")` 回傳字元的 list——要用 `"".join(...)` 接回字串。' },
    ],
    examples: [
      {
        id: 'lc49',
        number: 49,
        title: { en: 'Group Anagrams', zh: '字母異位詞分組' },
        difficulty: 'medium',
        note: {
          en: 'Anagrams become the same string after sorting their letters, so that sorted string is the group key.',
          zh: '異位詞把字母排序後會變成同一個字串，所以用排序後的字串當分組的 key。',
        },
        code: `def groupAnagrams(strs: List[str]) -> List[List[str]]:
    groups = {}
    for s in strs:
        key = "".join(sorted(s))
        if key not in groups:
            groups[key] = []
        groups[key].append(s)
    return list(groups.values())
`,
        call: 'groupAnagrams(["eat", "tea", "tan", "ate", "nat", "bat"])',
        expected: '[[\'eat\', \'tea\', \'ate\'], [\'tan\', \'nat\'], [\'bat\']]',
      },
      {
        id: 'lc896',
        number: 896,
        title: { en: 'Monotonic Array', zh: '單調數列' },
        difficulty: 'easy',
        note: {
          en: '`zip(nums, nums[1:])` pairs each number with the next one; `all` stops at the first pair that breaks the order.',
          zh: '`zip(nums, nums[1:])` 把每個數字和下一個配成一組；`all` 遇到第一組順序不對的就停。',
        },
        code: `def isMonotonic(nums: List[int]) -> bool:
    increasing = all(a <= b for a, b in zip(nums, nums[1:]))
    decreasing = all(a >= b for a, b in zip(nums, nums[1:]))
    return increasing or decreasing
`,
        call: 'isMonotonic([6, 5, 4, 4])',
        expected: 'True',
      },
      {
        id: 'lc1984',
        number: 1984,
        title: { en: 'Minimum Difference Between Highest and Lowest of K Scores', zh: '學生分數的最小差值' },
        difficulty: 'easy',
        note: {
          en: 'After sorting, the best k scores are always next to each other: check every window of k.',
          zh: '排序後，最好的 k 個分數一定相鄰：檢查每個長度 k 的區間。',
        },
        code: `def minimumDifference(nums: List[int], k: int) -> int:
    nums.sort()
    return min(nums[i + k - 1] - nums[i] for i in range(len(nums) - k + 1))
`,
        call: 'minimumDifference([9, 4, 1, 7], 2)',
        expected: '2',
      },
    ],
  },
  {
    id: 'design',
    category: 'techniques',
    title: { en: 'Design Problems', zh: '設計類題目' },
    tagline: {
      en: 'Implement a class whose methods are called in a given order; the state lives in self between calls.',
      zh: '實作一個類別，題目會依序呼叫它的方法；每次呼叫之間的狀態都存在 self 上。',
    },
    whenToUse: [
      { en: 'Problems that start with "Design…" / "Implement…": MinStack, LRU Cache, Trie, queues from stacks.', zh: '題目以「設計……」「實作……」開頭：最小堆疊、LRU 快取、字典樹、用堆疊實作佇列。' },
      { en: 'The input is two arrays: the method names and the arguments of each call.', zh: '測資是兩個陣列：方法名稱，以及每次呼叫的參數。' },
    ],
    idea: [
      { en: 'Decide what `__init__` stores in self so that every method stays fast.', zh: '先決定 `__init__` 要在 self 上存哪些資料，讓每個方法都夠快。' },
      { en: 'Paste LeetCode\'s two arrays as the test call — AlgoAlive creates the object, calls each method in order and returns the outputs.', zh: '把 LeetCode 的兩個陣列直接貼到測試呼叫——AlgoAlive 會建立物件、依序呼叫每個方法，並回傳每個操作的輸出。' },
      { en: 'Often a second structure keeps extra information up to date (the current minimum, the usage order…).', zh: '常見做法是多維護一個結構來隨時更新額外資訊（目前的最小值、使用順序……）。' },
    ],
    template: `class MyStructure:
    def __init__(self):
        self.data = []

    def add(self, x: int) -> None:
        self.data.append(x)

# 測試呼叫：
# ["MyStructure", "add", "add"], [[], [1], [2]]`,
    complexity: { time: 'per method, often O(1)', space: 'O(n)', note: { en: 'Each method is judged on its own cost.', zh: '每個方法各自計算成本。' } },
    pitfalls: [
      { en: 'Forgetting `self.` — a plain local variable disappears when the method returns.', zh: '忘了寫 `self.`——一般的區域變數在方法結束後就消失了。' },
      { en: 'Keeping the helper structure in sync on every operation (e.g. pop must also update the minimum).', zh: '每個操作都要同步更新輔助結構（例如 pop 也要更新最小值）。' },
    ],
    examples: [
      {
        id: 'lc155',
        number: 155,
        title: { en: 'Min Stack', zh: '最小堆疊' },
        difficulty: 'medium',
        note: {
          en: '`self.mins` only grows when a new minimum arrives, so its top is always the current minimum.',
          zh: '`self.mins` 只在出現新的最小值時才放入，所以它的頂端永遠是目前的最小值。',
        },
        code: `class MinStack:
    def __init__(self):
        self.stack = []
        self.mins = []

    def push(self, val: int) -> None:
        self.stack.append(val)
        if not self.mins or val <= self.mins[-1]:
            self.mins.append(val)

    def pop(self) -> None:
        val = self.stack.pop()
        if val == self.mins[-1]:
            self.mins.pop()

    def top(self) -> int:
        return self.stack[-1]

    def getMin(self) -> int:
        return self.mins[-1]
`,
        call: '["MinStack", "push", "push", "push", "getMin", "pop", "top", "getMin"], [[], [-2], [0], [-3], [], [], [], []]',
        expected: '[None, None, None, None, -3, None, 0, -2]',
      },
      {
        id: 'lc232',
        number: 232,
        title: { en: 'Implement Queue using Stacks', zh: '用堆疊實作佇列' },
        difficulty: 'easy',
        note: {
          en: 'Only when `outbox` is empty, pour everything from `inbox` into it — the order flips, so the oldest item ends up on top.',
          zh: '只有 `outbox` 空了才把 `inbox` 全部倒過去——順序會反過來，最早放入的就到了頂端。',
        },
        code: `class MyQueue:
    def __init__(self):
        self.inbox = []
        self.outbox = []

    def push(self, x: int) -> None:
        self.inbox.append(x)

    def pop(self) -> int:
        self.peek()
        return self.outbox.pop()

    def peek(self) -> int:
        if not self.outbox:
            while self.inbox:
                self.outbox.append(self.inbox.pop())
        return self.outbox[-1]

    def empty(self) -> bool:
        return not self.inbox and not self.outbox
`,
        call: '["MyQueue", "push", "push", "push", "peek", "pop", "push", "pop", "empty"], [[], [1], [2], [3], [], [], [4], [], []]',
        expected: '[None, None, None, None, 1, 1, None, 2, False]',
      },
      {
        id: 'lc146',
        number: 146,
        title: { en: 'LRU Cache', zh: 'LRU 快取' },
        difficulty: 'medium',
        note: {
          en: 'The OrderedDict keeps keys from least to most recently used: `move_to_end` marks a key as fresh, `popitem(last=False)` evicts the stalest.',
          zh: 'OrderedDict 依「最久沒用 → 最近使用」排列：`move_to_end` 把 key 標成最新，`popitem(last=False)` 淘汰最久沒用的。',
        },
        code: `class LRUCache:
    def __init__(self, capacity: int):
        self.capacity = capacity
        self.cache = OrderedDict()

    def get(self, key: int) -> int:
        if key not in self.cache:
            return -1
        self.cache.move_to_end(key)
        return self.cache[key]

    def put(self, key: int, value: int) -> None:
        if key in self.cache:
            self.cache.move_to_end(key)
        self.cache[key] = value
        if len(self.cache) > self.capacity:
            self.cache.popitem(last=False)
`,
        call: '["LRUCache", "put", "put", "get", "put", "get", "put", "get", "get", "get"], [[2], [1, 1], [2, 2], [1], [3, 3], [2], [4, 4], [1], [3], [4]]',
        expected: '[None, None, None, 1, None, -1, None, -1, 3, 4]',
      },
    ],
  },
  {
    id: 'javascript',
    category: 'techniques',
    title: { en: 'JavaScript Basics', zh: 'JavaScript 入門' },
    tagline: {
      en: 'The same algorithms in JavaScript: Map / Set, linked lists from JSDoc types, and classes for design problems.',
      zh: '用 JavaScript 寫同樣的演算法：Map / Set、依 JSDoc 型別建立鏈結串列、用 class 寫設計類題目。',
    },
    whenToUse: [
      { en: 'Pick JavaScript in the language menu above the editor; the LeetCode JavaScript template runs as is.', zh: '在編輯器上方的語言選單選 JavaScript；LeetCode 的 JavaScript 範本可以直接執行。' },
      { en: 'Test calls work the same way: twoSum([2,7,11,15], 9) or nums = [2,7,11,15], target = 9.', zh: '測試呼叫的寫法相同：twoSum([2,7,11,15], 9) 或 nums = [2,7,11,15], target = 9。' },
    ],
    idea: [
      { en: '`Map` is the hash map: `has`, `get`, `set`. Plain objects work too, but Map keeps number keys as numbers.', zh: '`Map` 就是雜湊表：`has`、`get`、`set`。一般物件也可以，但 Map 的數字 key 不會被轉成字串。' },
      { en: 'LeetCode marks node parameters with JSDoc (`@param {ListNode} head`), so `head = [1,2,3]` becomes a linked list automatically.', zh: 'LeetCode 用 JSDoc 標記節點參數（`@param {ListNode} head`），所以 `head = [1,2,3]` 會自動變成鏈結串列。' },
      { en: 'Design problems keep their state on `this` (`this.stack`), shown as variables.', zh: '設計類題目的狀態放在 `this` 上（`this.stack`），會顯示成變數。' },
    ],
    complexity: { time: 'same as Python', space: 'same as Python' },
    pitfalls: [
      { en: 'Use `===` instead of `==` to avoid type conversion.', zh: '用 `===` 而不是 `==`，避免自動轉型。' },
      { en: 'Arrays have no negative index: use `arr[arr.length - 1]` (or `arr.at(-1)`) for the last item.', zh: '陣列沒有負數索引：最後一個元素要寫 `arr[arr.length - 1]`（或 `arr.at(-1)`）。' },
      { en: '`sort()` compares as strings by default — pass `(a, b) => a - b` for numbers.', zh: '`sort()` 預設依字串比較——數字要傳入 `(a, b) => a - b`。' },
    ],
    examples: [
      {
        id: 'js1',
        number: 1,
        title: { en: 'Two Sum (JavaScript)', zh: '兩數之和（JavaScript）' },
        difficulty: 'easy',
        language: 'javascript',
        note: { en: 'The Map remembers each number\'s index; look up `target - nums[i]` before adding the current one.', zh: 'Map 記住每個數字的索引；先查 `target - nums[i]`，再放入目前這個數。' },
        code: `/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number[]}
 */
var twoSum = function(nums, target) {
    const seen = new Map();
    for (let i = 0; i < nums.length; i++) {
        const need = target - nums[i];
        if (seen.has(need)) {
            return [seen.get(need), i];
        }
        seen.set(nums[i], i);
    }
    return [];
};
`,
        call: 'nums = [2,7,11,15], target = 9',
        expected: '[0, 1]',
      },
      {
        id: 'js206',
        number: 206,
        title: { en: 'Reverse Linked List (JavaScript)', zh: '反轉鏈結串列（JavaScript）' },
        difficulty: 'easy',
        language: 'javascript',
        note: { en: '`head = [1,2,3,4,5]` becomes a linked list because of `@param {ListNode} head`.', zh: '因為 `@param {ListNode} head`，`head = [1,2,3,4,5]` 會自動變成鏈結串列。' },
        code: `/**
 * Definition for singly-linked list.
 * function ListNode(val, next) {
 *     this.val = (val===undefined ? 0 : val)
 *     this.next = (next===undefined ? null : next)
 * }
 */
/**
 * @param {ListNode} head
 * @return {ListNode}
 */
var reverseList = function(head) {
    let prev = null;
    let curr = head;
    while (curr) {
        const next = curr.next;
        curr.next = prev;
        prev = curr;
        curr = next;
    }
    return prev;
};
`,
        call: 'head = [1,2,3,4,5]',
        expected: '5 → 4 → 3 → 2 → 1',
      },
      {
        id: 'js155',
        number: 155,
        title: { en: 'Min Stack (JavaScript)', zh: '最小堆疊（JavaScript）' },
        difficulty: 'medium',
        language: 'javascript',
        note: { en: 'A class keeps the state on `this`; the test call is LeetCode\'s two arrays.', zh: '用 class 把狀態放在 `this` 上；測試呼叫是 LeetCode 的兩個陣列。' },
        code: `class MinStack {
    constructor() {
        this.stack = [];
        this.mins = [];
    }

    push(val) {
        this.stack.push(val);
        if (this.mins.length === 0 || val <= this.mins[this.mins.length - 1]) {
            this.mins.push(val);
        }
    }

    pop() {
        const val = this.stack.pop();
        if (val === this.mins[this.mins.length - 1]) {
            this.mins.pop();
        }
    }

    top() {
        return this.stack[this.stack.length - 1];
    }

    getMin() {
        return this.mins[this.mins.length - 1];
    }
}
`,
        call: '["MinStack","push","push","push","getMin","pop","top","getMin"], [[],[-2],[0],[-3],[],[],[],[]]',
        expected: '[null, null, null, null, -3, null, 0, -2]',
      },
      {
        id: 'js1984',
        number: 1984,
        title: { en: 'Minimum Difference of K Scores (JavaScript)', zh: '學生分數的最小差值（JavaScript）' },
        difficulty: 'easy',
        language: 'javascript',
        note: {
          en: 'Watch `sort` slide the scores into place — without `(a, b) => a - b` JavaScript would sort them as strings.',
          zh: '看 `sort` 把分數滑到排序後的位置——沒有 `(a, b) => a - b` 的話，JavaScript 會依字串排序。',
        },
        code: `/**
 * @param {number[]} nums
 * @param {number} k
 * @return {number}
 */
var minimumDifference = function(nums, k) {
    nums.sort((a, b) => a - b);
    const diffs = [];
    for (let i = 0; i + k - 1 < nums.length; i++) {
        diffs.push(nums[i + k - 1] - nums[i]);
    }
    return Math.min(...diffs);
};
`,
        call: 'nums = [9,4,1,7], k = 2',
        expected: '2',
      },
    ],
  },
];
