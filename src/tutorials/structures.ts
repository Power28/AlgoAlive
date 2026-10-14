import type { Tutorial } from './types';

export const STRUCTURE_TUTORIALS: Tutorial[] = [
  {
    id: 'hash-map',
    category: 'hashing',
    title: { en: 'Hash Map Lookup', zh: '雜湊表查找' },
    tagline: {
      en: 'Trade memory for speed: remember what you have seen so each lookup is `O(1)`.',
      zh: '用空間換時間：把看過的東西記下來，之後每次查詢都是 `O(1)`。',
    },
    whenToUse: [
      { en: '"Have I seen this value (or its complement) before?"', zh: '「這個值（或它的補數）之前出現過嗎？」' },
      { en: 'Counting frequencies of characters / numbers.', zh: '統計字元或數字的出現次數。' },
      { en: 'Grouping items by a computed key (e.g. sorted letters).', zh: '依某個計算出的 key 把東西分組（例如排序後的字母）。' },
    ],
    idea: [
      { en: 'Scan once. For each element, **first** query the dict, **then** insert the element.', zh: '只掃一次：每個元素**先**查 dict，**再**把自己放進去。' },
      { en: 'Store whatever you will need later as the value (an index, a count, a list).', zh: '把之後需要的資訊存成 value（索引、次數、清單）。' },
      { en: '`collections.Counter` and `defaultdict` remove most boilerplate.', zh: '`collections.Counter` 和 `defaultdict` 可以省掉大部分樣板程式碼。' },
    ],
    template: `seen = {}
for i, x in enumerate(nums):
    if target - x in seen:
        return [seen[target - x], i]
    seen[x] = i`,
    complexity: { time: 'O(n)', space: 'O(n)' },
    pitfalls: [
      { en: 'Inserting before querying in Two Sum — an element could pair with itself.', zh: 'Two Sum 中先插入再查詢，元素可能和自己配對。' },
      { en: 'Lists are not hashable; convert to a `tuple` before using as a key.', zh: 'list 不能當 key，要先轉成 `tuple`。' },
    ],
    examples: [
      {
        id: 'lc1',
        number: 1,
        title: { en: 'Two Sum', zh: '兩數之和' },
        difficulty: 'easy',
        note: { en: 'The blue mark in `seen` shows the key that `complement` is looking up.', zh: '`seen` 中的藍色標記，就是 `complement` 正在查的那個 key。' },
        code: `def twoSum(nums: List[int], target: int) -> List[int]:
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []
`,
        call: 'twoSum([3, 8, 11, 2, 15, 7], 9)',
      },
      {
        id: 'lc242',
        number: 242,
        title: { en: 'Valid Anagram', zh: '有效的字母異位詞' },
        difficulty: 'easy',
        note: { en: 'Count up with the first string, count down with the second; any count going below zero means "not an anagram".', zh: '第一個字串加計數、第二個字串減計數；只要有計數不夠扣就不是異位詞。' },
        code: `def isAnagram(s: str, t: str) -> bool:
    if len(s) != len(t):
        return False
    count = {}
    for ch in s:
        count[ch] = count.get(ch, 0) + 1
    for ch in t:
        if count.get(ch, 0) == 0:
            return False
        count[ch] -= 1
    return True
`,
        call: 'isAnagram("anagram", "nagaram")',
      },
    ],
  },
  {
    id: 'stack',
    category: 'stack-queue',
    title: { en: 'Stack', zh: '堆疊' },
    tagline: {
      en: 'Last in, first out — perfect for matching pairs and undoing the most recent thing.',
      zh: '後進先出，最適合處理成對配對、以及「回到最近一個狀態」。',
    },
    whenToUse: [
      { en: 'Matching brackets / tags.', zh: '括號、標籤的配對。' },
      { en: 'Evaluating expressions (Reverse Polish Notation, calculators).', zh: '運算式求值（逆波蘭表示式、計算機）。' },
      { en: 'Anything where you process the most recent unfinished item first.', zh: '需要優先處理「最近一個還沒完成」的項目。' },
    ],
    idea: [
      { en: 'In Python a `list` is a stack: `append()` to push, `pop()` to pop, `stack[-1]` to peek.', zh: 'Python 的 `list` 就是堆疊：`append()` 推入、`pop()` 彈出、`stack[-1]` 查看頂端。' },
      { en: 'Push openers; when a closer arrives it must match the top.', zh: '遇到左括號就推入；遇到右括號時必須和頂端配對。' },
      { en: 'At the end the stack must be empty (nothing left unmatched).', zh: '最後堆疊必須是空的（沒有落單的元素）。' },
    ],
    template: `stack = []
for token in tokens:
    if is_open(token):
        stack.append(token)
    else:
        if not stack or not match(stack[-1], token):
            return False
        stack.pop()
return not stack`,
    complexity: { time: 'O(n)', space: 'O(n)' },
    pitfalls: [
      { en: 'Calling `stack[-1]` or `stack.pop()` on an empty stack → `IndexError`.', zh: '對空堆疊呼叫 `stack[-1]` 或 `stack.pop()` → `IndexError`。' },
      { en: 'Operand order in RPN: the first pop is the **right** operand.', zh: '逆波蘭表示式中，第一個彈出的是**右**運算元。' },
    ],
    examples: [
      {
        id: 'lc20',
        number: 20,
        title: { en: 'Valid Parentheses', zh: '有效的括號' },
        difficulty: 'easy',
        note: { en: 'The stack grows with openers and shrinks with each matching closer.', zh: '堆疊遇到左括號變長、遇到配對的右括號變短。' },
        code: `def isValid(s: str) -> bool:
    pairs = {')': '(', ']': '[', '}': '{'}
    stack = []
    for ch in s:
        if ch in pairs:
            if not stack or stack[-1] != pairs[ch]:
                return False
            stack.pop()
        else:
            stack.append(ch)
    return not stack
`,
        call: 'isValid("([{}])[]")',
      },
      {
        id: 'lc150',
        number: 150,
        title: { en: 'Evaluate Reverse Polish Notation', zh: '逆波蘭表示式求值' },
        difficulty: 'medium',
        note: { en: 'Numbers are pushed; an operator pops two numbers and pushes the result.', zh: '數字直接推入；遇到運算子就彈出兩個數，再把結果推回去。' },
        code: `def evalRPN(tokens: List[str]) -> int:
    stack = []
    for token in tokens:
        if token in {"+", "-", "*", "/"}:
            b = stack.pop()
            a = stack.pop()
            if token == "+":
                stack.append(a + b)
            elif token == "-":
                stack.append(a - b)
            elif token == "*":
                stack.append(a * b)
            else:
                stack.append(int(a / b))
        else:
            stack.append(int(token))
    return stack[0]
`,
        call: 'evalRPN(["4", "13", "5", "/", "+"])',
      },
    ],
  },
  {
    id: 'monotonic-stack',
    category: 'stack-queue',
    title: { en: 'Monotonic Stack', zh: '單調堆疊' },
    tagline: {
      en: 'Keep the stack sorted; whenever a new element breaks the order, it is the "next greater" answer for everything it pops.',
      zh: '讓堆疊保持單調；新元素破壞順序時，它就是被彈出元素的「下一個更大值」。',
    },
    whenToUse: [
      { en: '"Next greater / smaller element" for every position.', zh: '求每個位置的「下一個更大 / 更小元素」。' },
      { en: '"How many days until a warmer day", stock span, histogram areas.', zh: '「幾天後會更暖」、股票跨度、直方圖最大矩形。' },
      { en: 'A naive solution scans forward from every index (`O(n²)`).', zh: '暴力解需要從每個位置往後掃（`O(n²)`）。' },
    ],
    idea: [
      { en: 'The stack holds indices still **waiting** for their answer, in decreasing value order.', zh: '堆疊存放還在**等待**答案的索引，值由大到小排列。' },
      { en: 'A new value pops every smaller value — for each popped index, the new value is its answer.', zh: '新值會把比它小的都彈出；對每個被彈出的索引，新值就是它的答案。' },
      { en: 'Each index is pushed and popped once → `O(n)`.', zh: '每個索引只會進出堆疊各一次 → `O(n)`。' },
    ],
    template: `answer = [0] * len(nums)
stack = []
for i, x in enumerate(nums):
    while stack and nums[stack[-1]] < x:
        j = stack.pop()
        answer[j] = ...
    stack.append(i)`,
    complexity: { time: 'O(n)', space: 'O(n)' },
    pitfalls: [
      { en: 'Storing values when you need distances — store **indices** instead.', zh: '需要算距離時卻存了值——應該存**索引**。' },
      { en: '`<` vs `<=` decides how equal values are handled.', zh: '`<` 還是 `<=` 決定了相等值的處理方式。' },
    ],
    examples: [
      {
        id: 'lc739',
        number: 739,
        title: { en: 'Daily Temperatures', zh: '每日溫度' },
        difficulty: 'medium',
        note: { en: 'Notice that `stack` only ever holds indices of temperatures that are getting colder.', zh: '注意 `stack` 裡永遠只放溫度遞減的那些日子的索引。' },
        code: `def dailyTemperatures(temperatures: List[int]) -> List[int]:
    answer = [0] * len(temperatures)
    stack = []
    for i, t in enumerate(temperatures):
        while stack and temperatures[stack[-1]] < t:
            j = stack.pop()
            answer[j] = i - j
        stack.append(i)
    return answer
`,
        call: 'dailyTemperatures([73, 74, 75, 71, 69, 72, 76, 73])',
      },
      {
        id: 'lc496',
        number: 496,
        title: { en: 'Next Greater Element I', zh: '下一個更大元素 I' },
        difficulty: 'easy',
        note: { en: 'The dict records each popped value\'s next greater element for quick lookup later.', zh: 'dict 記下每個被彈出值的「下一個更大元素」，最後直接查表。' },
        code: `def nextGreaterElement(nums1: List[int], nums2: List[int]) -> List[int]:
    next_greater = {}
    stack = []
    for x in nums2:
        while stack and stack[-1] < x:
            next_greater[stack.pop()] = x
        stack.append(x)
    return [next_greater.get(x, -1) for x in nums1]
`,
        call: 'nextGreaterElement([4, 1, 2], [1, 3, 4, 2])',
      },
    ],
  },
  {
    id: 'heap',
    category: 'stack-queue',
    title: { en: 'Heap / Priority Queue', zh: '堆積 / 優先佇列' },
    tagline: {
      en: 'Always get the smallest element in `O(log n)` — ideal for "top K" and "k-th largest".',
      zh: '隨時用 `O(log n)` 取出最小元素，最適合「前 K 個」與「第 K 大」。',
    },
    whenToUse: [
      { en: '"K-th largest / smallest", "top K frequent".', zh: '「第 K 大 / 小」、「出現頻率前 K 高」。' },
      { en: 'Repeatedly taking the best candidate (Dijkstra, merging sorted lists, scheduling).', zh: '反覆取出目前最好的候選（Dijkstra、合併排序串列、排程）。' },
      { en: 'You need partial order, not a full sort.', zh: '只需要部分排序，不需要完整排序。' },
    ],
    idea: [
      { en: 'Python\'s `heapq` is a **min**-heap stored in a plain list; `heap[0]` is the smallest.', zh: 'Python 的 `heapq` 是用一般 list 存的**最小**堆積，`heap[0]` 是最小值。' },
      { en: 'For "K largest": keep a min-heap of size K; push each item and pop when size exceeds K.', zh: '求「前 K 大」：維護大小為 K 的最小堆積，每次推入，超過 K 就彈出最小的。' },
      { en: 'Push tuples `(priority, item)` to order by priority.', zh: '推入 `(priority, item)` 這種 tuple 就能依優先度排序。' },
    ],
    template: `heap = []
for x in nums:
    heapq.heappush(heap, x)
    if len(heap) > k:
        heapq.heappop(heap)
return heap[0]`,
    complexity: { time: 'O(n log k)', space: 'O(k)' },
    pitfalls: [
      { en: 'Expecting a max-heap — negate values (`-x`) to simulate one.', zh: '以為是最大堆積——要用負數 `-x` 來模擬。' },
      { en: 'The heap list is not fully sorted; only `heap[0]` is guaranteed.', zh: 'heap 這個 list 並不是完整排序的，只有 `heap[0]` 有保證。' },
    ],
    examples: [
      {
        id: 'lc215',
        number: 215,
        title: { en: 'Kth Largest Element in an Array', zh: '陣列中的第 K 個最大元素' },
        difficulty: 'medium',
        note: { en: 'The heap never grows beyond `k`; its smallest element is the answer.', zh: 'heap 的大小永遠不超過 `k`，它的最小值就是答案。' },
        code: `def findKthLargest(nums: List[int], k: int) -> int:
    heap = []
    for x in nums:
        heapq.heappush(heap, x)
        if len(heap) > k:
            heapq.heappop(heap)
    return heap[0]
`,
        call: 'findKthLargest([3, 2, 1, 5, 6, 4], 2)',
      },
      {
        id: 'lc347',
        number: 347,
        title: { en: 'Top K Frequent Elements', zh: '前 K 個高頻元素' },
        difficulty: 'medium',
        note: { en: 'Count with `Counter`, then keep the K most frequent `(freq, num)` pairs in a heap.', zh: '先用 `Counter` 計數，再用 heap 保留出現最多的 K 個 `(freq, num)`。' },
        code: `def topKFrequent(nums: List[int], k: int) -> List[int]:
    count = Counter(nums)
    heap = []
    for num, freq in count.items():
        heapq.heappush(heap, (freq, num))
        if len(heap) > k:
            heapq.heappop(heap)
    return [num for freq, num in heap]
`,
        call: 'topKFrequent([1, 1, 1, 2, 2, 3], 2)',
      },
    ],
  },
];
