import type { Tutorial } from './types';

export const GRAPH_DP_TUTORIALS: Tutorial[] = [
  {
    id: 'bfs-grid',
    category: 'graph',
    title: { en: 'BFS on a Grid', zh: '網格上的 BFS' },
    tagline: {
      en: 'Explore a 2D grid level by level with a queue, marking cells as visited.',
      zh: '用佇列一層一層探索 2D 網格，並標記走過的格子。',
    },
    whenToUse: [
      { en: 'Counting connected regions ("islands") in a matrix.', zh: '計算矩陣中的連通區塊（「島嶼」）數量。' },
      { en: 'Shortest path in an unweighted grid.', zh: '無權重網格的最短路徑。' },
      { en: 'Spreading processes (rotting oranges, flood fill).', zh: '擴散類問題（腐爛的橘子、油漆桶填色）。' },
    ],
    idea: [
      { en: 'Use `deque` as the queue: `append()` to enqueue, `popleft()` to dequeue.', zh: '用 `deque` 當佇列：`append()` 入隊、`popleft()` 出隊。' },
      { en: 'Mark a cell visited **when you enqueue it**, not when you dequeue it.', zh: '在**放入佇列時**就標記已拜訪，而不是取出時。' },
      { en: 'Walk the four directions `(1,0) (-1,0) (0,1) (0,-1)` and check bounds first.', zh: '走四個方向 `(1,0) (-1,0) (0,1) (0,-1)`，先檢查邊界。' },
    ],
    template: `queue = deque([(r0, c0)])
grid[r0][c0] = VISITED
while queue:
    r, c = queue.popleft()
    for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nr, nc = r + dr, c + dc
        if 0 <= nr < rows and 0 <= nc < cols and grid[nr][nc] == OPEN:
            grid[nr][nc] = VISITED
            queue.append((nr, nc))`,
    complexity: { time: 'O(rows × cols)', space: 'O(rows × cols)' },
    pitfalls: [
      { en: 'Marking visited on dequeue → the same cell is enqueued many times.', zh: '取出時才標記 → 同一格會被重複放入佇列很多次。' },
      { en: 'Using `list.pop(0)` instead of `deque.popleft()` — it is `O(n)` per call.', zh: '用 `list.pop(0)` 取代 `deque.popleft()`，每次都是 `O(n)`。' },
    ],
    examples: [
      {
        id: 'lc200',
        number: 200,
        title: { en: 'Number of Islands', zh: '島嶼數量' },
        difficulty: 'medium',
        note: { en: 'The orange mark is the scan position `(r, c)`; BFS then sinks the whole island to "0".', zh: '橘色標記是掃描位置 `(r, c)`；找到陸地後 BFS 會把整座島改成 "0"。' },
        code: `def numIslands(grid: List[List[str]]) -> int:
    rows, cols = len(grid), len(grid[0])
    islands = 0
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == "1":
                islands += 1
                grid[r][c] = "0"
                queue = deque([(r, c)])
                while queue:
                    cr, cc = queue.popleft()
                    for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nr, nc = cr + dr, cc + dc
                        if 0 <= nr < rows and 0 <= nc < cols and grid[nr][nc] == "1":
                            grid[nr][nc] = "0"
                            queue.append((nr, nc))
    return islands
`,
        call: 'numIslands([["1", "1", "0", "0"], ["1", "0", "0", "1"], ["0", "0", "1", "1"]])',
        expected: '2',
        js: {
          code: `/**
 * @param {character[][]} grid
 * @return {number}
 */
var numIslands = function(grid) {
    const rows = grid.length;
    const cols = grid[0].length;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let islands = 0;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (grid[r][c] === "1") {
                islands++;
                grid[r][c] = "0";
                const queue = [[r, c]];
                while (queue.length) {
                    const [cr, cc] = queue.shift();
                    for (const [dr, dc] of dirs) {
                        const nr = cr + dr;
                        const nc = cc + dc;
                        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc] === "1") {
                            grid[nr][nc] = "0";
                            queue.push([nr, nc]);
                        }
                    }
                }
            }
        }
    }
    return islands;
};
`,
          call: 'numIslands([["1","1","0","0"],["1","0","0","1"],["0","0","1","1"]])',
          expected: '2',
        },
      },
    ],
  },
  {
    id: 'topological-sort',
    category: 'graph',
    title: { en: 'Topological Sort (Kahn\'s BFS)', zh: '拓撲排序（Kahn 演算法）' },
    tagline: {
      en: 'Repeatedly take nodes with no remaining prerequisites; if some never become free, there is a cycle.',
      zh: '不斷取出「已沒有前置條件」的節點；若有節點永遠等不到，代表圖中有環。',
    },
    whenToUse: [
      { en: 'Task ordering with dependencies (courses, build steps).', zh: '有依賴關係的任務排序（修課順序、建置步驟）。' },
      { en: 'Detecting a cycle in a **directed** graph.', zh: '偵測**有向圖**中是否有環。' },
    ],
    idea: [
      { en: 'Build an adjacency list and an `indegree` count for every node.', zh: '建立鄰接串列，並計算每個節點的 `indegree`（入度）。' },
      { en: 'Start the queue with every node whose indegree is 0.', zh: '把所有入度為 0 的節點放進佇列。' },
      { en: 'Pop a node, "remove" its outgoing edges by decrementing neighbours; enqueue neighbours that reach 0.', zh: '取出節點後，把鄰居的入度減一（等於移除這條邊），降到 0 的鄰居就放進佇列。' },
      { en: 'If the number of processed nodes is less than `n`, a cycle exists.', zh: '處理過的節點數若少於 `n`，就代表有環。' },
    ],
    complexity: { time: 'O(V + E)', space: 'O(V + E)' },
    pitfalls: [
      { en: 'Getting the edge direction backwards: `[course, pre]` means `pre → course`.', zh: '邊的方向弄反：`[course, pre]` 代表 `pre → course`。' },
    ],
    examples: [
      {
        id: 'lc207',
        number: 207,
        title: { en: 'Course Schedule', zh: '課程表' },
        difficulty: 'medium',
        note: { en: 'Watch `indegree` drop to 0 as prerequisites are completed.', zh: '觀察 `indegree` 隨著前置課程完成而降到 0。' },
        code: `def canFinish(numCourses: int, prerequisites: List[List[int]]) -> bool:
    graph = defaultdict(list)
    indegree = [0] * numCourses
    for course, pre in prerequisites:
        graph[pre].append(course)
        indegree[course] += 1
    queue = deque([i for i in range(numCourses) if indegree[i] == 0])
    taken = 0
    while queue:
        node = queue.popleft()
        taken += 1
        for nxt in graph[node]:
            indegree[nxt] -= 1
            if indegree[nxt] == 0:
                queue.append(nxt)
    return taken == numCourses
`,
        call: 'canFinish(4, [[1, 0], [2, 0], [3, 1], [3, 2]])',
        expected: 'True',
        js: {
          code: `/**
 * @param {number} numCourses
 * @param {number[][]} prerequisites
 * @return {boolean}
 */
var canFinish = function(numCourses, prerequisites) {
    const graph = Array.from({ length: numCourses }, () => []);
    const indegree = new Array(numCourses).fill(0);
    for (const [course, pre] of prerequisites) {
        graph[pre].push(course);
        indegree[course]++;
    }
    const queue = [];
    for (let i = 0; i < numCourses; i++) {
        if (indegree[i] === 0) {
            queue.push(i);
        }
    }
    let taken = 0;
    while (queue.length) {
        const node = queue.shift();
        taken++;
        for (const next of graph[node]) {
            indegree[next]--;
            if (indegree[next] === 0) {
                queue.push(next);
            }
        }
    }
    return taken === numCourses;
};
`,
          call: 'canFinish(4, [[1, 0], [2, 0], [3, 1], [3, 2]])',
          expected: 'true',
        },
      },
    ],
  },
  {
    id: 'union-find',
    category: 'graph',
    title: { en: 'Union-Find (Disjoint Set)', zh: '並查集（Union-Find）' },
    tagline: {
      en: 'Track which group every node belongs to with a `parent` array; merging two groups is nearly `O(1)`.',
      zh: '用 `parent` 陣列記錄每個節點屬於哪一組，合併兩組幾乎是 `O(1)`。',
    },
    whenToUse: [
      { en: 'Counting connected components while edges arrive one by one.', zh: '邊一條條加入時，計算連通塊數量。' },
      { en: 'Detecting a redundant edge (a cycle) in an undirected graph.', zh: '在無向圖中找出多餘的邊（造成環的邊）。' },
      { en: '"Are these two items in the same group?"', zh: '「這兩個東西在同一組嗎？」' },
    ],
    idea: [
      { en: 'Initially every node is its own parent: `parent = list(range(n))`.', zh: '一開始每個節點都是自己的父節點：`parent = list(range(n))`。' },
      { en: '`find(x)` follows parents up to the root; path compression flattens the chain.', zh: '`find(x)` 沿著 parent 往上找到根；路徑壓縮會把這條鏈攤平。' },
      { en: '`union(a, b)` links one root under the other; if roots are equal they were already connected.', zh: '`union(a, b)` 把一個根接到另一個根下；若根相同，代表原本就相連。' },
    ],
    template: `parent = list(range(n))

def find(x):
    while parent[x] != x:
        parent[x] = parent[parent[x]]
        x = parent[x]
    return x

def union(a, b):
    ra, rb = find(a), find(b)
    if ra == rb:
        return False
    parent[ra] = rb
    return True`,
    complexity: { time: 'O(α(n)) per op', space: 'O(n)', note: { en: 'α is the inverse Ackermann function — effectively constant.', zh: 'α 是反阿克曼函數，實務上可視為常數。' } },
    pitfalls: [
      { en: 'Linking `parent[a] = b` instead of linking the **roots**.', zh: '寫成 `parent[a] = b`，而不是把兩個**根**接起來。' },
    ],
    examples: [
      {
        id: 'lc547',
        number: 547,
        title: { en: 'Number of Provinces', zh: '省份數量' },
        difficulty: 'medium',
        note: { en: 'The grid mark `(i, j)` scans the matrix; every successful union decreases `provinces`.', zh: '格子標記 `(i, j)` 掃過矩陣；每次成功合併，`provinces` 就減一。' },
        code: `def findCircleNum(isConnected: List[List[int]]) -> int:
    n = len(isConnected)
    parent = list(range(n))

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    provinces = n
    for i in range(n):
        for j in range(i + 1, n):
            if isConnected[i][j] == 1:
                root_i, root_j = find(i), find(j)
                if root_i != root_j:
                    parent[root_i] = root_j
                    provinces -= 1
    return provinces
`,
        call: 'findCircleNum([[1, 1, 0, 0], [1, 1, 0, 0], [0, 0, 1, 1], [0, 0, 1, 1]])',
        expected: '2',
        js: {
          code: `/**
 * @param {number[][]} isConnected
 * @return {number}
 */
var findCircleNum = function(isConnected) {
    const n = isConnected.length;
    const parent = Array.from({ length: n }, (_, i) => i);
    const find = (x) => {
        while (parent[x] !== x) {
            parent[x] = parent[parent[x]];
            x = parent[x];
        }
        return x;
    };
    let provinces = n;
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            if (isConnected[i][j] === 1) {
                const rootI = find(i);
                const rootJ = find(j);
                if (rootI !== rootJ) {
                    parent[rootI] = rootJ;
                    provinces--;
                }
            }
        }
    }
    return provinces;
};
`,
          call: 'findCircleNum([[1, 1, 0, 0], [1, 1, 0, 0], [0, 0, 1, 1], [0, 0, 1, 1]])',
          expected: '2',
        },
      },
    ],
  },
  {
    id: 'dp-1d',
    category: 'dp',
    title: { en: '1D Dynamic Programming', zh: '一維動態規劃' },
    tagline: {
      en: 'Define `dp[i]` as the answer for the first `i` items, and build it from smaller answers.',
      zh: '定義 `dp[i]` 為「前 `i` 個元素」的答案，從更小的答案推出來。',
    },
    whenToUse: [
      { en: 'The problem asks for a count, minimum or maximum over choices.', zh: '題目要求在各種選擇中的方法數、最小值或最大值。' },
      { en: 'A brute-force recursion recomputes the same sub-problems.', zh: '暴力遞迴會重複計算相同的子問題。' },
      { en: 'The decision at step `i` only depends on a few earlier steps.', zh: '第 `i` 步的決策只依賴前面少數幾步。' },
    ],
    idea: [
      { en: '**State**: what does `dp[i]` mean? Write it down in one sentence.', zh: '**狀態**：`dp[i]` 代表什麼？用一句話寫清楚。' },
      { en: '**Transition**: how is `dp[i]` built from `dp[i - 1]`, `dp[i - 2]`, …?', zh: '**轉移**：`dp[i]` 怎麼從 `dp[i - 1]`、`dp[i - 2]`… 推出來？' },
      { en: '**Base case** and **answer**: which cells are known up front, and which cell is returned?', zh: '**初始值**與**答案**：哪些格子一開始就知道？最後回傳哪一格？' },
    ],
    template: `dp = [0] * (n + 1)
dp[0] = base
for i in range(1, n + 1):
    dp[i] = best_of(dp[i - 1], dp[i - 2], ...)
return dp[n]`,
    complexity: { time: 'O(n) × transition', space: 'O(n)', note: { en: 'Often reducible to O(1) by keeping only the last few values.', zh: '通常只保留最後幾個值就能降到 O(1) 空間。' } },
    pitfalls: [
      { en: 'Off-by-one between `dp` indices and input indices (`dp[i]` often uses `nums[i - 1]`).', zh: '`dp` 索引與輸入索引差一（`dp[i]` 常常對應 `nums[i - 1]`）。' },
      { en: 'Using `0` as "impossible" for minimisation problems — use `float(\'inf\')`.', zh: '求最小值時用 `0` 表示「做不到」——應該用 `float(\'inf\')`。' },
    ],
    examples: [
      {
        id: 'lc70',
        number: 70,
        title: { en: 'Climbing Stairs', zh: '爬樓梯' },
        difficulty: 'easy',
        note: { en: 'To reach step `i` you came from `i - 1` or `i - 2` — that is the whole recurrence.', zh: '走到第 `i` 階，一定是從 `i - 1` 或 `i - 2` 上來的，這就是整個遞推式。' },
        code: `def climbStairs(n: int) -> int:
    if n <= 2:
        return n
    dp = [0] * (n + 1)
    dp[1], dp[2] = 1, 2
    for i in range(3, n + 1):
        dp[i] = dp[i - 1] + dp[i - 2]
    return dp[n]
`,
        call: 'climbStairs(6)',
        expected: '13',
        js: {
          code: `/**
 * @param {number} n
 * @return {number}
 */
var climbStairs = function(n) {
    if (n <= 2) {
        return n;
    }
    const dp = new Array(n + 1).fill(0);
    dp[1] = 1;
    dp[2] = 2;
    for (let i = 3; i <= n; i++) {
        dp[i] = dp[i - 1] + dp[i - 2];
    }
    return dp[n];
};
`,
          call: 'climbStairs(6)',
          expected: '13',
        },
      },
      {
        id: 'lc198',
        number: 198,
        title: { en: 'House Robber', zh: '打家劫舍' },
        difficulty: 'medium',
        note: { en: 'At each house: skip it (`dp[i - 1]`) or rob it (`dp[i - 2] + nums[i - 1]`).', zh: '每間房子：不搶（`dp[i - 1]`）或搶（`dp[i - 2] + nums[i - 1]`）取較大者。' },
        code: `def rob(nums: List[int]) -> int:
    dp = [0] * (len(nums) + 1)
    dp[1] = nums[0]
    for i in range(2, len(nums) + 1):
        dp[i] = max(dp[i - 1], dp[i - 2] + nums[i - 1])
    return dp[-1]
`,
        call: 'rob([2, 7, 9, 3, 1])',
        expected: '12',
        js: {
          code: `/**
 * @param {number[]} nums
 * @return {number}
 */
var rob = function(nums) {
    const dp = new Array(nums.length + 1).fill(0);
    dp[1] = nums[0];
    for (let i = 2; i <= nums.length; i++) {
        dp[i] = Math.max(dp[i - 1], dp[i - 2] + nums[i - 1]);
    }
    return dp[nums.length];
};
`,
          call: 'rob([2, 7, 9, 3, 1])',
          expected: '12',
        },
      },
      {
        id: 'lc322',
        number: 322,
        title: { en: 'Coin Change', zh: '零錢兌換' },
        difficulty: 'medium',
        note: { en: '`dp[i]` = fewest coins for amount `i`; ∞ means "not reachable yet".', zh: '`dp[i]` = 湊出金額 `i` 最少要幾枚硬幣；∞ 代表「目前還湊不出來」。' },
        code: `def coinChange(coins: List[int], amount: int) -> int:
    dp = [0] + [float('inf')] * amount
    for i in range(1, amount + 1):
        for coin in coins:
            if coin <= i:
                dp[i] = min(dp[i], dp[i - coin] + 1)
    return dp[amount] if dp[amount] != float('inf') else -1
`,
        call: 'coinChange([1, 2, 5], 11)',
        expected: '3',
        js: {
          code: `/**
 * @param {number[]} coins
 * @param {number} amount
 * @return {number}
 */
var coinChange = function(coins, amount) {
    const dp = new Array(amount + 1).fill(Infinity);
    dp[0] = 0;
    for (let i = 1; i <= amount; i++) {
        for (const coin of coins) {
            if (coin <= i) {
                dp[i] = Math.min(dp[i], dp[i - coin] + 1);
            }
        }
    }
    return dp[amount] === Infinity ? -1 : dp[amount];
};
`,
          call: 'coinChange([1, 2, 5], 11)',
          expected: '3',
        },
      },
    ],
  },
  {
    id: 'dp-2d',
    category: 'dp',
    title: { en: '2D Dynamic Programming', zh: '二維動態規劃' },
    tagline: {
      en: 'Fill a table where `dp[i][j]` depends on its top, left and top-left neighbours.',
      zh: '填一張表，`dp[i][j]` 由上方、左方與左上方的格子推出。',
    },
    whenToUse: [
      { en: 'Paths in a grid (count paths, minimum path sum).', zh: '網格路徑（路徑數量、最小路徑和）。' },
      { en: 'Comparing two strings (LCS, edit distance).', zh: '比較兩個字串（最長公共子序列、編輯距離）。' },
      { en: 'The state needs two indices to be described.', zh: '狀態需要兩個索引才能描述。' },
    ],
    idea: [
      { en: 'Decide what row `i` and column `j` represent (prefix lengths are common for strings).', zh: '先決定第 `i` 列、第 `j` 欄代表什麼（字串題常用「前綴長度」）。' },
      { en: 'Fill row by row so every dependency is already computed.', zh: '一列一列填，確保依賴的格子都已經算好。' },
      { en: 'An extra row/column of zeros removes most boundary checks.', zh: '多開一列 / 一欄的 0，可以省掉大部分邊界判斷。' },
    ],
    template: `dp = [[0] * (n + 1) for _ in range(m + 1)]
for i in range(1, m + 1):
    for j in range(1, n + 1):
        dp[i][j] = combine(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
return dp[m][n]`,
    complexity: { time: 'O(m × n)', space: 'O(m × n)' },
    pitfalls: [
      { en: '`[[0] * n] * m` creates **m references to the same row** — use a list comprehension.', zh: '`[[0] * n] * m` 會建立 **m 個指向同一列的參照**——要用 list comprehension。' },
    ],
    examples: [
      {
        id: 'lc62',
        number: 62,
        title: { en: 'Unique Paths', zh: '不同路徑' },
        difficulty: 'medium',
        note: { en: 'Each cell = paths from above + paths from the left.', zh: '每一格 = 從上面來的路徑數 + 從左邊來的路徑數。' },
        code: `def uniquePaths(m: int, n: int) -> int:
    dp = [[1] * n for _ in range(m)]
    for i in range(1, m):
        for j in range(1, n):
            dp[i][j] = dp[i - 1][j] + dp[i][j - 1]
    return dp[m - 1][n - 1]
`,
        call: 'uniquePaths(3, 4)',
        expected: '10',
        js: {
          code: `/**
 * @param {number} m
 * @param {number} n
 * @return {number}
 */
var uniquePaths = function(m, n) {
    const dp = Array.from({ length: m }, () => new Array(n).fill(1));
    for (let i = 1; i < m; i++) {
        for (let j = 1; j < n; j++) {
            dp[i][j] = dp[i - 1][j] + dp[i][j - 1];
        }
    }
    return dp[m - 1][n - 1];
};
`,
          call: 'uniquePaths(3, 4)',
          expected: '10',
        },
      },
      {
        id: 'lc1143',
        number: 1143,
        title: { en: 'Longest Common Subsequence', zh: '最長公共子序列' },
        difficulty: 'medium',
        note: { en: 'Matching characters extend the diagonal; otherwise take the better of top and left.', zh: '字元相同就從左上角 +1；不同就取上方與左方較大者。' },
        code: `def longestCommonSubsequence(text1: str, text2: str) -> int:
    m, n = len(text1), len(text2)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if text1[i - 1] == text2[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])
    return dp[m][n]
`,
        call: 'longestCommonSubsequence("abcde", "ace")',
        expected: '3',
        js: {
          code: `/**
 * @param {string} text1
 * @param {string} text2
 * @return {number}
 */
var longestCommonSubsequence = function(text1, text2) {
    const m = text1.length;
    const n = text2.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (text1[i - 1] === text2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }
    return dp[m][n];
};
`,
          call: 'longestCommonSubsequence("abcde", "ace")',
          expected: '3',
        },
      },
    ],
  },
];
