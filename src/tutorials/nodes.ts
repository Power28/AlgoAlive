import type { Tutorial } from './types';

export const NODE_TUTORIALS: Tutorial[] = [
  {
    id: 'linked-list',
    category: 'linked-list',
    title: { en: 'Linked List Basics', zh: '鏈結串列基礎' },
    tagline: {
      en: 'Rewire `next` pointers one node at a time; a dummy head removes most edge cases.',
      zh: '一次只改一個節點的 `next`；加一個 dummy 假頭節點可以省掉大部分邊界判斷。',
    },
    whenToUse: [
      { en: 'Reversing all or part of a list.', zh: '反轉整條或部分串列。' },
      { en: 'Merging, splitting or re-ordering lists without extra arrays.', zh: '不額外開陣列，直接合併、拆分或重新排列串列。' },
      { en: 'Deleting nodes where the head itself might be removed.', zh: '刪除節點、而且頭節點本身也可能被刪掉。' },
    ],
    idea: [
      { en: 'Before changing `curr.next`, **save** the old `curr.next` — otherwise the rest of the list is lost.', zh: '改 `curr.next` 之前先把原本的 `curr.next` **存起來**，不然後面整串就斷掉了。' },
      { en: 'Reversal uses three pointers: `prev`, `curr`, `nxt`. Each loop flips exactly one arrow.', zh: '反轉用三個指針：`prev`、`curr`、`nxt`，每一輪剛好翻轉一個箭頭。' },
      { en: '`dummy = ListNode()` in front of the result list lets you always do `tail.next = ...` and return `dummy.next`.', zh: '在結果串列前放 `dummy = ListNode()`，就能一律寫 `tail.next = ...`，最後回傳 `dummy.next`。' },
    ],
    template: `prev, curr = None, head
while curr:
    nxt = curr.next
    curr.next = prev
    prev = curr
    curr = nxt
return prev`,
    complexity: { time: 'O(n)', space: 'O(1)' },
    pitfalls: [
      { en: 'Losing the rest of the list by overwriting `next` before saving it.', zh: '還沒保存就覆寫 `next`，後面的節點全部遺失。' },
      { en: 'Returning `head` after a reversal — the new head is `prev`.', zh: '反轉後還回傳 `head`——新的頭是 `prev`。' },
    ],
    examples: [
      {
        id: 'lc206',
        number: 206,
        title: { en: 'Reverse Linked List', zh: '反轉鏈結串列' },
        difficulty: 'easy',
        note: {
          en: 'Watch nodes move from the `curr` chain to the `prev` chain one at a time; the orange arrow is the `next` that was just changed.',
          zh: '觀察節點一個個從 `curr` 那條移到 `prev` 那條；橘色箭頭是這一步剛改過的 `next`。',
        },
        code: `def reverseList(head: Optional[ListNode]) -> Optional[ListNode]:
    prev = None
    curr = head
    while curr:
        nxt = curr.next
        curr.next = prev
        prev = curr
        curr = nxt
    return prev
`,
        call: 'reverseList(build_list([1, 2, 3, 4, 5]))',
        expected: '5 → 4 → 3 → 2 → 1',
        js: {
          code: `/**
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
      },
      {
        id: 'lc21',
        number: 21,
        title: { en: 'Merge Two Sorted Lists', zh: '合併兩個有序串列' },
        difficulty: 'easy',
        note: {
          en: '`tail` stitches the smaller head onto the result each round; `dummy` is the fixed anchor you return from.',
          zh: '`tail` 每一輪把較小的頭接到結果後面；`dummy` 是固定的錨點，最後從它回傳。',
        },
        code: `def mergeTwoLists(list1: Optional[ListNode], list2: Optional[ListNode]) -> Optional[ListNode]:
    dummy = tail = ListNode()
    while list1 and list2:
        if list1.val <= list2.val:
            tail.next = list1
            list1 = list1.next
        else:
            tail.next = list2
            list2 = list2.next
        tail = tail.next
    tail.next = list1 or list2
    return dummy.next
`,
        call: 'mergeTwoLists(build_list([1, 2, 4]), build_list([1, 3, 4]))',
        expected: '1 → 1 → 2 → 3 → 4 → 4',
        js: {
          code: `/**
 * @param {ListNode} list1
 * @param {ListNode} list2
 * @return {ListNode}
 */
var mergeTwoLists = function(list1, list2) {
    const dummy = new ListNode();
    let tail = dummy;
    while (list1 && list2) {
        if (list1.val <= list2.val) {
            tail.next = list1;
            list1 = list1.next;
        } else {
            tail.next = list2;
            list2 = list2.next;
        }
        tail = tail.next;
    }
    tail.next = list1 || list2;
    return dummy.next;
};
`,
          call: 'list1 = [1,2,4], list2 = [1,3,4]',
          expected: '1 → 1 → 2 → 3 → 4 → 4',
        },
      },
    ],
  },
  {
    id: 'linked-list-fast-slow',
    category: 'linked-list',
    title: { en: 'Fast & Slow Pointers on Lists', zh: '串列上的快慢指針' },
    tagline: {
      en: '`fast` moves two steps while `slow` moves one — they reveal the middle and detect cycles in `O(1)` space.',
      zh: '`fast` 一次走兩步、`slow` 一次走一步——用 `O(1)` 空間找中點、偵測環。',
    },
    whenToUse: [
      { en: 'Finding the middle node (e.g. before splitting for merge sort).', zh: '找中間節點（例如合併排序前先切半）。' },
      { en: 'Detecting a cycle (Floyd\'s tortoise and hare).', zh: '偵測環（Floyd 龜兔賽跑）。' },
      { en: 'Finding the k-th node from the end (give `fast` a k-step head start).', zh: '找倒數第 k 個節點（讓 `fast` 先走 k 步）。' },
    ],
    idea: [
      { en: 'When `fast` reaches the end, `slow` has covered half the distance → the middle.', zh: '`fast` 走到底時，`slow` 剛好走了一半 → 中點。' },
      { en: 'In a cycle, `fast` gains one node per step on `slow`, so they must meet.', zh: '若有環，`fast` 每一步都追近 `slow` 一格，所以一定會相遇。' },
      { en: 'Compare nodes with `is` (identity), not values.', zh: '比較節點要用 `is`（同一個物件），不是比值。' },
    ],
    template: `slow = fast = head
while fast and fast.next:
    slow = slow.next
    fast = fast.next.next`,
    complexity: { time: 'O(n)', space: 'O(1)' },
    pitfalls: [
      { en: 'Checking only `fast` — `fast.next.next` crashes when `fast.next` is `None`.', zh: '只檢查 `fast`——`fast.next` 是 `None` 時 `fast.next.next` 會出錯。' },
      { en: 'For even lengths, this template returns the **second** middle node.', zh: '長度為偶數時，這個模板回傳的是**第二個**中間節點。' },
    ],
    examples: [
      {
        id: 'lc876',
        number: 876,
        title: { en: 'Middle of the Linked List', zh: '鏈結串列的中間節點' },
        difficulty: 'easy',
        note: { en: '`fast` jumps two nodes per step; `slow` lands on the middle when `fast` runs out.', zh: '`fast` 每步跳兩格；`fast` 走不下去時，`slow` 就停在中間。' },
        code: `def middleNode(head: Optional[ListNode]) -> Optional[ListNode]:
    slow = fast = head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
    return slow
`,
        call: 'middleNode(build_list([1, 2, 3, 4, 5, 6]))',
        expected: '4 → 5 → 6',
        js: {
          code: `/**
 * @param {ListNode} head
 * @return {ListNode}
 */
var middleNode = function(head) {
    let slow = head;
    let fast = head;
    while (fast && fast.next) {
        slow = slow.next;
        fast = fast.next.next;
    }
    return slow;
};
`,
          call: 'head = [1,2,3,4,5,6]',
          expected: '4 → 5 → 6',
        },
      },
      {
        id: 'lc141',
        number: 141,
        title: { en: 'Linked List Cycle', zh: '環狀鏈結串列' },
        difficulty: 'easy',
        note: {
          en: 'The red ↺ marks where the tail links back. `build_list(values, pos=1)` creates that cycle.',
          zh: '紅色 ↺ 標示尾端接回的位置；`build_list(values, pos=1)` 就是用來建立這個環。',
        },
        code: `def hasCycle(head: Optional[ListNode]) -> bool:
    slow = fast = head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
        if slow is fast:
            return True
    return False
`,
        call: 'hasCycle(build_list([3, 2, 0, -4], pos=1))',
        expected: 'True',
        js: {
          code: `/**
 * @param {ListNode} head
 * @return {boolean}
 */
var hasCycle = function(head) {
    let slow = head;
    let fast = head;
    while (fast && fast.next) {
        slow = slow.next;
        fast = fast.next.next;
        if (slow === fast) {
            return true;
        }
    }
    return false;
};
`,
          call: 'head = [3,2,0,-4], pos = 1',
          expected: 'true',
        },
      },
    ],
  },
  {
    id: 'tree-dfs',
    category: 'tree',
    title: { en: 'Tree DFS (Recursion)', zh: '樹的 DFS（遞迴）' },
    tagline: {
      en: 'Solve the problem for the left and right subtrees, then combine the answers at the current node.',
      zh: '先解左右子樹，再在目前節點把兩邊的答案合起來。',
    },
    whenToUse: [
      { en: 'Height, diameter, balance — anything computed bottom-up.', zh: '高度、直徑、是否平衡——由下往上計算的問題。' },
      { en: 'Root-to-leaf paths (path sums), passing state downward.', zh: '從根到葉的路徑（路徑總和），把狀態往下傳。' },
      { en: 'Transforming the tree in place (invert, prune).', zh: '原地修改整棵樹（翻轉、剪枝）。' },
    ],
    idea: [
      { en: '**Base case**: an empty node (`None`) returns the neutral answer (0, `True`, …).', zh: '**終止條件**：空節點（`None`）回傳中性值（0、`True`…）。' },
      { en: 'Trust the recursion: assume `dfs(root.left)` already returns the right answer for that subtree.', zh: '相信遞迴：假設 `dfs(root.left)` 已經回傳左子樹的正確答案。' },
      { en: 'Watch the depth indicator — each level of recursion is one level deeper in the tree.', zh: '觀察右上角的深度：每深一層遞迴，就是往樹的下一層走。' },
    ],
    template: `def dfs(node):
    if not node:
        return BASE
    left = dfs(node.left)
    right = dfs(node.right)
    return combine(node.val, left, right)`,
    complexity: { time: 'O(n)', space: 'O(h)', note: { en: '`h` is the tree height: O(log n) if balanced, O(n) if skewed.', zh: '`h` 是樹高：平衡時 O(log n)，退化成一條線時 O(n)。' } },
    pitfalls: [
      { en: 'Forgetting the `None` base case → `AttributeError: \'NoneType\' object has no attribute \'left\'`.', zh: '忘了處理 `None` → `AttributeError: \'NoneType\' object has no attribute \'left\'`。' },
      { en: 'Treating a node with one child as a leaf — a leaf has **no** children.', zh: '把只有一個子節點的節點當成葉子——葉子是**沒有**子節點的。' },
    ],
    examples: [
      {
        id: 'lc104',
        number: 104,
        title: { en: 'Maximum Depth of Binary Tree', zh: '二元樹的最大深度' },
        difficulty: 'easy',
        note: { en: 'The highlighted node is the current `root`; answers bubble up as the recursion returns.', zh: '亮起的節點就是目前的 `root`；答案會隨著遞迴返回一層層往上傳。' },
        code: `def maxDepth(root: Optional[TreeNode]) -> int:
    if not root:
        return 0
    left = maxDepth(root.left)
    right = maxDepth(root.right)
    return 1 + max(left, right)
`,
        call: 'maxDepth(build_tree([3, 9, 20, null, null, 15, 7]))',
        expected: '3',
        js: {
          code: `/**
 * @param {TreeNode} root
 * @return {number}
 */
var maxDepth = function(root) {
    if (!root) {
        return 0;
    }
    const left = maxDepth(root.left);
    const right = maxDepth(root.right);
    return 1 + Math.max(left, right);
};
`,
          call: 'root = [3,9,20,null,null,15,7]',
          expected: '3',
        },
      },
      {
        id: 'lc226',
        number: 226,
        title: { en: 'Invert Binary Tree', zh: '翻轉二元樹' },
        difficulty: 'easy',
        note: { en: 'Each swap makes whole subtrees glide to the other side.', zh: '每次交換，整棵子樹都會滑到另一邊。' },
        code: `def invertTree(root: Optional[TreeNode]) -> Optional[TreeNode]:
    if not root:
        return None
    root.left, root.right = root.right, root.left
    invertTree(root.left)
    invertTree(root.right)
    return root
`,
        call: 'invertTree(build_tree([4, 2, 7, 1, 3, 6, 9]))',
        expected: '[4, 7, 2, 9, 6, 3, 1]',
        js: {
          code: `/**
 * @param {TreeNode} root
 * @return {TreeNode}
 */
var invertTree = function(root) {
    if (!root) {
        return null;
    }
    [root.left, root.right] = [root.right, root.left];
    invertTree(root.left);
    invertTree(root.right);
    return root;
};
`,
          call: 'root = [4,2,7,1,3,6,9]',
          expected: '[4, 7, 2, 9, 6, 3, 1]',
        },
      },
      {
        id: 'lc112',
        number: 112,
        title: { en: 'Path Sum', zh: '路徑總和' },
        difficulty: 'easy',
        note: { en: 'State flows **downward**: each call receives the sum still needed from this node to a leaf.', zh: '狀態**往下**傳：每次呼叫拿到的是「從這裡到葉子還差多少」。' },
        code: `def hasPathSum(root: Optional[TreeNode], targetSum: int) -> bool:
    if not root:
        return False
    remaining = targetSum - root.val
    if not root.left and not root.right:
        return remaining == 0
    return hasPathSum(root.left, remaining) or hasPathSum(root.right, remaining)
`,
        call: 'hasPathSum(build_tree([5, 4, 8, 11, null, 13, 4, 7, 2, null, null, null, 1]), 22)',
        expected: 'True',
        js: {
          code: `/**
 * @param {TreeNode} root
 * @param {number} targetSum
 * @return {boolean}
 */
var hasPathSum = function(root, targetSum) {
    if (!root) {
        return false;
    }
    const remaining = targetSum - root.val;
    if (!root.left && !root.right) {
        return remaining === 0;
    }
    return hasPathSum(root.left, remaining) || hasPathSum(root.right, remaining);
};
`,
          call: 'root = [5,4,8,11,null,13,4,7,2,null,null,null,1], targetSum = 22',
          expected: 'true',
        },
      },
    ],
  },
  {
    id: 'tree-bfs',
    category: 'tree',
    title: { en: 'Tree BFS (Level Order)', zh: '樹的 BFS（層序走訪）' },
    tagline: {
      en: 'Process the tree one level at a time with a queue.',
      zh: '用佇列一次處理一整層。',
    },
    whenToUse: [
      { en: 'Level-order output, zigzag traversal, right-side view.', zh: '層序輸出、鋸齒走訪、右視圖。' },
      { en: 'Minimum depth / shortest path from the root.', zh: '最小深度、從根出發的最短路徑。' },
    ],
    idea: [
      { en: 'Start with `deque([root])`.', zh: '從 `deque([root])` 開始。' },
      { en: 'Freeze `len(queue)` at the start of a level — that many nodes belong to this level.', zh: '每一層開始時先記下 `len(queue)`——這麼多個節點屬於這一層。' },
      { en: 'Pop each one, record it, and push its children for the next level.', zh: '逐一取出、記錄，並把它的子節點放進佇列給下一層。' },
    ],
    template: `queue = deque([root])
while queue:
    for _ in range(len(queue)):
        node = queue.popleft()
        visit(node)
        if node.left:
            queue.append(node.left)
        if node.right:
            queue.append(node.right)`,
    complexity: { time: 'O(n)', space: 'O(w)', note: { en: '`w` is the maximum width of the tree.', zh: '`w` 是樹最寬那一層的節點數。' } },
    pitfalls: [
      { en: 'Using `len(queue)` inside the loop condition — it changes as you push children.', zh: '在迴圈條件裡直接用 `len(queue)`——加入子節點後它會改變。' },
    ],
    examples: [
      {
        id: 'lc102',
        number: 102,
        title: { en: 'Binary Tree Level Order Traversal', zh: '二元樹的層序走訪' },
        difficulty: 'medium',
        note: { en: '`queue` shows nodes as (val); `result` grows one row per level.', zh: '`queue` 以 (val) 顯示節點；`result` 每處理完一層就多一列。' },
        code: `def levelOrder(root: Optional[TreeNode]) -> List[List[int]]:
    if not root:
        return []
    result = []
    queue = deque([root])
    while queue:
        level = []
        for _ in range(len(queue)):
            node = queue.popleft()
            level.append(node.val)
            if node.left:
                queue.append(node.left)
            if node.right:
                queue.append(node.right)
        result.append(level)
    return result
`,
        call: 'levelOrder(build_tree([3, 9, 20, null, null, 15, 7]))',
        expected: '[[3], [9, 20], [15, 7]]',
        js: {
          code: `/**
 * @param {TreeNode} root
 * @return {number[][]}
 */
var levelOrder = function(root) {
    if (!root) {
        return [];
    }
    const result = [];
    const queue = [root];
    while (queue.length) {
        const level = [];
        const size = queue.length;
        for (let i = 0; i < size; i++) {
            const node = queue.shift();
            level.push(node.val);
            if (node.left) {
                queue.push(node.left);
            }
            if (node.right) {
                queue.push(node.right);
            }
        }
        result.push(level);
    }
    return result;
};
`,
          call: 'root = [3,9,20,null,null,15,7]',
          expected: '[[3], [9, 20], [15, 7]]',
        },
      },
    ],
  },
  {
    id: 'bst',
    category: 'tree',
    title: { en: 'Binary Search Tree', zh: '二元搜尋樹（BST）' },
    tagline: {
      en: 'Left subtree < node < right subtree — so every step can discard half of the tree.',
      zh: '左子樹 < 節點 < 右子樹——每一步都能排除一半的樹。',
    },
    whenToUse: [
      { en: 'Searching, inserting or finding the floor / ceiling of a value.', zh: '搜尋、插入、找某值的下界 / 上界。' },
      { en: 'Validating the BST property.', zh: '驗證是否符合 BST 性質。' },
      { en: 'Anything that needs sorted order: an in-order traversal of a BST is sorted.', zh: '需要排序順序時：BST 的中序走訪就是排好序的。' },
    ],
    idea: [
      { en: 'Compare with `node.val` and go left or right — like binary search on a tree.', zh: '和 `node.val` 比較後往左或往右——就是在樹上做二分搜尋。' },
      { en: 'Validation must pass **bounds** down: every node in the left subtree must be < its ancestor, not just its parent.', zh: '驗證時要把**上下界**往下傳：左子樹的所有節點都要小於祖先，不只是父節點。' },
    ],
    complexity: { time: 'O(h)', space: 'O(1) – O(h)' },
    pitfalls: [
      { en: 'Only comparing a node with its direct children when validating.', zh: '驗證時只比較節點和自己的子節點。' },
    ],
    examples: [
      {
        id: 'lc700',
        number: 700,
        title: { en: 'Search in a Binary Search Tree', zh: '二元搜尋樹中的搜尋' },
        difficulty: 'easy',
        note: { en: 'Follow `node` as it walks one path from the root — never both sides.', zh: '跟著 `node` 從根往下走一條路——永遠不會兩邊都走。' },
        code: `def searchBST(root: Optional[TreeNode], val: int) -> Optional[TreeNode]:
    node = root
    while node and node.val != val:
        node = node.left if val < node.val else node.right
    return node
`,
        call: 'searchBST(build_tree([4, 2, 7, 1, 3, 6, 9]), 3)',
        expected: '[3]',
        js: {
          code: `/**
 * @param {TreeNode} root
 * @param {number} val
 * @return {TreeNode}
 */
var searchBST = function(root, val) {
    let node = root;
    while (node && node.val !== val) {
        node = val < node.val ? node.left : node.right;
    }
    return node;
};
`,
          call: 'root = [4,2,7,1,3,6,9], val = 3',
          expected: '[3]',
        },
      },
      {
        id: 'lc98',
        number: 98,
        title: { en: 'Validate Binary Search Tree', zh: '驗證二元搜尋樹' },
        difficulty: 'medium',
        note: { en: 'Watch `low` and `high` tighten as the recursion goes deeper.', zh: '觀察 `low` 和 `high` 隨著遞迴變深而逐漸收緊。' },
        code: `def isValidBST(root: Optional[TreeNode]) -> bool:
    def valid(node: Optional[TreeNode], low: float, high: float) -> bool:
        if not node:
            return True
        if not (low < node.val < high):
            return False
        return valid(node.left, low, node.val) and valid(node.right, node.val, high)

    return valid(root, float('-inf'), float('inf'))
`,
        call: 'isValidBST(build_tree([5, 3, 8, 1, 4, 7, 9]))',
        expected: 'True',
        js: {
          code: `/**
 * @param {TreeNode} root
 * @return {boolean}
 */
var isValidBST = function(root) {
    const valid = (node, low, high) => {
        if (!node) {
            return true;
        }
        if (!(low < node.val && node.val < high)) {
            return false;
        }
        return valid(node.left, low, node.val) && valid(node.right, node.val, high);
    };
    return valid(root, -Infinity, Infinity);
};
`,
          call: 'root = [5,3,8,1,4,7,9]',
          expected: 'true',
        },
      },
    ],
  },
];
