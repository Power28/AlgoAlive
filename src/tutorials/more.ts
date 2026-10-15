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
];
