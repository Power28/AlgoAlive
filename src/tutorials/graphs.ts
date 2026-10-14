import type { Tutorial } from './types';

export const GRAPH_TUTORIALS: Tutorial[] = [
  {
    id: 'graph-traversal',
    category: 'graph',
    title: { en: 'Graph Traversal (DFS / BFS)', zh: '圖的走訪（DFS / BFS）' },
    tagline: {
      en: 'Walk a graph through its adjacency list, marking nodes as visited so each one is processed once.',
      zh: '透過鄰接串列走訪整張圖，並標記已拜訪的節點，讓每個節點只處理一次。',
    },
    whenToUse: [
      { en: 'The input is a list of edges or an adjacency list (`graph[u]` = neighbours of `u`).', zh: '輸入是邊的清單，或鄰接串列（`graph[u]` = `u` 的鄰居）。' },
      { en: 'Connectivity, reachability, copying a graph, enumerating paths.', zh: '連通性、可達性、複製一張圖、列舉所有路徑。' },
      { en: 'Two-colouring (bipartite check) and cycle detection.', zh: '二分圖著色檢查、偵測環。' },
    ],
    idea: [
      { en: 'Build the adjacency list first: `graph = defaultdict(list)`, then `graph[u].append(v)` for each edge (both directions if undirected).', zh: '先建鄰接串列：`graph = defaultdict(list)`，每條邊 `graph[u].append(v)`（無向圖兩個方向都要加）。' },
      { en: '**BFS** uses a `deque` and finds shortest paths in unweighted graphs; **DFS** uses recursion (or a stack) and is natural for paths and backtracking.', zh: '**BFS** 用 `deque`，可求無權圖的最短路徑；**DFS** 用遞迴（或堆疊），適合找路徑與回溯。' },
      { en: 'Unlike a tree, a graph can have cycles — keep a `visited` set (or dict) and check it before enqueuing.', zh: '圖和樹不同，可能有環——要維護 `visited` 集合（或 dict），放入佇列前先檢查。' },
    ],
    template: `graph = defaultdict(list)
for u, v in edges:
    graph[u].append(v)
    graph[v].append(u)

visited = {start}
queue = deque([start])
while queue:
    node = queue.popleft()
    for nxt in graph[node]:
        if nxt not in visited:
            visited.add(nxt)
            queue.append(nxt)`,
    complexity: { time: 'O(V + E)', space: 'O(V)' },
    pitfalls: [
      { en: 'Forgetting the reverse edge for undirected graphs.', zh: '無向圖忘了加反方向的邊。' },
      { en: 'Graphs may be disconnected — loop over every node as a possible start.', zh: '圖可能不連通——要把每個節點都當成起點檢查一次。' },
    ],
    examples: [
      {
        id: 'lc133',
        number: 133,
        title: { en: 'Clone Graph', zh: '複製圖' },
        difficulty: 'medium',
        note: {
          en: 'Left: the original graph. Right: the copy growing node by node (green = just created). `clones` doubles as the visited set.',
          zh: '左邊是原圖，右邊是一個個長出來的複製圖（綠色 = 剛建立）。`clones` 同時也是已拜訪集合。',
        },
        code: `def cloneGraph(node: Optional[Node]) -> Optional[Node]:
    if not node:
        return None
    clones = {node: Node(node.val)}
    queue = deque([node])
    while queue:
        cur = queue.popleft()
        for nei in cur.neighbors:
            if nei not in clones:
                clones[nei] = Node(nei.val)
                queue.append(nei)
            clones[cur].neighbors.append(clones[nei])
    return clones[node]
`,
        call: 'cloneGraph(build_graph([[2, 4], [1, 3], [2, 4], [1, 3]]))',
      },
      {
        id: 'lc797',
        number: 797,
        title: { en: 'All Paths From Source to Target', zh: '所有可能的路徑' },
        difficulty: 'medium',
        note: { en: 'The orange edges are the current `path`; DFS extends it, records it at the target, then backtracks.', zh: '橘色的邊就是目前的 `path`；DFS 往前延伸，到達終點就記錄，然後回溯。' },
        code: `def allPathsSourceTarget(graph: List[List[int]]) -> List[List[int]]:
    target = len(graph) - 1
    result = []
    path = [0]

    def dfs(node: int) -> None:
        if node == target:
            result.append(path[:])
            return
        for nxt in graph[node]:
            path.append(nxt)
            dfs(nxt)
            path.pop()

    dfs(0)
    return result
`,
        call: 'allPathsSourceTarget([[1, 2], [3], [3], []])',
      },
      {
        id: 'lc785',
        number: 785,
        title: { en: 'Is Graph Bipartite?', zh: '判斷二分圖' },
        difficulty: 'medium',
        note: { en: 'Node fill = `color[node]`. Every edge must connect two different colours.', zh: '節點填色 = `color[node]`。每條邊連接的兩端顏色都必須不同。' },
        code: `def isBipartite(graph: List[List[int]]) -> bool:
    color = [-1] * len(graph)
    for start in range(len(graph)):
        if color[start] != -1:
            continue
        color[start] = 0
        queue = deque([start])
        while queue:
            node = queue.popleft()
            for nei in graph[node]:
                if color[nei] == -1:
                    color[nei] = 1 - color[node]
                    queue.append(nei)
                elif color[nei] == color[node]:
                    return False
    return True
`,
        call: 'isBipartite([[1, 3], [0, 2], [1, 3], [0, 2]])',
      },
    ],
  },
  {
    id: 'dijkstra',
    category: 'graph',
    title: { en: 'Dijkstra\'s Shortest Path', zh: 'Dijkstra 最短路徑' },
    tagline: {
      en: 'Always expand the closest unfinished node next, using a min-heap of `(distance, node)`.',
      zh: '每次都從「目前距離最近、還沒確定」的節點往外擴展，用 `(距離, 節點)` 的最小堆積實作。',
    },
    whenToUse: [
      { en: 'Shortest path in a graph with **non-negative** edge weights.', zh: '邊權重**非負**的圖上的最短路徑。' },
      { en: '"Minimum time / cost / effort to reach…" problems.', zh: '「到達…的最短時間 / 最小成本 / 最小體力」類題目。' },
    ],
    idea: [
      { en: 'Push `(0, source)`. Pop the smallest distance; the first time a node is popped, its distance is final.', zh: '先推入 `(0, source)`。每次彈出距離最小者；節點**第一次**被彈出時，它的距離就確定了。' },
      { en: 'Relax its edges: push `(d + w, neighbour)` for neighbours not finalised yet.', zh: '鬆弛它的邊：對還沒確定的鄰居推入 `(d + w, neighbour)`。' },
      { en: 'Skip stale heap entries (`if node in dist: continue`) instead of decreasing keys.', zh: '遇到過時的堆積項目就跳過（`if node in dist: continue`），不用做 decrease-key。' },
    ],
    template: `dist = {}
heap = [(0, source)]
while heap:
    d, node = heapq.heappop(heap)
    if node in dist:
        continue
    dist[node] = d
    for nxt, w in graph[node]:
        if nxt not in dist:
            heapq.heappush(heap, (d + w, nxt))`,
    complexity: { time: 'O(E log V)', space: 'O(V + E)' },
    pitfalls: [
      { en: 'Negative weights break Dijkstra — use Bellman-Ford instead.', zh: '有負權重時 Dijkstra 不適用——要改用 Bellman-Ford。' },
      { en: 'Pushing `(node, d)` instead of `(d, node)` — the heap orders by the first item.', zh: '推入 `(node, d)` 而不是 `(d, node)`——堆積是依第一個元素排序的。' },
    ],
    examples: [
      {
        id: 'lc743',
        number: 743,
        title: { en: 'Network Delay Time', zh: '網路延遲時間' },
        difficulty: 'medium',
        note: { en: 'Edge labels are travel times; the `dist` badge appears once a node\'s shortest time is final.', zh: '邊上的數字是傳遞時間；節點旁出現 `dist` 標籤，代表它的最短時間已確定。' },
        code: `def networkDelayTime(times: List[List[int]], n: int, k: int) -> int:
    graph = defaultdict(list)
    for u, v, w in times:
        graph[u].append((v, w))
    dist = {}
    heap = [(0, k)]
    while heap:
        d, node = heapq.heappop(heap)
        if node in dist:
            continue
        dist[node] = d
        for nxt, w in graph[node]:
            if nxt not in dist:
                heapq.heappush(heap, (d + w, nxt))
    return max(dist.values()) if len(dist) == n else -1
`,
        call: 'networkDelayTime([[2, 1, 1], [2, 3, 1], [3, 4, 1], [1, 4, 3]], 4, 2)',
      },
    ],
  },
];
