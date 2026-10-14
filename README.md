# AlgoAlive

> *Bring your LeetCode algorithms to life*

**🔗 線上 Demo：https://power28.github.io/AlgoAlive/**

[![AlgoAlive 播放 283. Move Zeroes：slow / fast 指針移動與格子交換動畫](docs/move-zeroes.gif)](https://power28.github.io/AlgoAlive/)

AlgoAlive 是專為 **Python LeetCode 刷題** 設計的互動式步驟動畫器。貼上一般的 Python 函式與測試呼叫，按下 **Visualize**，就能一步步看到 list 方格、指針移動、dict 查表與變數變化——不用手動加任何 `print`。

全部在瀏覽器內執行（Pyodide / WebAssembly），純靜態網頁即可部署，不需後端。

## 功能

![AlgoAlive 執行 1. Two Sum：complement 命中 seen 字典的那一步](docs/screenshot.png)

- **零侵入追蹤**：以 `sys.settrace` 攔截使用者函式的 `line` / `return` / `exception` 事件，自動快照 `frame.f_locals`
- **List / 字串方格 + 指針**：分析程式碼中的 `nums[i]`、`text1[i - 1]` 等索引寫法，把對應變數畫成格子下方的彩色指針（固定帶位移時標成 `i-1`）；`left`+`right`、`lo`+`hi` 等配對會畫出視窗範圍；被當成陣列走訪的字串也會拆成字元格子
- **2D 格子**：`list[list]`（DP 表、網格 BFS、矩陣）畫成表格，並依 `grid[r][c]`、`dp[i][j]` 標出目前位置
- **鏈結串列**：節點 → 箭頭 → 節點，`head` / `prev` / `curr` / `slow` / `fast` 等變數標在節點下方；反轉時節點會在兩條鏈之間平滑移動，剛改過的 `next` 以橘色箭頭標示，環以紅色 ↺ 標出接回位置
- **二元樹**：自動排版的樹狀圖，翻轉等修改會讓整棵子樹滑到新位置；遞迴時以虛線節點與橘色連線標出外層呼叫的路徑（例如 `root·2` 代表第 2 層呼叫的 `root`）
- **一般圖**：自訂節點（`Node.neighbors`）或名為 `graph` / `adj` 的鄰接串列（`dict` 或 `list[list]`，可帶權重 `(v, w)`）畫成節點連線圖；`node` / `nxt` 等變數標在節點上並高亮目前走的邊，`visited` 填色、`queue` / `stack` 中的節點虛線框、`path` 的邊高亮，`indegree` / `dist` 等每個節點一個值的陣列顯示成旁邊的小標籤，`color` 陣列直接替節點著色
- **絲滑交換動畫**：前端追蹤每個格子的「身分」，swap / sort 時格子會真的移動（framer-motion `layout`）
- **Dict 查表**：新增 key 綠色、值變動橘色；若某個區域變數的值正好是 dict 的 key（例如 `complement`），該列會被標示
- **Set、純量變數、`print` 輸出、回傳值、例外** 皆有對應顯示
- **播放控制**：上一步 / 下一步 / 播放暫停 / 時間軸拖曳 / 0.5×–4× 速度；鍵盤 `←` `→` `Space` `Home` `End`
- **Monaco 編輯器**：橘色高亮「即將執行」的行，藍色淡化標示上一步的行；`Ctrl+Enter` 執行
- **自訂頁籤**：新增空白頁籤或從教學範例開啟、雙擊重新命名、關閉；程式碼與測資自動存在瀏覽器（localStorage），重新整理也不會消失
- **中英雙語**：右上角一鍵切換介面與教學內容語言（也可用 `?lang=zh` / `?lang=en`）
- **防呆**：超過 500 步拋出 `TimeoutError`（仍可回放已記錄的步驟）；單次執行超過 10 秒會直接重啟 Worker

![二元樹遞迴：104. Maximum Depth，虛線節點與橘色連線是外層呼叫的路徑](docs/tree.png)

![一般圖：785. Is Graph Bipartite?，節點依 color 著色、目前走的邊以橘色標示](docs/graph.png)

## 演算法教學

![演算法教學：滑動視窗](docs/tutorials.png)

點右上角 **Learn / 演算法教學** 開啟。每個主題包含「什麼時候用、核心觀念、程式模板、複雜度、常見陷阱」，並附 1～3 題可直接執行的 LeetCode 範例；從範例開啟的頁籤可以把左側切到「教學」，邊讀邊跑。

| 分類 | 主題（範例題號） |
|---|---|
| 陣列與指針 | 對撞雙指針（167、11）· 快慢指針（283、26）· 滑動視窗（209、3）· 二分搜尋（704、35）· 前綴和（1480、560）· 排序與分區（75、912） |
| 雜湊 | 雜湊表查找（1、242） |
| 鏈結串列 | 鏈結串列基礎（206、21）· 快慢指針（876、141） |
| 二元樹 | 樹的 DFS（104、226、112）· 樹的 BFS（102）· 二元搜尋樹（700、98） |
| 堆疊、佇列與堆積 | 堆疊（20、150）· 單調堆疊（739、496）· 堆積 / 優先佇列（215、347） |
| 圖與網格 | 圖的走訪（133、797、785）· Dijkstra 最短路徑（743）· 網格 BFS（200）· 拓撲排序（207）· 並查集（547） |
| 動態規劃 | 一維 DP（70、198、322）· 二維 DP（62、1143） |
| 其他技巧 | 貪心法（121、55）· 回溯法（78、46）· 區間問題（56）· 位元運算（136、191） |


教學內容在 [src/tutorials/](src/tutorials/)，新增主題只要照 `Tutorial` 型別加一筆資料。

## 快速開始

```bash
npm install
npm run dev
```

```bash
npm run build   # 輸出至 dist/，可直接部署到 GitHub Pages / Netlify / Vercel
```

push 到 `main` 時會由 [GitHub Actions](.github/workflows/deploy.yml) 自動建置、**跑完測試**，通過後才部署到 GitHub Pages。

### 測試

```bash
npm run build   # e2e 測試的是 dist/，先建置
npm test        # = test:tracer + test:e2e
```

| 指令 | 內容 |
|---|---|
| `npm run test:tracer` | [scripts/check_examples.py](scripts/check_examples.py)：直接用 Python 執行所有教學範例，比對回傳值；另外測試 tracer 的步數上限、錯誤行號、`class Solution`、`print` 輸出、遞迴時的節點參照等行為。幾秒內完成，不需要瀏覽器 |
| `npm run test:e2e` | [scripts/e2e.mjs](scripts/e2e.mjs)：以 `vite preview` 啟動 `dist/`，用 headless Chrome 從教學庫逐一開啟範例、執行到最後一步，比對畫面上的回傳值；並測試頁籤（新增、重新命名、重新整理後保留、關閉）、語言切換，以及主控台沒有錯誤。加 `-- --url <網址>` 可以改測 dev server 或線上網站 |

每個範例的預期回傳值寫在 `src/tutorials/*.ts` 的 `expected` 欄位（與畫面上「returned」的寫法相同），兩種測試共用；新增範例時一併填上即可。

### 更新 README 截圖與 GIF

```bash
npm run capture                                  # 錄線上網站
npm run capture -- --url http://localhost:5173/  # 錄本機 dev server（先 npm run dev）
```

會重新產生 `docs/screenshot.png`（1. Two Sum）、`docs/tutorials.png`（教學頁）、`docs/tree.png`（二元樹遞迴）、`docs/graph.png`（一般圖）與 `docs/move-zeroes.gif`（283. Move Zeroes）。需要本機安裝 Chrome 或 Edge（找不到時設定 `CHROME_PATH`），以及含 [Pillow](https://pypi.org/project/pillow/) 的 Python 3。腳本在 [scripts/](scripts/)。

## 架構

```
src/
├─ runtime/
│  ├─ tracer.py            # sys.settrace 追蹤器 + 帶型別標籤的序列化
│  ├─ pyodide.worker.ts    # Web Worker：載入 Pyodide (CDN v0.26.2) 並執行 tracer
│  └─ runner.ts            # 主執行緒端：Worker 生命週期、逾時重啟、狀態通知
├─ lib/
│  ├─ pyValue.ts           # Python repr 格式化、型別判斷、2D 格子偵測
│  ├─ cellKeys.ts          # 跨步驟追蹤 list 格子身分（讓 swap 變成移動動畫）
│  ├─ indexing.ts          # 靜態分析 name[...] 索引寫法，決定指針屬於哪個容器
│  ├─ graph.ts             # 物件圖 / 鄰接串列 → 節點與邊，以及 visited、queue、path 等走訪狀態
│  └─ pointers.ts          # 指針變數偵測與配色
├─ tutorials/              # 雙語演算法教學與範例題（26 個主題、49 題）
├─ components/             # CodeEditor / ArrayView / GridView / StructureViews / GraphView / CollectionViews / Visualizer
│                          # Controls / TabBar / Library / TutorialView
├─ hooks/                  # usePlayback（播放）、useTabs（頁籤 + localStorage）
└─ i18n.tsx                # 中英雙語字串與語言切換
```

### 執行流程

1. 使用者程式碼以 filename `<algoalive>` 編譯後 `exec` 進一個新的 namespace（已預先 `from typing import *`、`from collections import *` 等，與 LeetCode 環境相近）
2. 測試呼叫（例如 `twoSum([2, 7, 11, 15], 9)`）以 `<input>` 編譯，開啟 `sys.settrace` 後執行
3. tracer 只記錄 `co_filename == "<algoalive>"` 的 frame，回傳 JSON：

```ts
interface ExecutionStep {
  stepIndex: number;
  lineNumber: number;                   // line 事件 = 「即將執行」這一行
  variables: Record<string, PyValue>;   // 帶型別標籤，例如 { type: 'list', items: [...] }
  event: 'line' | 'return' | 'exception';
  returnValue?: PyValue;
  exception?: string;
  funcName: string;
  depth: number;                        // 遞迴深度
  stdout: string;                       // 累積的 print 輸出
}
```

`variables` 採用帶型別標籤的 `PyValue`（而非裸 JSON），以區分 `list` / `tuple` / `set`、保留 dict 的非字串 key，並安全表示 `inf`、大整數等 JSON 無法直接表達的值。

### LeetCode `class Solution` 寫法

也可以直接貼 `class Solution:` 的寫法，測試呼叫改成 `Solution().twoSum([2, 7, 11, 15], 9)` 即可（`self` 會自動隱藏）。

### 鏈結串列與二元樹的測資

執行環境已內建 LeetCode 的 `ListNode`、`TreeNode`、`Node`（圖），以及建立測資的輔助函式；`null` / `true` / `false` 也可以直接使用，LeetCode 的測資能原樣貼上：

```python
reverseList(build_list([1, 2, 3, 4, 5]))
hasCycle(build_list([3, 2, 0, -4], pos=1))      # 尾端接回第 1 個節點
maxDepth(build_tree([3, 9, 20, null, null, 15, 7]))
cloneGraph(build_graph([[2, 4], [1, 3], [2, 4], [1, 3]]))   # 1-indexed 鄰接串列
```

tracer 會把自訂類別的實例序列化成帶穩定 id 的參照（`{type: 'ref', id}`），每一步附上可達物件的 `heap`，以及外層呼叫中指向節點的變數（`stackRefs`），前端據此畫出串列與樹。

## License

[MIT](LICENSE)
