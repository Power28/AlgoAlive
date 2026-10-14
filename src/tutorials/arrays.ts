import type { Tutorial } from './types';

export const ARRAY_TUTORIALS: Tutorial[] = [
  {
    id: 'two-pointers',
    category: 'arrays',
    title: { en: 'Two Pointers (Opposite Ends)', zh: '對撞雙指針' },
    tagline: {
      en: 'Start one pointer at each end and move them toward each other, discarding part of the search space every step.',
      zh: '兩個指針分別從頭尾出發、往中間靠攏，每一步都排除掉一部分不可能的答案。',
    },
    whenToUse: [
      { en: 'The array is **sorted** (or sorting it does not break the problem).', zh: '陣列**已排序**（或排序後不影響題意）。' },
      { en: 'You are looking for a **pair** that satisfies a condition (sum, area, difference…).', zh: '要找一**對**元素滿足某條件（總和、面積、差值…）。' },
      { en: 'A brute-force `O(n²)` double loop is too slow.', zh: '暴力雙層迴圈 `O(n²)` 太慢。' },
    ],
    idea: [
      { en: 'Put `left = 0` and `right = n - 1`.', zh: '設定 `left = 0`、`right = n - 1`。' },
      { en: 'Look at the pair `(left, right)` and decide which side **cannot** be part of a better answer.', zh: '看 `(left, right)` 這一對，判斷哪一邊**不可能**組成更好的答案。' },
      { en: 'Move that pointer inward. Stop when the pointers meet.', zh: '把那一邊的指針往內移，直到兩指針相遇。' },
      { en: 'Each step removes one element from consideration, so the whole scan is `O(n)`.', zh: '每一步都淘汰一個元素，所以整體只要 `O(n)`。' },
    ],
    template: `left, right = 0, len(nums) - 1
while left < right:
    if good(nums[left], nums[right]):
        return answer
    elif need_bigger:
        left += 1
    else:
        right -= 1`,
    complexity: { time: 'O(n)', space: 'O(1)' },
    pitfalls: [
      { en: 'Using `left <= right` when the two pointers must point to **different** elements.', zh: '題目要求兩個**不同**元素時，迴圈條件誤寫成 `left <= right`。' },
      { en: 'Forgetting the problem asks for **1-indexed** answers (e.g. 167).', zh: '忘記題目要求回傳 **1-indexed** 的位置（例如 167 題）。' },
    ],
    examples: [
      {
        id: 'lc167',
        number: 167,
        title: { en: 'Two Sum II - Input Array Is Sorted', zh: '兩數之和 II - 輸入有序陣列' },
        difficulty: 'medium',
        note: {
          en: 'Sum too small → only moving `left` right can increase it. Too big → move `right` left.',
          zh: '總和太小 → 只有把 `left` 右移才會變大；太大 → 把 `right` 左移。',
        },
        code: `def twoSum(numbers: List[int], target: int) -> List[int]:
    left, right = 0, len(numbers) - 1
    while left < right:
        current_sum = numbers[left] + numbers[right]
        if current_sum == target:
            return [left + 1, right + 1]
        elif current_sum < target:
            left += 1
        else:
            right -= 1
    return []
`,
        call: 'twoSum([1, 3, 4, 5, 7, 10, 11], 9)',
        expected: '[3, 4]',
      },
      {
        id: 'lc11',
        number: 11,
        title: { en: 'Container With Most Water', zh: '盛最多水的容器' },
        difficulty: 'medium',
        note: {
          en: 'The shorter wall limits the area, so moving the taller wall can never help — always move the shorter one.',
          zh: '面積被較矮的那面牆限制，移動較高的牆不可能更好，所以永遠移動較矮的那邊。',
        },
        code: `def maxArea(height: List[int]) -> int:
    left, right = 0, len(height) - 1
    best = 0
    while left < right:
        width = right - left
        area = min(height[left], height[right]) * width
        best = max(best, area)
        if height[left] < height[right]:
            left += 1
        else:
            right -= 1
    return best
`,
        call: 'maxArea([1, 8, 6, 2, 5, 4, 8, 3, 7])',
        expected: '49',
      },
    ],
  },
  {
    id: 'fast-slow',
    category: 'arrays',
    title: { en: 'Fast & Slow Pointers (In-place)', zh: '快慢指針（原地修改）' },
    tagline: {
      en: '`fast` scans every element; `slow` marks where the next element you want to keep should be written.',
      zh: '`fast` 負責掃過每個元素，`slow` 標記下一個要保留的元素該寫到哪裡。',
    },
    whenToUse: [
      { en: 'You must modify the array **in place** with `O(1)` extra space.', zh: '題目要求**原地**修改陣列、只能用 `O(1)` 額外空間。' },
      { en: 'You are filtering, compacting or de-duplicating elements.', zh: '要過濾、壓縮或去除重複元素。' },
      { en: 'The relative order of kept elements must be preserved.', zh: '保留下來的元素要維持原本的相對順序。' },
    ],
    idea: [
      { en: '`slow` = length of the "good" prefix built so far.', zh: '`slow` 代表目前已整理好的「有效前綴」長度。' },
      { en: '`fast` walks the whole array. When `nums[fast]` should be kept, write (or swap) it to `nums[slow]` and advance `slow`.', zh: '`fast` 走完整個陣列；遇到要保留的 `nums[fast]`，就寫入（或交換）到 `nums[slow]`，然後 `slow` 前進。' },
      { en: 'Everything before `slow` is final; everything between `slow` and `fast` is garbage to overwrite.', zh: '`slow` 之前都是最終答案；`slow` 到 `fast` 之間是可以被覆蓋的區域。' },
    ],
    template: `slow = 0
for fast in range(len(nums)):
    if keep(nums[fast]):
        nums[slow] = nums[fast]
        slow += 1
return slow`,
    complexity: { time: 'O(n)', space: 'O(1)' },
    pitfalls: [
      { en: 'Swapping vs. overwriting: swap when the discarded values must stay in the array (Move Zeroes); overwrite when they don\'t matter (Remove Duplicates).', zh: '交換還是覆寫：被丟棄的值仍要留在陣列裡就用交換（移動零），不重要就直接覆寫（刪除重複項）。' },
      { en: 'Returning the array when the problem asks for the new **length** (or vice versa).', zh: '題目要回傳新**長度**，卻回傳了陣列（或反過來）。' },
    ],
    examples: [
      {
        id: 'lc283',
        number: 283,
        title: { en: 'Move Zeroes', zh: '移動零' },
        difficulty: 'easy',
        note: { en: 'Watch the non-zero values get swapped forward while the zeros drift to the end.', zh: '觀察非零值一個個被換到前面，零自然被擠到最後。' },
        code: `def moveZeroes(nums: List[int]) -> List[int]:
    slow = 0
    for fast in range(len(nums)):
        if nums[fast] != 0:
            nums[slow], nums[fast] = nums[fast], nums[slow]
            slow += 1
    return nums
`,
        call: 'moveZeroes([0, 1, 0, 3, 12])',
        expected: '[1, 3, 12, 0, 0]',
      },
      {
        id: 'lc26',
        number: 26,
        title: { en: 'Remove Duplicates from Sorted Array', zh: '刪除有序陣列中的重複項' },
        difficulty: 'easy',
        note: { en: 'Because the array is sorted, a new value only appears when `nums[fast] != nums[fast - 1]`.', zh: '因為陣列已排序，只有 `nums[fast] != nums[fast - 1]` 時才是新的值。' },
        code: `def removeDuplicates(nums: List[int]) -> int:
    slow = 1
    for fast in range(1, len(nums)):
        if nums[fast] != nums[fast - 1]:
            nums[slow] = nums[fast]
            slow += 1
    return slow
`,
        call: 'removeDuplicates([0, 0, 1, 1, 1, 2, 2, 3, 3, 4])',
        expected: '5',
      },
    ],
  },
  {
    id: 'sliding-window',
    category: 'arrays',
    title: { en: 'Sliding Window', zh: '滑動視窗' },
    tagline: {
      en: 'Maintain a contiguous window `[left, right]`: grow it with `right`, shrink it with `left`, and update the answer along the way.',
      zh: '維護一個連續區間 `[left, right]`：用 `right` 擴張、用 `left` 收縮，過程中更新答案。',
    },
    whenToUse: [
      { en: 'The question is about a **contiguous** subarray or substring.', zh: '問的是**連續**的子陣列或子字串。' },
      { en: 'Keywords: "longest", "shortest", "at most K", "without repeating".', zh: '關鍵字：「最長」、「最短」、「最多 K 個」、「不重複」。' },
      { en: 'Extending the window only makes a condition "more true" (monotonic), so shrinking from the left is safe.', zh: '視窗變大時條件只會單調變化，所以從左邊收縮是安全的。' },
    ],
    idea: [
      { en: 'Move `right` one step at a time and add `nums[right]` into the window state (a sum, a dict, a set…).', zh: '`right` 每次前進一格，把 `nums[right]` 加進視窗狀態（總和、dict、set…）。' },
      { en: 'While the window breaks (or satisfies) the condition, remove `nums[left]` and move `left` right.', zh: '當視窗不合法（或已滿足條件）時，移除 `nums[left]` 並讓 `left` 右移。' },
      { en: 'Each element enters and leaves the window at most once → `O(n)`.', zh: '每個元素最多進出視窗各一次 → `O(n)`。' },
    ],
    template: `left = 0
for right in range(len(nums)):
    add(nums[right])
    while window_invalid():
        remove(nums[left])
        left += 1
    best = max(best, right - left + 1)`,
    complexity: { time: 'O(n)', space: 'O(1) – O(k)', note: { en: 'Space depends on what the window tracks (a sum vs. a dict of counts).', zh: '空間取決於視窗要記錄什麼（單純總和或字元計數 dict）。' } },
    pitfalls: [
      { en: 'Using `if` instead of `while` when shrinking — one shrink step may not be enough.', zh: '收縮時用 `if` 而不是 `while`，只縮一步可能不夠。' },
      { en: 'Updating the answer at the wrong moment (before vs. after shrinking).', zh: '更新答案的時機錯誤（收縮前 vs. 收縮後）。' },
    ],
    examples: [
      {
        id: 'lc209',
        number: 209,
        title: { en: 'Minimum Size Subarray Sum', zh: '長度最小的子陣列' },
        difficulty: 'medium',
        note: { en: 'Shrink while the sum is still ≥ target; every valid window is a candidate for the minimum.', zh: '只要總和仍 ≥ target 就繼續收縮，每個合法視窗都是最短長度的候選。' },
        code: `def minSubArrayLen(target: int, nums: List[int]) -> int:
    left = 0
    window_sum = 0
    best = float('inf')
    for right in range(len(nums)):
        window_sum += nums[right]
        while window_sum >= target:
            best = min(best, right - left + 1)
            window_sum -= nums[left]
            left += 1
    return 0 if best == float('inf') else best
`,
        call: 'minSubArrayLen(7, [2, 3, 1, 2, 4, 3])',
        expected: '2',
      },
      {
        id: 'lc3',
        number: 3,
        title: { en: 'Longest Substring Without Repeating Characters', zh: '無重複字元的最長子字串' },
        difficulty: 'medium',
        note: { en: 'Instead of shrinking one by one, jump `left` past the previous occurrence of the repeated character.', zh: '不用一格一格收縮：直接把 `left` 跳到重複字元上次出現位置的下一格。' },
        code: `def lengthOfLongestSubstring(s: str) -> int:
    last_seen = {}
    left = 0
    best = 0
    for right, ch in enumerate(s):
        if ch in last_seen and last_seen[ch] >= left:
            left = last_seen[ch] + 1
        last_seen[ch] = right
        best = max(best, right - left + 1)
    return best
`,
        call: 'lengthOfLongestSubstring("abcabcbb")',
        expected: '3',
      },
    ],
  },
  {
    id: 'binary-search',
    category: 'arrays',
    title: { en: 'Binary Search', zh: '二分搜尋' },
    tagline: {
      en: 'Halve the search range every step by checking the middle element.',
      zh: '每一步檢查中間元素，把搜尋範圍砍掉一半。',
    },
    whenToUse: [
      { en: 'The data is **sorted**, or the answer space is monotonic ("if x works, every bigger x works").', zh: '資料**已排序**，或答案空間具單調性（「x 可行，則更大的 x 也可行」）。' },
      { en: 'The constraints hint at `O(log n)`.', zh: '題目限制暗示需要 `O(log n)`。' },
      { en: 'You need the first/last position where a condition becomes true.', zh: '要找條件第一次（或最後一次）成立的位置。' },
    ],
    idea: [
      { en: 'Keep a range `[lo, hi]` that must contain the answer.', zh: '維護一個一定包含答案的範圍 `[lo, hi]`。' },
      { en: 'Compute `mid`, compare, and throw away the half that cannot contain the answer.', zh: '算出 `mid` 並比較，丟掉不可能包含答案的那一半。' },
      { en: 'Pick **one** convention (closed `[lo, hi]` or half-open `[lo, hi)`) and keep every update consistent with it.', zh: '選定**一種**區間寫法（閉區間 `[lo, hi]` 或左閉右開 `[lo, hi)`），所有更新都要跟它一致。' },
    ],
    template: `lo, hi = 0, len(nums) - 1
while lo <= hi:
    mid = (lo + hi) // 2
    if nums[mid] == target:
        return mid
    elif nums[mid] < target:
        lo = mid + 1
    else:
        hi = mid - 1
return -1`,
    complexity: { time: 'O(log n)', space: 'O(1)' },
    pitfalls: [
      { en: 'Mixing conventions: `while lo < hi` with `hi = mid - 1` causes skipped answers or infinite loops.', zh: '混用區間寫法：`while lo < hi` 搭配 `hi = mid - 1`，會漏掉答案或無窮迴圈。' },
      { en: 'Writing `lo = mid` in a `lo < hi` loop — when `hi = lo + 1` the range never shrinks.', zh: '在 `lo < hi` 迴圈中寫 `lo = mid`：當 `hi = lo + 1` 時範圍永遠不會縮小。' },
    ],
    examples: [
      {
        id: 'lc704',
        number: 704,
        title: { en: 'Binary Search', zh: '二分搜尋' },
        difficulty: 'easy',
        note: { en: 'Closed interval `[lo, hi]`: the highlighted band is exactly the part still being searched.', zh: '閉區間 `[lo, hi]`：畫面上的反白範圍就是還在搜尋的區域。' },
        code: `def search(nums: List[int], target: int) -> int:
    lo, hi = 0, len(nums) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if nums[mid] == target:
            return mid
        elif nums[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1
`,
        call: 'search([-1, 0, 3, 5, 9, 12, 15, 21], 12)',
        expected: '5',
      },
      {
        id: 'lc35',
        number: 35,
        title: { en: 'Search Insert Position', zh: '搜尋插入位置' },
        difficulty: 'easy',
        note: { en: 'Half-open `[lo, hi)`: finds the first index whose value is ≥ target (same as `bisect_left`).', zh: '左閉右開 `[lo, hi)`：找第一個值 ≥ target 的位置（等同 `bisect_left`）。' },
        code: `def searchInsert(nums: List[int], target: int) -> int:
    lo, hi = 0, len(nums)
    while lo < hi:
        mid = (lo + hi) // 2
        if nums[mid] < target:
            lo = mid + 1
        else:
            hi = mid
    return lo
`,
        call: 'searchInsert([1, 3, 5, 6, 8, 10], 7)',
        expected: '4',
      },
    ],
  },
  {
    id: 'prefix-sum',
    category: 'arrays',
    title: { en: 'Prefix Sum', zh: '前綴和' },
    tagline: {
      en: 'Precompute running totals so the sum of any range becomes a single subtraction.',
      zh: '先算出累加和，任何區間的總和都只要一次減法。',
    },
    whenToUse: [
      { en: 'Many range-sum queries on an array that does not change.', zh: '對不會變動的陣列做大量區間和查詢。' },
      { en: '"Count subarrays whose sum equals K" — combine with a hash map.', zh: '「計算總和為 K 的子陣列數量」——搭配雜湊表。' },
      { en: 'Balance / pivot problems (left sum vs. right sum).', zh: '平衡點問題（左邊總和 vs. 右邊總和）。' },
    ],
    idea: [
      { en: '`prefix[i]` = sum of `nums[0..i]`.', zh: '`prefix[i]` = `nums[0..i]` 的總和。' },
      { en: 'Sum of `nums[l..r]` = `prefix[r] - prefix[l - 1]`.', zh: '`nums[l..r]` 的總和 = `prefix[r] - prefix[l - 1]`。' },
      { en: 'A subarray sums to K ⇔ two prefix sums differ by K, so count earlier prefixes equal to `prefix - k`.', zh: '子陣列和為 K ⇔ 兩個前綴和相差 K，所以去數先前出現過多少個 `prefix - k`。' },
    ],
    template: `prefix = 0
count = 0
seen = {0: 1}
for x in nums:
    prefix += x
    count += seen.get(prefix - k, 0)
    seen[prefix] = seen.get(prefix, 0) + 1`,
    complexity: { time: 'O(n)', space: 'O(n)' },
    pitfalls: [
      { en: 'Forgetting `seen = {0: 1}` — subarrays that start at index 0 are missed.', zh: '忘了初始化 `seen = {0: 1}`，會漏掉從索引 0 開始的子陣列。' },
      { en: 'Sliding window does **not** work when numbers can be negative; prefix sum + hash map does.', zh: '有負數時滑動視窗**不適用**，要改用前綴和 + 雜湊表。' },
    ],
    examples: [
      {
        id: 'lc1480',
        number: 1480,
        title: { en: 'Running Sum of 1d Array', zh: '一維陣列的動態和' },
        difficulty: 'easy',
        note: { en: 'Each `prefix[i]` reuses `prefix[i - 1]` — that reuse is the whole trick.', zh: '每個 `prefix[i]` 都重用 `prefix[i - 1]`，這就是前綴和的核心。' },
        code: `def runningSum(nums: List[int]) -> List[int]:
    prefix = [0] * len(nums)
    for i in range(len(nums)):
        prefix[i] = nums[i] + (prefix[i - 1] if i > 0 else 0)
    return prefix
`,
        call: 'runningSum([3, 1, 2, 10, 1])',
        expected: '[3, 4, 6, 16, 17]',
      },
      {
        id: 'lc560',
        number: 560,
        title: { en: 'Subarray Sum Equals K', zh: '和為 K 的子陣列' },
        difficulty: 'medium',
        note: { en: 'Watch `seen` count how many times each prefix sum has appeared.', zh: '觀察 `seen` 如何記錄每個前綴和出現過幾次。' },
        code: `def subarraySum(nums: List[int], k: int) -> int:
    count = 0
    prefix = 0
    seen = {0: 1}
    for x in nums:
        prefix += x
        count += seen.get(prefix - k, 0)
        seen[prefix] = seen.get(prefix, 0) + 1
    return count
`,
        call: 'subarraySum([1, 2, 1, 2, 1], 3)',
        expected: '4',
      },
    ],
  },
  {
    id: 'sorting',
    category: 'arrays',
    title: { en: 'Sorting & Partitioning', zh: '排序與分區' },
    tagline: {
      en: 'Rearrange elements around a pivot or into groups using swaps.',
      zh: '用交換把元素依基準值（pivot）或類別重新分區。',
    },
    whenToUse: [
      { en: 'Grouping values into 2–3 categories in one pass (Dutch National Flag).', zh: '一次掃描把元素分成 2～3 類（荷蘭國旗問題）。' },
      { en: 'Understanding how quick sort / quick select work under the hood.', zh: '理解快速排序 / 快速選擇的底層運作。' },
      { en: 'Problems that become easy once the input is sorted.', zh: '排序後就變簡單的題目。' },
    ],
    idea: [
      { en: 'Partition: keep a boundary `i`; everything before `i` is "small". Scan with `j` and swap small elements to `i`.', zh: '分區：維護邊界 `i`，`i` 之前都是「小的」；用 `j` 掃描，把小的元素換到 `i`。' },
      { en: 'Three-way partition: `low` / `mid` / `high` split the array into `<`, `=`, `>` regions.', zh: '三向分區：`low` / `mid` / `high` 把陣列切成「小於、等於、大於」三區。' },
      { en: 'Quick sort = partition, then recurse on both sides.', zh: '快速排序 = 先分區，再對左右兩邊遞迴。' },
    ],
    template: `def partition(lo, hi):
    pivot = nums[hi]
    i = lo
    for j in range(lo, hi):
        if nums[j] < pivot:
            nums[i], nums[j] = nums[j], nums[i]
            i += 1
    nums[i], nums[hi] = nums[hi], nums[i]
    return i`,
    complexity: { time: 'O(n log n) avg', space: 'O(log n)', note: { en: 'Quick sort degrades to O(n²) on bad pivots; Python\'s built-in `sort()` is O(n log n) worst case.', zh: '快速排序遇到很差的 pivot 會退化成 O(n²)；Python 內建 `sort()` 最差也是 O(n log n)。' } },
    pitfalls: [
      { en: 'In three-way partition, do **not** advance `mid` after swapping with `high` — the swapped-in value is unchecked.', zh: '三向分區中，和 `high` 交換後**不要**讓 `mid` 前進，換過來的值還沒檢查。' },
      { en: 'Off-by-one on the recursion bounds (`i - 1` / `i + 1`).', zh: '遞迴邊界 `i - 1` / `i + 1` 差一錯誤。' },
    ],
    examples: [
      {
        id: 'lc75',
        number: 75,
        title: { en: 'Sort Colors', zh: '顏色分類' },
        difficulty: 'medium',
        note: { en: 'Zeros are swapped to the `low` side, twos to the `high` side, ones stay in the middle.', zh: '0 被換到 `low` 這側、2 被換到 `high` 那側，1 自然留在中間。' },
        code: `def sortColors(nums: List[int]) -> List[int]:
    low, mid, high = 0, 0, len(nums) - 1
    while mid <= high:
        if nums[mid] == 0:
            nums[low], nums[mid] = nums[mid], nums[low]
            low += 1
            mid += 1
        elif nums[mid] == 1:
            mid += 1
        else:
            nums[mid], nums[high] = nums[high], nums[mid]
            high -= 1
    return nums
`,
        call: 'sortColors([2, 0, 2, 1, 1, 0])',
        expected: '[0, 0, 1, 1, 2, 2]',
      },
      {
        id: 'lc912',
        number: 912,
        title: { en: 'Sort an Array (Quick Sort)', zh: '排序陣列（快速排序）' },
        difficulty: 'medium',
        note: { en: 'Watch the recursion depth in the header change as quick sort splits the array.', zh: '觀察右上角的遞迴深度：快速排序會不斷把陣列切成兩半。' },
        code: `def sortArray(nums: List[int]) -> List[int]:
    def quick_sort(lo: int, hi: int) -> None:
        if lo >= hi:
            return
        pivot = nums[hi]
        i = lo
        for j in range(lo, hi):
            if nums[j] < pivot:
                nums[i], nums[j] = nums[j], nums[i]
                i += 1
        nums[i], nums[hi] = nums[hi], nums[i]
        quick_sort(lo, i - 1)
        quick_sort(i + 1, hi)

    quick_sort(0, len(nums) - 1)
    return nums
`,
        call: 'sortArray([5, 2, 3, 1, 6, 4])',
        expected: '[1, 2, 3, 4, 5, 6]',
      },
    ],
  },
];
