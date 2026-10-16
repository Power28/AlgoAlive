"""AlgoAlive Python Execution Tracer.

使用 sys.settrace 攔截使用者函式每一行的執行狀態，序列化成 JSON 回傳給前端。
只追蹤 filename == USER_FILE 的 frame，因此 typing / collections 等內部呼叫不會被記錄。
"""
import ast
import builtins
import copy
import io
import json
import math
import operator
import sys
import types
import collections
import collections.abc
import difflib
import inspect
import re

MAX_STEPS = 500          # 預設的步數上限；到達上限後使用者可以選擇追蹤更多步
MAX_STEPS_LIMIT = 5000   # 最多能追蹤的步數（約 13 MB 的追蹤資料）
MAX_ITEMS = 100      # 單一容器最多序列化的元素數
SPARSE_HEAD = 10     # 超過 MAX_ITEMS 的陣列：開頭保留幾格
SPARSE_TAIL = 5      # 結尾保留幾格
SPARSE_AROUND = 4    # 每個指針（整數變數）前後各保留幾格
SPARSE_MAX = 150     # 最多送出幾格
MAX_DEPTH = 5        # 巢狀容器最大深度
MAX_STR = 200
MAX_STDOUT = 10000
MAX_NODES = 120      # 每一步最多展開的自訂物件（ListNode / TreeNode…）數量
USER_FILE = "<algoalive>"
INPUT_FILE = "<input>"
PRELUDE_FILE = "<prelude>"

PRELUDE = """
from typing import *
from collections import *
import collections, math, heapq, bisect, itertools, functools, string, re

# 讓 LeetCode 的測資可以直接貼上
null, true, false = None, True, False


class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

    def __repr__(self):
        return f"ListNode({self.val})"


class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

    def __repr__(self):
        return f"TreeNode({self.val})"


class Node:
    # LeetCode 圖題（133. Clone Graph）的節點
    def __init__(self, val=0, neighbors=None):
        self.val = val
        self.neighbors = neighbors if neighbors is not None else []

    def __repr__(self):
        return f"Node({self.val})"


class TrieNode:
    # 字典樹節點：children[字元] → 子節點，is_end 標示單字結尾
    def __init__(self):
        self.children = {}
        self.is_end = False

    def __repr__(self):
        return "TrieNode"


_algoalive_design = None


def run_design(ops, args):
    # 設計類題目：ops[0] 建立物件，之後依序呼叫方法；回傳每個操作的輸出（建構子為 None）
    global _algoalive_design
    out = []
    _algoalive_design = {"index": 0, "outputs": out}
    obj = globals()[ops[0]](*args[0])
    out.append(None)
    for k in range(1, len(ops)):
        _algoalive_design["index"] = k
        out.append(getattr(obj, ops[k])(*args[k]))
    _algoalive_design["index"] = len(ops)
    return out


def build_graph(adj_list):
    # LeetCode 的鄰接串列（1-indexed）[[2, 4], [1, 3], ...] → 回傳節點 1
    nodes = [Node(i + 1) for i in range(len(adj_list))]
    for node, nbrs in zip(nodes, adj_list):
        node.neighbors = [nodes[j - 1] for j in nbrs]
    return nodes[0] if nodes else None


def build_list(values, pos=-1):
    # [1, 2, 3] → 1 -> 2 -> 3；pos >= 0 時讓尾端接回第 pos 個節點形成環
    dummy = tail = ListNode()
    nodes = []
    for v in values:
        tail.next = ListNode(v)
        tail = tail.next
        nodes.append(tail)
    if 0 <= pos < len(nodes):
        tail.next = nodes[pos]
    return dummy.next


def build_tree(values):
    # LeetCode 的層序表示法 [3, 9, 20, null, null, 15, 7] → TreeNode
    if not values or values[0] is None:
        return None
    root = TreeNode(values[0])
    queue = deque([root])
    i = 1
    while queue and i < len(values):
        node = queue.popleft()
        if i < len(values) and values[i] is not None:
            node.left = TreeNode(values[i])
            queue.append(node.left)
        i += 1
        if i < len(values) and values[i] is not None:
            node.right = TreeNode(values[i])
            queue.append(node.right)
        i += 1
    return root
"""

_SKIP_TYPES = (
    types.FunctionType, types.BuiltinFunctionType, types.MethodType,
    types.ModuleType, type,
)


class _Registry:
    """整次執行共用：替自訂物件配發穩定 id，讓前端知道不同步驟、不同變數指向的是同一個節點。"""

    def __init__(self):
        self.ids = {}
        self.alive = []  # 保留參照，避免物件被回收後 id() 被重複使用

    def sid(self, obj):
        key = id(obj)
        if key not in self.ids:
            self.ids[key] = f"o{len(self.ids) + 1}"
            self.alive.append(obj)
        return self.ids[key]


class _Ctx:
    """單一步驟的序列化狀態：收集這一步可達的所有自訂物件（heap）。"""

    def __init__(self, registry):
        self.registry = registry
        self.heap = {}
        self.queue = []
        # 這一步的整數變數：大陣列只送出這些位置（可能是指針）附近的格子
        self.focus = set()

    def ref(self, obj):
        sid = self.registry.sid(obj)
        if sid not in self.heap and len(self.heap) < MAX_NODES:
            self.heap[sid] = None
            self.queue.append((sid, obj))
        return {"type": "ref", "id": sid, "cls": type(obj).__name__}

    def drain(self):
        """展開所有待處理物件的欄位（欄位中的物件又會排進佇列），回傳 heap。"""
        while self.queue:
            sid, obj = self.queue.pop(0)
            fields = {}
            for k, val in vars(obj).items():
                if k.startswith("__") or isinstance(val, _SKIP_TYPES):
                    continue
                fields[k] = _ser(val, self)
            self.heap[sid] = {"cls": type(obj).__name__, "fields": fields}
        return {k: v for k, v in self.heap.items() if v is not None}


def _is_object(v):
    """使用者 / prelude 定義的類別實例（ListNode、TreeNode…）→ 以參照方式序列化。"""
    return type(v).__module__ == "__main__" and hasattr(v, "__dict__") and not isinstance(v, BaseException)


def _sparse_indexes(n, focus):
    """大陣列要送出的位置：開頭、結尾、每個指針前後幾格（由小到大，最多 SPARSE_MAX 格）"""
    keep = set(range(min(SPARSE_HEAD, n))) | set(range(max(0, n - SPARSE_TAIL), n))
    # 離開頭近的指針先保留，超過上限時捨棄較後面的
    for f in sorted(focus):
        for i in range(f - SPARSE_AROUND, f + SPARSE_AROUND + 1):
            if 0 <= i < n:
                keep.add(i)
        if len(keep) >= SPARSE_MAX:
            break
    return sorted(keep)[:SPARSE_MAX]


def _ser(v, ctx=None, depth=0, seen=None):
    """把 Python 值轉成帶型別標籤的 JSON 結構；自訂物件轉成 ref 並收進 ctx.heap。"""
    if seen is None:
        seen = set()
    if v is None:
        return {"type": "none"}
    if isinstance(v, bool):
        return {"type": "bool", "value": v}
    if isinstance(v, int):
        # 超過 JS 安全整數範圍時改用字串，避免精度遺失
        if abs(v) > 2 ** 53:
            return {"type": "int", "value": str(v)}
        return {"type": "int", "value": v}
    if isinstance(v, float):
        if math.isinf(v) or math.isnan(v):
            return {"type": "float", "value": repr(v)}
        return {"type": "float", "value": v}
    if isinstance(v, str):
        s = v if len(v) <= MAX_STR else v[:MAX_STR] + "…"
        return {"type": "str", "value": s}

    if ctx is not None and _is_object(v):
        return ctx.ref(v)
    if depth >= MAX_DEPTH:
        return {"type": "repr", "value": "…"}
    if id(v) in seen:
        return {"type": "repr", "value": "[circular]"}

    seen = seen | {id(v)}
    if isinstance(v, (list, tuple, collections.deque)):
        kind = "list" if isinstance(v, list) else ("tuple" if isinstance(v, tuple) else "deque")
        items = list(v)
        if len(items) > MAX_ITEMS and depth == 0 and ctx is not None:
            # 大陣列：開頭、結尾，以及每個指針附近的格子；index 是每一格的真實索引
            keep = _sparse_indexes(len(items), ctx.focus)
            return {"type": kind, "items": [_ser(items[i], ctx, depth + 1, seen) for i in keep], "index": keep, "length": len(items)}
        out = {"type": kind, "items": [_ser(x, ctx, depth + 1, seen) for x in items[:MAX_ITEMS]]}
        if len(items) > MAX_ITEMS:
            out["truncated"] = len(items) - MAX_ITEMS
        return out
    if isinstance(v, (set, frozenset)):
        try:
            items = sorted(v)
        except TypeError:
            items = list(v)
        out = {"type": "set", "items": [_ser(x, ctx, depth + 1, seen) for x in items[:MAX_ITEMS]]}
        if len(items) > MAX_ITEMS:
            out["truncated"] = len(items) - MAX_ITEMS
        return out
    if isinstance(v, dict):
        entries = list(v.items())
        out = {
            "type": "dict",
            "entries": [[_ser(k, ctx, depth + 1, seen), _ser(x, ctx, depth + 1, seen)] for k, x in entries[:MAX_ITEMS]],
        }
        if isinstance(v, collections.Counter):
            out["cls"] = "Counter"
        elif isinstance(v, collections.defaultdict):
            out["cls"] = "defaultdict"
        if len(entries) > MAX_ITEMS:
            out["truncated"] = len(entries) - MAX_ITEMS
        return out

    try:
        r = repr(v)
    except Exception:
        r = "<unrepresentable>"
    if len(r) > MAX_STR:
        r = r[:MAX_STR] + "…"
    return {"type": "repr", "value": r, "cls": type(v).__name__}


# ─────────────── 條件式（比較運算）的求值紀錄 ───────────────

COND_FILE = "<condition>"
# 求值時可以呼叫的函式：都不會修改資料
_PURE_CALLS = {
    "len", "abs", "min", "max", "sum", "int", "float", "str", "bool", "ord", "chr",
    "sorted", "tuple", "list", "set", "isinstance", "round", "any", "all", "range",
}
_UNSAFE_NODES = (
    ast.NamedExpr, ast.Await, ast.Yield, ast.YieldFrom, ast.Lambda,
    ast.ListComp, ast.SetComp, ast.DictComp, ast.GeneratorExp,
)
_CMP_OPS = {
    ast.Eq: ("==", operator.eq), ast.NotEq: ("!=", operator.ne),
    ast.Lt: ("<", operator.lt), ast.LtE: ("<=", operator.le),
    ast.Gt: (">", operator.gt), ast.GtE: (">=", operator.ge),
    ast.Is: ("is", operator.is_), ast.IsNot: ("is not", operator.is_not),
    ast.In: ("in", lambda a, b: a in b), ast.NotIn: ("not in", lambda a, b: a not in b),
}
_MAX_DISPLAY = 14
_MAX_STAGES = 6
# 這些函式出現在賦值右邊時也算「計算」（例如 n = len(nums)、best = max(best, area)）
_CALC_CALLS = {"len", "abs", "min", "max", "sum", "round", "int", "float"}
_LEAF_NODES = (ast.Name, ast.Subscript, ast.Attribute)
_BIT_OPS = {ast.BitAnd: "&", ast.BitOr: "|", ast.BitXor: "^", ast.LShift: "<<", ast.RShift: ">>"}
_MAX_BITS_VALUE = 2 ** 32
_MIN_BITS_VALUE = -(2 ** 31)  # 負數以 32 位以內的二補數顯示


def _var_of(node):
    """畫面上的變數名稱：x，或設計類題目的 self.x"""
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute) and isinstance(node.value, ast.Name) and node.value.id == "self":
        return f"self.{node.attr}"
    return None


def _lookup_var(name, frame):
    if name.startswith("self."):
        obj = frame.f_locals.get("self")
        return getattr(obj, name[5:], None) if obj is not None else None
    if name in frame.f_locals:
        return frame.f_locals[name]
    return frame.f_globals.get(name)


class _Unknown(Exception):
    """運算元含有不能安全求值的部分（例如 stack.pop()），或求值時出錯"""


def _is_pure(node):
    for n in ast.walk(node):
        if isinstance(n, _UNSAFE_NODES):
            return False
        if isinstance(n, ast.Call) and not (isinstance(n.func, ast.Name) and n.func.id in _PURE_CALLS):
            return False
    return True


class _CondAnalyzer:
    """解析使用者程式碼，找出每一行敘述的條件式，並在執行到該行時算出每個比較的值。"""

    def __init__(self, code, registry):
        self.code = code
        self.registry = registry
        self.by_line = {}
        self.calc_by_line = {}
        self.multi_by_line = {}
        self.jump_by_line = {}
        self.slices_by_line = {}
        self.comp_by_line = {}
        self.compiled = {}
        self.names = {}  # 運算式 → 用到的變數名稱
        self.tree = None
        try:
            tree = ast.parse(code)
        except SyntaxError:
            return
        self.tree = tree
        self._collect_jumps(tree, None)
        for node in ast.walk(tree):
            if not isinstance(node, ast.stmt) or node.lineno in self.by_line or node.lineno in self.calc_by_line:
                continue
            self._collect_slices(node)
            self._collect_comp(node)
            expr = self._condition_of(node)
            if expr is not None:
                is_test = isinstance(node, (ast.If, ast.While, ast.Assert)) or isinstance(getattr(node, "value", None), ast.IfExp)
                self.by_line[node.lineno] = (expr, "test" if is_test else "value")
                continue
            multi = self._multi_of(node)
            if multi is not None:
                self.multi_by_line[node.lineno] = multi
                continue
            calc = self._calc_of(node)
            if calc is not None:
                self.calc_by_line[node.lineno] = calc

    @staticmethod
    def _condition_of(stmt):
        if isinstance(stmt, (ast.If, ast.While, ast.Assert)):
            return stmt.test
        value = getattr(stmt, "value", None)
        if isinstance(stmt, (ast.Return, ast.Assign, ast.AugAssign, ast.AnnAssign, ast.Expr)) and value is not None:
            if isinstance(value, ast.IfExp):
                return value.test
            if isinstance(value, (ast.Compare, ast.BoolOp)) or (isinstance(value, ast.UnaryOp) and isinstance(value.op, ast.Not)):
                return value
        return None

    @staticmethod
    def _has_arith(node):
        for n in ast.walk(node):
            if isinstance(n, ast.BinOp):
                return True
            if isinstance(n, ast.UnaryOp) and isinstance(n.op, (ast.USub, ast.Invert)) and not isinstance(n.operand, ast.Constant):
                return True
            if isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id in _CALC_CALLS:
                return True
        return False

    def _calc_of(self, stmt):
        """回傳 (種類, 寫入目標或 None, 要逐步計算的運算式, 敘述原文)；不是算術就回傳 None"""
        if isinstance(stmt, ast.AugAssign):
            # left += 1 → 計算 left + 1
            target_load = ast.parse(self._src(stmt.target), mode="eval").body
            expr = ast.fix_missing_locations(ast.copy_location(ast.BinOp(left=target_load, op=stmt.op, right=stmt.value), stmt.value))
            return ("aug", stmt.target, expr, self._src(stmt))
        if isinstance(stmt, ast.Assign) and len(stmt.targets) == 1 and self._has_arith(stmt.value):
            return ("assign", stmt.targets[0], stmt.value, self._src(stmt))
        if isinstance(stmt, ast.AnnAssign) and stmt.value is not None and self._has_arith(stmt.value):
            return ("assign", stmt.target, stmt.value, self._src(stmt))
        if isinstance(stmt, ast.Return) and stmt.value is not None and self._has_arith(stmt.value):
            return ("return", None, stmt.value, self._src(stmt))
        return None

    def _src(self, node):
        return ast.get_source_segment(self.code, node) or ast.unparse(node)

    def _eval(self, node, frame):
        if not _is_pure(node):
            raise _Unknown()
        key = id(node)
        if key not in self.compiled:
            self.compiled[key] = compile(ast.Expression(node), COND_FILE, "eval")
            self.names[key] = {n.id for n in ast.walk(node) if isinstance(n, ast.Name)}
        local = frame.f_locals
        for name in self.names[key]:
            # 迭代器 / 產生器只能走訪一次：預先求值（例如 sum(it)）會把它用掉
            value = local[name] if name in local else frame.f_globals.get(name)
            if isinstance(value, collections.abc.Iterator):
                raise _Unknown()
        try:
            return eval(self.compiled[key], frame.f_globals, dict(local))
        except Exception as exc:  # 例如 stack 為空時的 stack[-1]
            raise _Unknown() from exc

    def _short(self, src, value):
        """顯示用：短的純量顯示值，其他（容器、物件）顯示原本的寫法"""
        if value is None or isinstance(value, (bool, int, float, str)):
            r = repr(value)
            if len(r) <= _MAX_DISPLAY:
                return r
        return src

    def _locate(self, node, frame):
        """運算元在畫面上對應的位置：變數、序列的某格、grid 的某格、某個節點"""
        try:
            name = _var_of(node)
            if name is not None and not (name.startswith("self.") and _is_object(_lookup_var(name, frame))):
                return {"var": name}
            if isinstance(node, ast.Subscript):
                idx = self._eval(node.slice, frame)
                if _var_of(node.value) and isinstance(idx, int):
                    return {"var": _var_of(node.value), "index": idx}
                inner = node.value
                if isinstance(inner, ast.Subscript) and _var_of(inner.value) and isinstance(idx, int):
                    row = self._eval(inner.slice, frame)
                    if isinstance(row, int):
                        return {"var": _var_of(inner.value), "index": row, "col": idx}
            if isinstance(node, ast.Attribute):
                obj = self._eval(node.value, frame)
                if _is_object(obj):
                    return {"ref": self.registry.sid(obj)}
        except _Unknown:
            pass
        return None

    def _term(self, node, frame, ctx):
        src = self._src(node)
        term = {"src": src}
        loc = self._locate(node, frame)
        if loc:
            term["loc"] = loc
        try:
            value = self._eval(node, frame)
        except _Unknown:
            term["display"] = src
            return term, None, False
        term["value"] = _ser(value, ctx)
        term["display"] = self._short(src, value)
        return term, value, True

    def _walk(self, node, frame, ctx, parts, skip, order):
        """
        回傳 (顯示字串, 真假, 實際值, 樹節點)。
        真假為 None 代表無法得知或被短路跳過；order 依求值順序替比較與取值編號，前端照順序播放。
        and / or 的實際值是 Python 真正回傳的那個運算元（例如 list1 or list2 回傳的是節點）。
        """
        src = self._src(node)
        if isinstance(node, ast.BoolOp):
            op = "and" if isinstance(node.op, ast.And) else "or"
            entered_skipped = skip
            shown, children = [], []
            truthy, value, short_at = None, None, None
            for i, sub in enumerate(node.values):
                text, t, v, child = self._walk(sub, frame, ctx, parts, skip, order)
                shown.append(text)
                children.append(child)
                if skip:
                    continue
                truthy, value = t, v
                stop = t is None or (op == "and" and not t) or (op == "or" and t)
                if stop:
                    skip = True  # 短路：後面的不會被求值
                    if t is not None and i < len(node.values) - 1:
                        short_at = i
            tree = {"op": op, "src": src, "children": children, "truthy": truthy, "skipped": entered_skipped}
            if truthy is not None:
                tree["value"] = _ser(value, ctx)
            if short_at is not None:
                tree["shortCircuitAt"] = short_at
            return f" {op} ".join(shown), truthy, value, tree

        if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.Not):
            text, t, _, child = self._walk(node.operand, frame, ctx, parts, skip, order)
            truthy = None if t is None else not t
            tree = {"op": "not", "src": src, "children": [child], "truthy": truthy, "skipped": skip}
            if truthy is not None:
                tree["value"] = _ser(truthy, ctx)
            return f"not {text}", truthy, truthy, tree

        if isinstance(node, ast.Compare):
            if skip:
                parts.append({"kind": "cmp", "src": src, "skipped": True})
                return "…", None, None, {"op": "cmp", "src": src, "skipped": True}
            terms, values, ok = [], [], True
            for operand in [node.left, *node.comparators]:
                term, value, known = self._term(operand, frame, ctx)
                terms.append(term)
                values.append(value)
                ok = ok and known
            ops = [_CMP_OPS[type(o)] for o in node.ops]
            result = None
            if ok:
                try:
                    result = all(fn(values[i], values[i + 1]) for i, (_, fn) in enumerate(ops))
                except Exception:
                    result = None
            text = terms[0]["display"] + "".join(f" {sym} {t['display']}" for (sym, _), t in zip(ops, terms[1:]))
            parts.append({"kind": "cmp", "src": src, "terms": terms, "ops": [sym for sym, _ in ops], "display": text, "result": result})
            tree = {"op": "cmp", "src": src, "display": text, "truthy": result, "skipped": False, "order": len(order)}
            order.append(src)
            if result is not None:
                tree["value"] = _ser(result, ctx)
            return text, result, result, tree

        # 其他運算式（例如 while queue: 的 queue）：看它的真假值
        if skip:
            parts.append({"kind": "truth", "src": src, "skipped": True})
            return "…", None, None, {"op": "leaf", "src": src, "skipped": True}
        term, value, known = self._term(node, frame, ctx)
        truthy = bool(value) if known else None
        parts.append({"kind": "truth", "src": src, "terms": [term], "display": term["display"], "result": truthy})
        tree = {"op": "leaf", "src": src, "display": term["display"], "truthy": truthy, "skipped": False, "order": len(order)}
        order.append(src)
        if known:
            tree["value"] = term["value"]
        return term["display"], truthy, value, tree

    @staticmethod
    def _subst(node, repl, wrap_negative=False):
        """把 repl 中的子節點換成顯示用的名稱節點，回傳新的 AST（不改動原本的樹）"""
        if id(node) in repl:
            text = repl[id(node)]
            # -n 代入 n = -6 要寫成 -(-6)；5 - n 寫成 5 - (-3)，不能變成 --6、5 - -3
            if wrap_negative and text.startswith("-"):
                text = f"({text})"
            return ast.Name(id=text, ctx=ast.Load())
        new = copy.copy(node)
        for field, value in ast.iter_fields(node):
            if isinstance(value, ast.AST):
                wrap = isinstance(node, ast.UnaryOp) or (isinstance(node, ast.BinOp) and (field == "right" or isinstance(node.op, ast.Pow)))
                setattr(new, field, _CondAnalyzer._subst(value, repl, wrap))
            elif isinstance(value, list):
                setattr(new, field, [_CondAnalyzer._subst(v, repl) if isinstance(v, ast.AST) else v for v in value])
        return new

    @staticmethod
    def _render(node):
        """運算式轉回文字；tuple 不加外層括號（a, b = 0, 6 的右邊）"""
        text = ast.unparse(node)
        if isinstance(node, ast.Tuple) and text.startswith("(") and text.endswith(")"):
            text = text[1:-1]
        return text

    @staticmethod
    def _result_short(value):
        """計算結果的顯示：純量照 repr；短的容器也照 repr，長的只標長度"""
        if isinstance(value, tuple):
            return ", ".join(map(repr, value)) if len(repr(value)) <= 40 else f"({len(value)} items)"
        if isinstance(value, (list, set, dict)):
            r = repr(value)
            return r if len(r) <= 40 else f"{type(value).__name__} of {len(value)}"
        r = repr(value)
        return r if len(r) <= 40 else r[:39] + "…"

    def _calc(self, frame, ctx):
        if frame.f_lineno in self.multi_by_line:
            return None
        spec = self.calc_by_line.get(frame.f_lineno)
        if spec is None:
            return None
        kind, target, expr, stmt_src = spec
        if not _is_pure(expr):
            return None

        # 1) 葉節點：變數、索引、屬性（min / max 這類函式名稱本身不算）
        leaves, terms, repl = [], [], {}

        def collect(n):
            if isinstance(n, _LEAF_NODES):
                leaves.append(n)
                return
            for field, value in ast.iter_fields(n):
                if isinstance(n, ast.Call) and field == "func":
                    continue
                for child in value if isinstance(value, list) else [value]:
                    if isinstance(child, ast.AST):
                        collect(child)

        collect(expr)
        for leaf in leaves:
            term, _, known = self._term(leaf, frame, ctx)
            if not known:
                return None
            terms.append(term)
            if term["display"] != term["src"]:
                repl[id(leaf)] = term["display"]

        # 2) 由內而外算出每個運算
        stages = [self._render(self._subst(expr, repl))]
        composites = []

        def post_order(n):
            if isinstance(n, _LEAF_NODES) or isinstance(n, ast.Constant):
                return
            for child in ast.iter_child_nodes(n):
                if isinstance(n, ast.Call) and child is n.func:
                    continue
                post_order(child)
            if isinstance(n, (ast.BinOp, ast.UnaryOp, ast.Call)):
                composites.append(n)

        post_order(expr)
        bits = []
        try:
            for node in composites:
                value = self._eval(node, frame)
                repl[id(node)] = self._result_short(value)
                stages.append(self._render(self._subst(expr, repl)))
                if isinstance(node, ast.BinOp) and type(node.op) in _BIT_OPS:
                    left, right = self._eval(node.left, frame), self._eval(node.right, frame)
                    ints = [x for x in (left, right, value) if isinstance(x, int) and not isinstance(x, bool)]
                    if len(ints) == 3 and all(_MIN_BITS_VALUE <= x < _MAX_BITS_VALUE for x in ints):
                        bits.append({"op": _BIT_OPS[type(node.op)], "left": left, "right": right, "result": value})
                elif isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.Invert):
                    operand = self._eval(node.operand, frame)
                    ints = [x for x in (operand, value) if isinstance(x, int) and not isinstance(x, bool)]
                    if len(ints) == 2 and all(_MIN_BITS_VALUE <= x < _MAX_BITS_VALUE for x in ints):
                        bits.append({"op": "~", "left": operand, "right": 0, "result": value})
            result = self._eval(expr, frame)
        except _Unknown:
            return None

        result_display = self._result_short(result)
        stages.append(result_display)
        # 去掉相鄰重複，太長時保留頭尾
        dedup = [st for i, st in enumerate(stages) if i == 0 or st != stages[i - 1]]
        if len(dedup) > _MAX_STAGES:
            dedup = dedup[:2] + dedup[-(_MAX_STAGES - 2):]

        calc = {
            "kind": kind,
            "src": stmt_src,
            "expr": self._src(expr) if kind != "aug" else ast.unparse(expr),
            "stages": dedup,
            "result": _ser(result, ctx),
            "resultDisplay": result_display,
            "terms": terms,
        }
        if bits:
            calc["bits"] = bits
        if target is not None:
            calc["target"] = self._src(target)
            loc = self._locate(target, frame)
            if loc:
                calc["targetLoc"] = loc
        return calc

    # ─────────── break / continue ───────────

    def _collect_jumps(self, node, loop):
        """記錄每個 break / continue 所屬的最內層迴圈（不跨越函式定義）"""
        for child in ast.iter_child_nodes(node):
            if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda, ast.ClassDef)):
                self._collect_jumps(child, None)
            elif isinstance(child, (ast.For, ast.While)):
                # else 區塊不算在迴圈內
                for part in child.body:
                    self._collect_jumps_stmt(part, child)
                for part in child.orelse:
                    self._collect_jumps_stmt(part, loop)
                self._collect_jumps(child.iter if isinstance(child, ast.For) else child.test, loop)
            elif isinstance(child, (ast.Break, ast.Continue)) and loop is not None:
                header = self.code.splitlines()[loop.lineno - 1].strip().rstrip(":")
                self.jump_by_line[child.lineno] = {
                    "kind": "break" if isinstance(child, ast.Break) else "continue",
                    "loopLine": loop.lineno,
                    "loopSrc": header,
                }
            else:
                self._collect_jumps(child, loop)

    def _collect_jumps_stmt(self, stmt, loop):
        if isinstance(stmt, (ast.Break, ast.Continue)) and loop is not None:
            header = self.code.splitlines()[loop.lineno - 1].strip().rstrip(":")
            self.jump_by_line[stmt.lineno] = {
                "kind": "break" if isinstance(stmt, ast.Break) else "continue",
                "loopLine": loop.lineno,
                "loopSrc": header,
            }
        elif isinstance(stmt, (ast.For, ast.While)):
            for part in stmt.body:
                self._collect_jumps_stmt(part, stmt)
            for part in stmt.orelse:
                self._collect_jumps_stmt(part, loop)
        elif isinstance(stmt, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            self._collect_jumps(stmt, None)
        else:
            for child in ast.iter_child_nodes(stmt):
                if isinstance(child, ast.stmt):
                    self._collect_jumps_stmt(child, loop)

    # ─────────── 同時賦值 a, b = b, a ───────────

    @staticmethod
    def _multi_of(stmt):
        if not (isinstance(stmt, ast.Assign) and len(stmt.targets) == 1):
            return None
        t, v = stmt.targets[0], stmt.value
        if not (isinstance(t, (ast.Tuple, ast.List)) and isinstance(v, (ast.Tuple, ast.List))):
            return None
        if len(t.elts) != len(v.elts) or len(t.elts) < 2:
            return None
        if any(isinstance(e, ast.Starred) for e in [*t.elts, *v.elts]):
            return None
        return stmt

    def multi(self, frame, ctx):
        stmt = self.multi_by_line.get(frame.f_lineno)
        if stmt is None:
            return None
        try:
            targets, values = stmt.targets[0].elts, stmt.value.elts
            pairs = []
            for t, v in zip(targets, values):
                term, value, known = self._term(v, frame, ctx)
                if not known:
                    return None  # 右邊有無法安全求值的部分（例如 stack.pop()）
                pair = {"target": self._src(t), "valueSrc": term["src"], "value": term["value"], "display": self._result_short(value)}
                if term.get("loc"):
                    pair["loc"] = term["loc"]
                tloc = self._locate(t, frame)
                if tloc:
                    pair["targetLoc"] = tloc
                pairs.append(pair)
            tsrc = [p["target"] for p in pairs]
            vsrc = [p["valueSrc"] for p in pairs]
            swap = sorted(tsrc) == sorted(vsrc) and tsrc != vsrc
            return {"src": self._src(stmt), "pairs": pairs, "swap": swap}
        except Exception:
            return None

    # ─────────── 切片 s[i:j] ───────────

    def _collect_slices(self, stmt):
        found = []
        for n in ast.walk(stmt):
            if isinstance(n, (ast.FunctionDef, ast.Lambda)) and n is not stmt:
                continue
            if isinstance(n, ast.Subscript) and isinstance(n.slice, ast.Slice) and _var_of(n.value):
                found.append(n)
        # 只記錄這一行敘述本身的切片（巢狀區塊各自的行另外記）
        mine = [n for n in found if n.lineno == stmt.lineno]
        if mine and stmt.lineno not in self.slices_by_line:
            self.slices_by_line[stmt.lineno] = mine

    def slices(self, frame, ctx):
        out = []
        for node in self.slices_by_line.get(frame.f_lineno, []):
            try:
                seq = self._eval(node.value, frame)
                if not isinstance(seq, (list, tuple, str, collections.deque)):
                    continue
                sl = node.slice
                parts = [self._eval(x, frame) if x is not None else None for x in (sl.lower, sl.upper, sl.step)]
                start, stop, step = slice(*parts).indices(len(seq))
                result = self._eval(node, frame)
                out.append({
                    "var": _var_of(node.value), "src": self._src(node), "start": start, "stop": stop, "step": step,
                    "display": self._result_short(result),
                })
            except (_Unknown, TypeError, ValueError):
                continue
        return out

    # ─────────── 推導式 [f(x) for x in seq if cond] ───────────

    def _collect_comp(self, stmt):
        for n in ast.walk(stmt):
            if isinstance(n, (ast.ListComp, ast.SetComp, ast.DictComp)) and len(n.generators) == 1:
                gen = n.generators[0]
                if isinstance(gen.target, ast.Name) and not gen.is_async and n.lineno == stmt.lineno:
                    self.comp_by_line.setdefault(stmt.lineno, n)
                    return

    def comp(self, frame, ctx, state):
        """state：這個 frame 這一行推導式的進度 {"acc": [...], "count": k}；由呼叫端依 frame 保存"""
        node = self.comp_by_line.get(frame.f_lineno)
        if node is None:
            return None
        gen = node.generators[0]
        var = gen.target.id
        kind = "list" if isinstance(node, ast.ListComp) else "set" if isinstance(node, ast.SetComp) else "dict"
        info = {"src": self._src(node), "kind": kind, "item": var}
        if var not in frame.f_locals:
            # 剛開始（還沒拿到第一個元素）
            state.clear()
            state.update({"acc": [], "count": 0})
            info.update({"count": 0, "result": _ser([] if kind == "list" else set() if kind == "set" else {}, ctx)})
            return info
        if "acc" not in state:
            return None
        try:
            # 每次回到推導式開頭時，迭代變數還是「剛處理完」的那個元素：依它重算這一圈的結果
            item = frame.f_locals[var]
            keep = all(bool(self._eval(c, frame)) for c in gen.ifs)
            state["count"] += 1
            info.update({"count": state["count"], "itemDisplay": self._result_short(item), "kept": keep})
            if keep:
                if kind == "dict":
                    k, v = self._eval(node.key, frame), self._eval(node.value, frame)
                    state["acc"].append((k, v))
                    info["valueDisplay"] = f"{self._result_short(k)}: {self._result_short(v)}"
                else:
                    v = self._eval(node.elt, frame)
                    state["acc"].append(v)
                    info["valueDisplay"] = self._result_short(v)
            acc = state["acc"]
            built = acc if kind == "list" else set(acc) if kind == "set" else dict(acc)
            info["result"] = _ser(built, ctx)
            return info
        except Exception:
            return None

    def evaluate_calc(self, frame, ctx):
        try:
            return self._calc(frame, ctx)
        except Exception:
            return None

    def evaluate(self, frame, ctx):
        spec = self.by_line.get(frame.f_lineno)
        if spec is None:
            return None
        expr, context = spec
        parts = []
        try:
            display, truthy, value, tree = self._walk(expr, frame, ctx, parts, False, [])
        except Exception:
            return None
        cond = {"src": self._src(expr), "display": display, "result": truthy, "parts": parts, "tree": tree, "context": context}
        if truthy is not None:
            cond["value"] = _ser(value, ctx)
        return cond


# ─────────────── 容器操作（append / pop / heappush…） ───────────────

_METHOD_OPS = {
    "append": "push", "appendleft": "pushleft", "pop": "pop", "popleft": "popleft",
    "insert": "insert", "extend": "extend", "remove": "remove",
    "add": "add", "discard": "discard", "clear": "clear",
}
_HEAPQ_OPS = {"heappush", "heappop", "heapify", "heappushpop", "heapreplace"}


class _OpAnalyzer:
    """找出每一行的容器操作，執行到該行時（操作尚未發生）以唯讀方式算出會放入 / 取出的值。"""

    def __init__(self, analyzer):
        self.analyzer = analyzer
        self.by_line = {}
        if analyzer.tree is None:
            return
        for node in ast.walk(analyzer.tree):
            if isinstance(node, ast.stmt) and node.lineno not in self.by_line:
                spec = self._op_of(node)
                if spec:
                    self.by_line[node.lineno] = spec

    @staticmethod
    def _match_call(call):
        """回傳 (種類, 容器名稱, 其餘參數)"""
        if not isinstance(call, ast.Call):
            return None
        func = call.func
        first = _var_of(call.args[0]) if call.args else None
        if isinstance(func, ast.Attribute) and isinstance(func.value, ast.Name) and func.value.id == "heapq":
            if func.attr in _HEAPQ_OPS and first:
                return func.attr, first, call.args[1:]
            return None
        if isinstance(func, ast.Attribute) and _var_of(func.value) and func.attr in _METHOD_OPS:
            return _METHOD_OPS[func.attr], _var_of(func.value), call.args
        if isinstance(func, ast.Name) and func.id in _HEAPQ_OPS and first:
            return func.id, first, call.args[1:]
        return None

    def _op_of(self, stmt):
        src = self.analyzer._src(stmt)
        # d[k] = v、del d[k]（只算 dict；list 的 nums[i] = x 交給一般賦值）
        if isinstance(stmt, ast.Assign) and len(stmt.targets) == 1:
            t = stmt.targets[0]
            if isinstance(t, ast.Subscript) and _var_of(t.value):
                return {"kind": "setitem", "target": _var_of(t.value), "key": t.slice, "value": stmt.value, "src": src}
        if isinstance(stmt, ast.Delete) and len(stmt.targets) == 1:
            t = stmt.targets[0]
            if isinstance(t, ast.Subscript) and _var_of(t.value):
                return {"kind": "delitem", "target": _var_of(t.value), "key": t.slice, "src": src}
        value = getattr(stmt, "value", None)
        if not isinstance(stmt, (ast.Expr, ast.Assign, ast.AnnAssign, ast.Return)) or value is None:
            return None
        call = next((n for n in ast.walk(value) if self._match_call(n)), None)
        if call is None:
            return None
        kind, target, args = self._match_call(call)
        spec = {"kind": kind, "target": target, "args": args, "src": src}
        # x = stack.pop()：結果直接寫入變數時，卡片上註明寫到哪裡
        if isinstance(stmt, ast.Assign) and stmt.value is call and len(stmt.targets) == 1:
            spec["assignTo"] = self.analyzer._src(stmt.targets[0])
        return spec

    def evaluate(self, frame, ctx):
        spec = self.by_line.get(frame.f_lineno)
        if spec is None:
            return None
        try:
            return self._evaluate(spec, frame, ctx)
        except Exception:
            return None

    def _moved(self, node, frame):
        """node 是不帶參數的 x.pop() / x.popleft()（x 為 list / deque 且非空）時：(會取出的值, 來源說明)"""
        match = self._match_call(node)
        if not match or match[0] not in ("pop", "popleft") or match[2]:
            return None
        source = _lookup_var(match[1], frame)
        if not isinstance(source, (list, collections.deque)) or not source:
            return None
        if match[0] == "popleft" and not isinstance(source, collections.deque):
            return None
        front = match[0] == "popleft"
        return (source[0] if front else source[-1]), {"target": match[1], "end": "front" if front else "back"}

    def _arg(self, node, frame):
        try:
            return self.analyzer._eval(node, frame), True
        except _Unknown:
            return None, False

    def _evaluate(self, spec, frame, ctx):
        a = self.analyzer
        container = _lookup_var(spec["target"], frame)
        kind = spec["kind"]
        if isinstance(container, collections.deque):
            ckind = "deque"
        elif isinstance(container, list):
            ckind = "heap" if kind in _HEAPQ_OPS else "list"
        elif isinstance(container, (set, frozenset)):
            ckind = "set"
        elif isinstance(container, dict):
            ckind = "dict"
        else:
            return None
        if kind in ("setitem", "delitem") and ckind != "dict":
            return None

        op = {"kind": kind, "target": spec["target"], "container": ckind, "src": spec["src"]}
        if spec.get("assignTo"):
            op["assignTo"] = spec["assignTo"]

        def put(value):
            op["value"] = _ser(value, ctx)
            op["display"] = a._result_short(value)

        args = []
        for node in spec.get("args", []):
            value, known = self._arg(node, frame)
            if not known and kind in ("push", "pushleft") and len(spec["args"]) == 1:
                # outbox.append(inbox.pop())：把一個容器取出的元素放進另一個；取出的值可以唯讀算出
                moved = self._moved(node, frame)
                if moved is not None:
                    value, op["from"] = moved
                    known = True
            if not known:
                return None  # 參數含有無法安全求值的部分，就不預先說明
            args.append(value)
        n = len(container)

        if kind == "push":
            put(args[0]); op["index"] = n
        elif kind == "pushleft":
            put(args[0]); op["index"] = 0
        elif kind == "insert":
            i = args[0]
            op["index"] = max(0, min(n, i if i >= 0 else n + i))
            put(args[1])
        elif kind == "extend":
            try:
                put(list(args[0]))
            except TypeError:
                return None
            op["index"] = n
        elif kind == "pop":
            if ckind == "dict":
                key = args[0]
                op["key"] = a._result_short(key)
                if key in container:
                    put(container[key])
                elif len(args) > 1:
                    put(args[1]); op["missing"] = True
                else:
                    op["missing"] = True
            elif ckind == "set":
                op["unordered"] = True
            elif n == 0:
                op["empty"] = True
            else:
                i = args[0] if args else -1
                i = i if i >= 0 else n + i
                if 0 <= i < n:
                    put(container[i]); op["index"] = i
        elif kind == "popleft":
            if n == 0:
                op["empty"] = True
            else:
                put(container[0]); op["index"] = 0
        elif kind == "remove":
            put(args[0])
            if args[0] in container and ckind in ("list", "deque"):
                op["index"] = list(container).index(args[0])
            elif args[0] not in container:
                op["missing"] = True
        elif kind in ("add", "discard"):
            put(args[0])
            op["existed"] = args[0] in container
        elif kind == "clear":
            pass
        elif kind == "heappush":
            put(args[0]); op["index"] = n
        elif kind == "heappop":
            if n == 0:
                op["empty"] = True
            else:
                put(container[0]); op["index"] = 0
        elif kind in ("heappushpop", "heapreplace"):
            put(args[0])
            if n:
                op["popped"] = a._result_short(container[0])
                op["index"] = 0
        elif kind == "setitem":
            key, ok1 = self._arg(spec["key"], frame)
            value, ok2 = self._arg(spec["value"], frame)
            if not (ok1 and ok2):
                return None
            op["key"] = a._result_short(key)
            op["existed"] = key in container
            put(value)
        elif kind == "delitem":
            key, ok = self._arg(spec["key"], frame)
            if not ok:
                return None
            op["key"] = a._result_short(key)
            if key in container:
                put(container[key])
            else:
                op["missing"] = True
        op["size"] = n
        return op


# ─────────────── 迴圈圈數與呼叫堆疊 ───────────────

_SIZED_CALLS = {"range", "enumerate", "reversed", "zip"}
_DICT_VIEWS = {"items", "keys", "values"}


# ─────────────── 內建函式（sum / min / max / sorted…） ───────────────

_BUILTIN_FUNCS = {"sum", "min", "max", "sorted", "any", "all", "reversed", "enumerate", "zip", "set", "Counter"}
_MAX_BUILTIN_ITEMS = 16
_ITERABLE_TYPES = (list, tuple, str, set, frozenset, dict, range, collections.deque,
                   type({}.keys()), type({}.values()), type({}.items()))


def _bdisp(value):
    """內建函式卡片上單一元素的顯示"""
    if isinstance(value, (list, tuple, set)):
        r = repr(value)
        if len(r) <= 24:
            return r
    return _short_value(value, None)


def _uses_iterator(node, frame, skip=()):
    """運算式用到的變數中有迭代器 / 產生器（預先求值會把它用掉）"""
    for n in ast.walk(node):
        if isinstance(n, ast.Name) and n.id not in skip:
            value = frame.f_locals[n.id] if n.id in frame.f_locals else frame.f_globals.get(n.id)
            if isinstance(value, collections.abc.Iterator):
                return True
    return False


class _BuiltinAnalyzer:
    """執行到含有 sum / min / max / sorted / any / all / enumerate / zip… 的那一行時（尚未執行），
    以唯讀方式算出內建函式如何處理每個元素：累加過程、勝出的元素、排序前後的位置、短路停在哪裡…"""

    def __init__(self, analyzer):
        self.an = analyzer
        self.by_line = {}
        self.compiled = {}
        if analyzer.tree is None:
            return
        for node in ast.walk(analyzer.tree):
            if isinstance(node, ast.stmt) and node.lineno not in self.by_line:
                calls = self._calls_of(node)
                if calls:
                    self.by_line[node.lineno] = calls

    @staticmethod
    def _header_exprs(stmt):
        """這個敘述「在這一行」會求值的運算式（複合敘述只看 header）"""
        if isinstance(stmt, (ast.For, ast.AsyncFor)):
            return [stmt.iter]
        if isinstance(stmt, (ast.While, ast.If)):
            return [stmt.test]
        if isinstance(stmt, (ast.Assign, ast.AugAssign, ast.AnnAssign, ast.Return, ast.Expr)):
            return [stmt.value] if stmt.value is not None else []
        return []

    def _calls_of(self, stmt):
        found = []

        def visit(node):
            if isinstance(node, ast.Lambda):
                return
            # and / or 後面的部分、a if c else b 的兩個分支不一定會執行：不預先說明
            if isinstance(node, ast.BoolOp):
                visit(node.values[0])
                return
            if isinstance(node, ast.IfExp):
                visit(node.test)
                return
            for child in ast.iter_child_nodes(node):
                visit(child)
            if isinstance(node, ast.Call) and self._kind(node):
                found.append(node)  # 後序：內層的呼叫先求值，排在前面

        for expr in self._header_exprs(stmt):
            visit(expr)
        return found[:2]

    @staticmethod
    def _kind(call):
        func = call.func
        if isinstance(func, ast.Name) and func.id in _BUILTIN_FUNCS and call.args:
            # min(a, b) / max(a, b) 由計算卡片說明；這裡只處理對整個序列取最小 / 最大
            if func.id in ("min", "max") and len(call.args) != 1:
                return None
            return func.id
        if isinstance(func, ast.Attribute):
            if func.attr == "Counter" and isinstance(func.value, ast.Name) and func.value.id == "collections" and call.args:
                return "Counter"
            if func.attr == "sort" and isinstance(func.value, ast.Name) and not call.args:
                return "sort"
            if func.attr == "join" and len(call.args) == 1 and isinstance(func.value, (ast.Constant, ast.Name)):
                return "join"
        return None

    def evaluate(self, frame, first_pass):
        specs = self.by_line.get(frame.f_lineno)
        if not specs:
            return None
        stmt_is_loop = first_pass is not None
        if stmt_is_loop and not first_pass:
            return None  # for 迴圈的 header 每一圈都會經過，只在第一次說明
        out = []
        for call in specs:
            try:
                info = self._evaluate(call, frame)
            except Exception:  # noqa: BLE001 — 無法安全求值就不顯示
                info = None
            if info:
                out.append(info)
        return out or None

    def _resolve(self, name, frame):
        if name in frame.f_locals:
            return frame.f_locals[name]
        if name in frame.f_globals:
            return frame.f_globals[name]
        return getattr(builtins, name, None)

    def _iterable(self, node, frame):
        if isinstance(node, (ast.GeneratorExp, ast.ListComp, ast.SetComp)):
            return [v for _, v in self._comp_values(node, frame)]
        value = self.an._eval(node, frame)
        if not isinstance(value, _ITERABLE_TYPES):
            raise _Unknown()  # 迭代器 / 產生器：事先走訪會把它用掉
        return list(value)

    def _fresh_iterable(self, node, frame):
        """序列；或是 zip / enumerate / reversed 包住序列時，由這裡新建的迭代器（走訪它不會動到使用者的資料）"""
        name = node.func.id if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) else None
        if name in ("zip", "enumerate", "reversed") and not node.keywords and self._resolve(name, frame) is getattr(builtins, name):
            args = [self.an._eval(a, frame) for a in node.args]
            # enumerate(seq, start) 的第二個參數是起始編號，其餘參數都必須是序列
            seqs = args[:1] if name == "enumerate" and len(args) == 2 and isinstance(args[1], int) else args
            if not seqs or not all(isinstance(a, _ITERABLE_TYPES) for a in seqs):
                raise _Unknown()
            return list(getattr(builtins, name)(*args))
        value = self.an._eval(node, frame)
        if not isinstance(value, _ITERABLE_TYPES):
            raise _Unknown()  # 迭代器 / 產生器：事先走訪會把它用掉
        return value

    @staticmethod
    def _bind(target, value, scope):
        if isinstance(target, ast.Name):
            scope[target.id] = value
        elif isinstance(target, (ast.Tuple, ast.List)):
            values = list(value)
            if len(values) != len(target.elts):
                raise _Unknown()
            for t, v in zip(target.elts, values):
                _BuiltinAnalyzer._bind(t, v, scope)
        else:
            raise _Unknown()

    def _comp_values(self, node, frame):
        """(x for x in nums if …)：只有一層 for、各部分都沒有副作用時，自己逐一求值（產生器，可以中途停下）"""
        if len(node.generators) != 1:
            raise _Unknown()
        gen = node.generators[0]
        if gen.is_async or not _is_pure(node.elt) or not all(_is_pure(c) for c in gen.ifs):
            raise _Unknown()
        bound = {n.id for n in ast.walk(gen.target) if isinstance(n, ast.Name)}
        if any(_uses_iterator(part, frame, bound) for part in (node.elt, *gen.ifs)):
            raise _Unknown()
        source = self._fresh_iterable(gen.iter, frame)
        parts = [node.elt, *gen.ifs]
        for part in parts:
            if id(part) not in self.compiled:
                self.compiled[id(part)] = compile(ast.Expression(part), COND_FILE, "eval")
        base = dict(frame.f_locals)

        def run():
            for item in list(source):
                scope = dict(base)
                self._bind(gen.target, item, scope)
                if all(eval(self.compiled[id(c)], frame.f_globals, scope) for c in gen.ifs):
                    yield item, eval(self.compiled[id(node.elt)], frame.f_globals, scope)

        return run()

    def _key_func(self, call, frame):
        for kw in call.keywords:
            if kw.arg != "key":
                continue
            node = kw.value
            if isinstance(node, ast.Lambda):
                params = {a.arg for a in node.args.args}
                if not _is_pure(node.body) or _uses_iterator(node.body, frame, params):
                    raise _Unknown()
                k = id(node)
                if k not in self.compiled:
                    self.compiled[k] = compile(ast.Expression(node), COND_FILE, "eval")
                return eval(self.compiled[k], frame.f_globals, dict(frame.f_locals))
            if isinstance(node, (ast.Name, ast.Attribute)) and _is_pure(node):
                func = self.an._eval(node, frame)
                if func in (len, abs, str, int, float, ord) or getattr(func, "__qualname__", "") in ("str.lower", "str.upper"):
                    return func
            raise _Unknown()
        return None

    def _kwarg(self, call, name, frame, default=None):
        for kw in call.keywords:
            if kw.arg == name:
                return self.an._eval(kw.value, frame)
        return default

    def _evaluate(self, call, frame):
        kind = self._kind(call)
        src = self.an._src(call)
        if kind in ("sort", "join"):
            target = call.func.value
        else:
            name = call.func.attr if isinstance(call.func, ast.Attribute) else call.func.id
            expected = collections.Counter if kind == "Counter" else getattr(builtins, name)
            if not isinstance(call.func, ast.Attribute) and self._resolve(name, frame) is not expected:
                return None  # 被使用者自己的同名函式 / 變數蓋掉
        info = {"func": kind, "src": src}

        def items_info(values):
            info["items"] = [_bdisp(v) for v in values[:_MAX_BUILTIN_ITEMS]]
            if len(values) > _MAX_BUILTIN_ITEMS:
                info["more"] = len(values) - _MAX_BUILTIN_ITEMS

        if kind == "sum":
            values = self._iterable(call.args[0], frame)
            total = self.an._eval(call.args[1], frame) if len(call.args) > 1 else self._kwarg(call, "start", frame, 0)
            running = []
            for v in values:
                total = total + v
                running.append(_bdisp(total))
            items_info(values)
            info["running"] = running[:_MAX_BUILTIN_ITEMS]
            info["result"] = _bdisp(total)
            return info

        if kind in ("min", "max"):
            values = self._iterable(call.args[0], frame)
            if not values:
                return None
            key = self._key_func(call, frame)
            keys = [key(v) for v in values] if key else values
            pick = 0
            for i, k in enumerate(keys):
                if (k < keys[pick]) if kind == "min" else (k > keys[pick]):
                    pick = i
            items_info(values)
            if key:
                info["keys"] = [_bdisp(k) for k in keys[:_MAX_BUILTIN_ITEMS]]
            info["pick"] = pick
            info["result"] = _bdisp(values[pick])
            return info

        if kind in ("sorted", "sort", "reversed"):
            if kind == "sort":
                values = self.an._eval(target, frame)
                if not isinstance(values, list):
                    return None
                values = list(values)
                info["target"] = target.id
            else:
                values = self._iterable(call.args[0], frame)
            reverse = bool(self._kwarg(call, "reverse", frame, False)) if kind != "reversed" else False
            if kind == "reversed":
                order = list(range(len(values)))[::-1]
            else:
                key = self._key_func(call, frame)
                keys = [key(v) for v in values] if key else values
                order = sorted(range(len(values)), key=lambda i: keys[i], reverse=reverse)
                if key:
                    info["keys"] = [_bdisp(k) for k in keys[:_MAX_BUILTIN_ITEMS]]
            items_info(values)
            if reverse:
                info["reverse"] = True
            if len(values) <= _MAX_BUILTIN_ITEMS:
                info["order"] = order
            info["result"] = _bdisp([values[i] for i in order])
            return info

        if kind in ("any", "all"):
            arg = call.args[0]
            if isinstance(arg, (ast.GeneratorExp, ast.ListComp, ast.SetComp)):
                # any(x > 4 for x in nums)：格子顯示被走訪的 x，✓ / ✗ 是 x > 4 的結果
                pairs = self._comp_values(arg, frame)
                info["elt"] = self.an._src(arg.elt)
                info["var"] = self.an._src(arg.generators[0].target)
            else:
                pairs = ((v, v) for v in self._iterable(arg, frame))
            values = []
            truth = []
            stop = None
            for i, (item, v) in enumerate(pairs):
                values.append(item)
                truth.append(bool(v))
                if bool(v) == (kind == "any"):
                    stop = i
                    break  # 短路：後面的元素不會被看
            items_info(values)
            info["truth"] = truth[:_MAX_BUILTIN_ITEMS]
            if stop is not None:
                info["stop"] = stop
            info["result"] = repr(stop is not None if kind == "any" else stop is None)
            return info

        if kind == "enumerate":
            values = self._iterable(call.args[0], frame)
            start = self.an._eval(call.args[1], frame) if len(call.args) > 1 else self._kwarg(call, "start", frame, 0)
            items_info(values)
            info["start"] = start
            return info

        if kind == "zip":
            columns = [self._iterable(a, frame) for a in call.args]
            n = min(len(c) for c in columns)
            info["names"] = [self.an._src(a) for a in call.args]
            info["columns"] = [[_bdisp(v) for v in c[:_MAX_BUILTIN_ITEMS]] for c in columns]
            info["count"] = n
            return info

        if kind == "set":
            values = self._iterable(call.args[0], frame)
            seen = set()
            kept = []
            for v in values:
                kept.append(v not in seen)
                seen.add(v)
            items_info(values)
            info["kept"] = kept[:_MAX_BUILTIN_ITEMS]
            info["result"] = _bdisp(set(values))
            return info

        if kind == "Counter":
            values = self._iterable(call.args[0], frame)
            counts = collections.Counter(values)
            items_info(values)
            info["counts"] = [[_bdisp(k), c] for k, c in list(counts.items())[:_MAX_BUILTIN_ITEMS]]
            return info

        if kind == "join":
            sep = self.an._eval(target, frame)
            values = self._iterable(call.args[0], frame)
            if not isinstance(sep, str) or not all(isinstance(v, str) for v in values):
                return None
            items_info(values)
            info["sep"] = repr(sep)
            info["result"] = _bdisp(sep.join(values))
            return info
        return None


def _short_value(value, ctx):
    """呼叫堆疊上參數的簡短顯示"""
    if value is None or isinstance(value, (bool, int, float)):
        return repr(value)
    if isinstance(value, str):
        r = repr(value)
        return r if len(r) <= 14 else r[:13] + "…'"
    if _is_object(value):
        val = getattr(value, "val", None)
        return f"({val!r})" if isinstance(val, (int, float, str)) else type(value).__name__
    if isinstance(value, (list, tuple, set, dict, collections.deque)):
        r = repr(value)
        return r if len(r) <= 16 else f"{type(value).__name__}[{len(value)}]"
    return type(value).__name__


class _LoopTracker:
    """依每個 frame 記錄目前在每個迴圈的第幾圈，以及整段呼叫堆疊。"""

    def __init__(self, analyzer):
        self.analyzer = analyzer
        self.loops = []  # (header 行, 結束行, 種類, header 原文, 迭代運算式, 目標)
        self.frames = {}  # id(frame) → {"last": 上一行, 迴圈 header 行: {"count", "total"}}
        tree = analyzer.tree
        if tree is None:
            return
        for node in ast.walk(tree):
            if isinstance(node, (ast.For, ast.While)):
                header = analyzer.code.splitlines()[node.lineno - 1].strip().rstrip(":")
                self.loops.append((
                    node.lineno, node.end_lineno, "for" if isinstance(node, ast.For) else "while", header,
                    node.iter if isinstance(node, ast.For) else None,
                    node.target if isinstance(node, ast.For) else None,
                ))
        self.loops.sort()

    def _total(self, iter_node, frame):
        """可以安全得知長度的迭代對象：range / enumerate / reversed / zip、序列變數、dict.items()…"""
        if iter_node is None:
            return None
        try:
            if isinstance(iter_node, ast.Call) and isinstance(iter_node.func, ast.Name) and iter_node.func.id in _SIZED_CALLS:
                args = [self.analyzer._eval(a, frame) for a in iter_node.args]
                name = iter_node.func.id
                if name == "range":
                    return len(range(*args))
                lengths = [len(a) for a in args]
                return min(lengths) if name == "zip" else lengths[0]
            if (isinstance(iter_node, ast.Call) and isinstance(iter_node.func, ast.Attribute)
                    and iter_node.func.attr in _DICT_VIEWS and not iter_node.args):
                return len(self.analyzer._eval(iter_node.func.value, frame))
            if isinstance(iter_node, _LEAF_NODES):
                value = self.analyzer._eval(iter_node, frame)
                if isinstance(value, (list, tuple, str, dict, set, collections.deque, range)):
                    return len(value)
        except (_Unknown, TypeError):
            return None
        return None

    @staticmethod
    def _seq_name(iter_node):
        """for x in nums / for i, x in enumerate(nums) 中被走訪的序列名稱"""
        if _var_of(iter_node):
            return _var_of(iter_node)
        if (isinstance(iter_node, ast.Call) and isinstance(iter_node.func, ast.Name)
                and iter_node.func.id == "enumerate" and iter_node.args and _var_of(iter_node.args[0])):
            return _var_of(iter_node.args[0])
        return None

    def comp_loop(self, frame, comp):
        """推導式的圈數：沿用迴圈列的格式"""
        node = self.analyzer.comp_by_line.get(frame.f_lineno)
        if node is None or comp is None or comp.get("count", 0) == 0:
            return None
        gen = node.generators[0]
        info = {"line": frame.f_lineno, "kind": "comp", "src": comp["src"], "iteration": comp["count"]}
        total = self._total(gen.iter, frame)
        if total is not None:
            info["total"] = total
        if isinstance(gen.iter, ast.Name):
            info["seq"] = gen.iter.id
            info["item"] = gen.target.id
        return info

    def on_line(self, frame):
        state = self.frames.setdefault(id(frame), {"last": None})
        line = frame.f_lineno
        last = state["last"]
        active = []
        for header, end, kind, src, iter_node, target in self.loops:
            if not (header <= line <= end):
                continue
            loop = state.get(header)
            if line == header:
                # 從迴圈外面走到 header：新的一輪迴圈開始
                if loop is None or last is None or not (header <= last <= end):
                    loop = {"count": 1, "total": self._total(iter_node, frame) if kind == "for" else None}
                    state[header] = loop
                else:
                    loop["count"] += 1
            if loop is None:
                continue
            info = {"line": header, "kind": kind, "src": src, "iteration": loop["count"]}
            if loop["total"] is not None:
                info["total"] = loop["total"]
                if loop["count"] > loop["total"]:
                    info["done"] = True
            seq = self._seq_name(iter_node)
            if seq and isinstance(target, ast.Name) and isinstance(iter_node, ast.Name):
                # for num in nums：沒有索引變數，用目標變數名稱標出目前走到哪一格
                info["seq"] = seq
                info["item"] = target.id
            active.append(info)
        state["last"] = line
        return active

    def on_return(self, frame):
        self.frames.pop(id(frame), None)

    @staticmethod
    def stack(frame, ctx):
        """由外而內的使用者呼叫：函式名稱、目前停在哪一行、參數值"""
        frames = []
        f = frame
        while f is not None:
            if f.f_code.co_filename == USER_FILE:
                code = f.f_code
                names = code.co_varnames[:code.co_argcount + code.co_kwonlyargcount]
                args = [[n, _short_value(f.f_locals.get(n), ctx)] for n in names if n != "self" and n in f.f_locals]
                frames.append({"func": code.co_name, "line": f.f_lineno, "args": args})
            f = f.f_back
        frames.reverse()
        return frames


class _TryTracker:
    """try / except / else / finally 的流程：

    - 例外發生時：在這個 frame 裡由內往外找包住這一行的 try，依序比對 except，算出會被哪個 except 接住、
      要先經過哪些 finally，或是往外拋給呼叫者
    - 執行到 except 那一行（Python 正在比對這個 except）：記下比對結果
    - 執行到 try:、else 區塊、finally 區塊的第一行：說明為什麼會走到這裡
    """

    _TRY_TYPES = (ast.Try, getattr(ast, "TryStar", ast.Try))

    def __init__(self, analyzer):
        self.code = analyzer.code
        self.tries = []  # (try 節點, 所在函式的第一行)
        self.pending = {}  # id(frame) → {"exc", "try", "caught"}
        if analyzer.tree is not None:
            self._collect(analyzer.tree, None)
        self.handler_at = {}  # except 行 → (try, handler)
        self.else_at = {}
        self.finally_at = {}
        self.try_at = {}
        for node, _ in self.tries:
            self.try_at[node.lineno] = node
            for h in node.handlers:
                self.handler_at[h.lineno] = (node, h)
            if node.orelse:
                self.else_at[node.orelse[0].lineno] = node
            if node.finalbody:
                self.finally_at[node.finalbody[0].lineno] = node

    def _collect(self, node, func_line):
        for child in ast.iter_child_nodes(node):
            if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)):
                first = min([child.lineno] + [d.lineno for d in child.decorator_list])
                self._collect(child, first)
                continue
            if isinstance(child, self._TRY_TYPES):
                self.tries.append((child, func_line))
            self._collect(child, func_line)

    def _src(self, node):
        return (ast.get_source_segment(self.code, node) or "").strip()

    def _header(self, h):
        line = self.code.splitlines()[h.lineno - 1].strip()
        return line[:-1].rstrip() if line.endswith(":") else line

    @staticmethod
    def _in_body(node, line):
        return node.body[0].lineno <= line <= node.body[-1].end_lineno

    def _enclosing(self, frame):
        """包住目前這一行（在 try 區塊內）的 try，由內往外"""
        line = frame.f_lineno
        first = frame.f_code.co_firstlineno
        found = [n for n, f in self.tries if f == first and self._in_body(n, line)]
        return sorted(found, key=lambda n: -n.lineno)

    @staticmethod
    def _matches(handler, exc, frame):
        """True / False；無法安全判斷時回傳 None"""
        if handler.type is None:
            return True
        if not all(isinstance(n, (ast.Name, ast.Attribute, ast.Tuple, ast.Load)) for n in ast.walk(handler.type)):
            return None
        try:
            kinds = eval(compile(ast.Expression(handler.type), "<except>", "eval"), frame.f_globals, frame.f_locals)
            return isinstance(exc, kinds)
        except Exception:  # noqa: BLE001
            return None

    def on_exception(self, frame, exc):
        route = []
        nodes = []
        caught = None
        catching_try = None
        for node in self._enclosing(frame):
            nodes.append(node)
            checks = []
            for h in node.handlers:
                m = self._matches(h, exc, frame)
                checks.append({"line": h.lineno, "src": self._header(h), "match": m})
                if m:
                    caught = h.lineno
                    break
            route.append({
                "line": node.lineno,
                "handlers": checks,
                "finally": node.finalbody[0].lineno if node.finalbody and caught is None else None,
            })
            if caught is not None:
                catching_try = node
                break
        info = {"type": type(exc).__name__, "message": str(exc), "route": route}
        if caught is not None:
            info["outcome"] = {"kind": "caught", "line": caught}
        else:
            outer = frame.f_back
            while outer is not None and outer.f_code.co_filename != USER_FILE:
                outer = outer.f_back
            if outer is not None:
                info["outcome"] = {"kind": "propagate", "func": outer.f_code.co_name, "line": outer.f_lineno}
            else:
                info["outcome"] = {"kind": "uncaught"}
        self.pending[id(frame)] = {
            "exc": exc,
            "route": nodes,  # 例外經過的 try（由內往外），最後一個可能是接住它的那個
            "catcher": catching_try,
            "caught": None,
        }
        return info

    def still_raising(self, frame):
        """例外還沒被接住、正在執行它經過的 finally：這段結束後例外會繼續往外拋"""
        state = self.pending.get(id(frame))
        if state is None or state["caught"] is not None:
            return False
        line = frame.f_lineno
        return any(n.finalbody and n.finalbody[0].lineno <= line <= n.finalbody[-1].end_lineno for n in state["route"])

    def on_line(self, frame):
        line = frame.f_lineno
        state = self.pending.get(id(frame))
        # 已經離開發生例外的 try（或重新進入同一個 try）：之前的例外不再相關
        if state is not None:
            t = state["route"][-1] if state["route"] else None
            if t is None or line == t.lineno or not (t.lineno <= line <= t.end_lineno):
                del self.pending[id(frame)]
                state = None
        if line in self.try_at:
            node = self.try_at[line]
            return {
                "kind": "try",
                "handlers": [self._header(h) for h in node.handlers],
                "finally": node.finalbody[0].lineno if node.finalbody else None,
            }
        if line in self.handler_at and state is not None:
            node, h = self.handler_at[line]
            exc = state["exc"]
            m = self._matches(h, exc, frame)
            info = {"kind": "except", "src": self._header(h), "type": type(exc).__name__, "message": str(exc), "match": m}
            if m and h.name:
                info["as"] = h.name
            if m:
                state["caught"] = line
            return info
        if line in self.else_at:
            return {"kind": "else"}
        if line in self.finally_at:
            node = self.finally_at[line]
            info = {"kind": "finally"}
            if state is not None and node in state["route"]:
                exc = state["exc"]
                info["exc"] = f"{type(exc).__name__}: {exc}"
                # 不是接住它的那個 try，或還沒進到 except：finally 結束後例外繼續往外拋
                info["reraise"] = node is not state["catcher"] or state["caught"] is None
            return info
        return None

    def on_return(self, frame):
        self.pending.pop(id(frame), None)


def _visible_locals(frame):
    for name, value in frame.f_locals.items():
        # ".0" 之類是 comprehension / generator 的內部迭代器變數
        if name.startswith("__") or name.startswith("."):
            continue
        if name == "self":
            # self 本身不顯示；它的屬性（設計類題目的 self.stack、self.cache…）當成變數 self.xxx 顯示
            attrs = getattr(value, "__dict__", None)
            if isinstance(attrs, dict):
                for attr, v in list(attrs.items()):
                    if not attr.startswith("__") and not isinstance(v, _SKIP_TYPES):
                        yield f"self.{attr}", v
            continue
        if isinstance(value, _SKIP_TYPES):
            continue
        yield name, value


def _snapshot(frame, ctx, depth):
    """回傳 (目前 frame 的變數, 外層 frame 指向節點的變數)。"""
    out = {name: _ser(value, ctx) for name, value in _visible_locals(frame)}
    # 外層 frame 的區域變數：收集可達的節點（遞迴走訪子樹時整棵樹仍畫得出來），
    # 並記下哪些節點正被外層呼叫使用，讓前端標出遞迴路徑
    stack_refs = []
    outer = frame.f_back
    while outer is not None:
        if outer.f_code.co_filename == USER_FILE:
            depth -= 1
            for name, value in _visible_locals(outer):
                v = _ser(value, ctx)
                if v["type"] == "ref":
                    stack_refs.append({"depth": depth, "name": name, "id": v["id"]})
        outer = outer.f_back
    return out, stack_refs


def _user_depth(frame):
    depth = 0
    while frame is not None:
        if frame.f_code.co_filename == USER_FILE:
            depth += 1
        frame = frame.f_back
    return depth


def _error_line(exc):
    """從 traceback 找出使用者程式碼中最後一個出錯的行號。"""
    if isinstance(exc, SyntaxError) and exc.filename == USER_FILE:
        return exc.lineno
    line = None
    tb = exc.__traceback__
    while tb is not None:
        if tb.tb_frame.f_code.co_filename == USER_FILE:
            line = tb.tb_lineno
        tb = tb.tb_next
    return line


def _design_call(call_src, ns):
    """LeetCode 設計題的測資：["MinStack","push",…] 與 [[],[-2],…]（兩行、逗號隔開或直接相連）"""
    try:
        tree = ast.parse(call_src.strip(), INPUT_FILE, "exec")
    except SyntaxError:
        return None
    body = tree.body
    pair = None
    if len(body) == 2 and all(isinstance(b, ast.Expr) and isinstance(b.value, ast.List) for b in body):
        pair = (body[0].value, body[1].value)
    elif len(body) == 1 and isinstance(body[0], ast.Expr):
        v = body[0].value
        if isinstance(v, ast.Tuple) and len(v.elts) == 2 and all(isinstance(e, ast.List) for e in v.elts):
            pair = tuple(v.elts)
        elif isinstance(v, ast.Subscript) and isinstance(v.value, ast.List):
            # 兩行貼進單行輸入框時，換行被吃掉變成 [..][..]；第二組方括號裡的 [a], [b] 會被解析成 tuple
            inner = v.slice
            if isinstance(inner, ast.Tuple):
                inner = ast.List(elts=inner.elts, ctx=ast.Load())
            elif isinstance(inner, ast.List) and len(v.value.elts) == 1:
                inner = ast.List(elts=[inner], ctx=ast.Load())  # 只有建構子："[\"Cls\"][[]]"
            if isinstance(inner, ast.List):
                pair = (v.value, inner)
    if pair is None:
        return None
    ops_node, args_node = pair
    if not ops_node.elts or not all(isinstance(e, ast.Constant) and isinstance(e.value, str) for e in ops_node.elts):
        return None
    ops = [e.value for e in ops_node.elts]
    if len(args_node.elts) != len(ops) or not isinstance(ns.get(ops[0]), type):
        return None
    args = eval(compile(ast.fix_missing_locations(ast.Expression(args_node)), INPUT_FILE, "eval"), ns)  # null / true / false 由 prelude 定義
    if not all(isinstance(a, list) for a in args):
        return None
    return ops, args


# ─────────────── 測試呼叫的解讀 ───────────────

class _CallHint(Exception):
    """測試呼叫寫錯：附上結構化的提示，前端用使用者的語言說明並提供修正"""

    def __init__(self, hint, message):
        super().__init__(message)
        self.hint = hint


_LITERAL_NAMES = {"null", "true", "false", "None", "True", "False", "inf"}
_LITERAL_CALLS = {"build_list", "build_tree", "build_graph", "ListNode", "TreeNode", "Node", "float"}
_LIST_PARAMS = {"head", "l1", "l2", "list1", "list2", "headA", "headB"}
_TREE_PARAMS = {"root", "root1", "root2", "subRoot"}


def _literalish(node):
    """測資的值：常數、list / dict / tuple、負號、null / true / false、build_list(...) 這類建立測資的呼叫"""
    for n in ast.walk(node):
        if isinstance(n, ast.Call):
            if not (isinstance(n.func, ast.Name) and n.func.id in _LITERAL_CALLS):
                return False
        elif isinstance(n, ast.Name):
            if n.id not in _LITERAL_NAMES and n.id not in _LITERAL_CALLS:
                return False
        elif not isinstance(n, (ast.Constant, ast.List, ast.Tuple, ast.Dict, ast.Set, ast.UnaryOp, ast.BinOp,
                                ast.unaryop, ast.operator, ast.Load, ast.keyword, ast.Expression)):
            return False
    return True


class _Entries:
    """程式碼中可以當成測試入口的函式：class Solution 的方法，否則是最外層的函式"""

    def __init__(self, tree, ns):
        self.solution = ns.get("Solution") if isinstance(ns.get("Solution"), type) else None
        self.annotations = {}  # 函式名稱 → {參數: 型別標註原文}
        self.top = []
        self.methods = []
        for node in tree.body if tree is not None else []:
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and not node.name.startswith("_"):
                self.top.append(node.name)
                self._note(node)
            elif isinstance(node, ast.ClassDef) and node.name == "Solution":
                for item in node.body:
                    if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)) and not item.name.startswith("_"):
                        self.methods.append(item.name)
                        self._note(item)
        self.names = self.methods if self.solution is not None and self.methods else self.top

    def _note(self, node):
        self.annotations[node.name] = {
            a.arg: ast.unparse(a.annotation) if a.annotation is not None else "" for a in node.args.args
        }

    def get(self, name, ns):
        """(可呼叫的物件, 顯示用前綴)；找不到時 None"""
        if self.solution is not None and name in self.methods:
            return getattr(self.solution(), name), "Solution()."
        value = ns.get(name)
        if callable(value):
            return value, ""
        return None

    def params(self, name, fn):
        sig = inspect.signature(fn)
        notes = self.annotations.get(name, {})
        return [(p.name, notes.get(p.name, ""), p.default is inspect.Parameter.empty)
                for p in sig.parameters.values() if p.kind in (p.POSITIONAL_OR_KEYWORD, p.KEYWORD_ONLY)]


def _parse_call(text):
    """回傳 (形式, 資料)：("call", ast.Call)、("keywords", [ast.keyword])、("positional", [ast.expr])；無法辨認時 None"""
    try:
        expr = ast.parse(text, INPUT_FILE, "eval").body
    except SyntaxError:
        expr = None
    if expr is not None:
        if isinstance(expr, ast.Call):
            return "call", expr
        if isinstance(expr, ast.Tuple) and all(_literalish(e) for e in expr.elts):
            return "positional", expr.elts
        if isinstance(expr, (ast.List, ast.Constant, ast.Dict)) or (isinstance(expr, ast.UnaryOp) and _literalish(expr)):
            return "positional", [expr]
        return None
    # LeetCode 的範例輸入一行一個（nums = [2,7,11,15] 換行 target = 9），或測資框的一行一個值
    joined = re.sub(r"\s*\n\s*", ", ", text.strip())
    try:
        expr = ast.parse(joined, INPUT_FILE, "eval").body
        if isinstance(expr, ast.Tuple) and all(_literalish(e) for e in expr.elts):
            return "positional", expr.elts
    except SyntaxError:
        pass
    try:
        call = ast.parse(f"_({joined})", INPUT_FILE, "eval").body
    except SyntaxError:
        return None
    if isinstance(call, ast.Call) and call.keywords and not call.args and all(k.arg for k in call.keywords) \
            and all(_literalish(k.value) for k in call.keywords):
        return "keywords", call.keywords
    return None


def _convert(value, annotation, param, extra, ns):
    """依型別標註（或參數名稱）把 list 轉成鏈結串列 / 樹 / 圖；回傳 (值, 轉成什麼)"""
    if not isinstance(value, list):
        return value, None
    if "ListNode" in annotation or (not annotation and param in _LIST_PARAMS):
        pos = extra.get("pos", -1)
        return ns["build_list"](value, pos if isinstance(pos, int) else -1), "ListNode"
    if "TreeNode" in annotation or (not annotation and param in _TREE_PARAMS):
        return ns["build_tree"](value), "TreeNode"
    if re.search(r"\bNode\b", annotation) and all(isinstance(v, list) for v in value):
        return ns["build_graph"](value), "Node"
    return value, None


def _short_arg(value):
    r = repr(value)
    return r if len(r) <= 40 else r[:39] + "…"


def _smart_call(call_src, ns, tree):
    """把測試呼叫解讀成 (函式, args, kwargs, 說明)；看不懂的寫法回傳 None，交給一般的 eval / exec"""
    text = call_src.strip()
    entries = _Entries(tree, ns)
    if not text:
        raise _CallHint({"kind": "empty", "funcs": entries.names[:3]}, "The test call is empty")
    parsed = _parse_call(text)
    if parsed is None:
        return None
    form, data = parsed

    if form == "call":
        func = data.func
        name = None
        if isinstance(func, ast.Name):
            name = func.id
        elif isinstance(func, ast.Attribute) and isinstance(func.value, ast.Call) and isinstance(func.value.func, ast.Name) \
                and func.value.func.id == "Solution" and not func.value.args:
            name = func.attr
            if entries.solution is None:
                # 程式是一般函式，測資卻寫成 Solution().xxx(...)
                if name in entries.top:
                    fix = text.replace(f"Solution().{name}", name, 1)
                    raise _CallHint({"kind": "noSolution", "got": name, "fix": fix}, "There is no class Solution")
                return None
        else:
            return None
        found = entries.get(name, ns)
        if found is None:
            if hasattr(builtins, name) or name in ns:
                return None  # print(...)、len(...) 之類：照一般方式執行
            pool = entries.names + [n for n in entries.top if n not in entries.names] + \
                [n for n, v in ns.items() if isinstance(v, type) and not n.startswith("_") and n not in ("ListNode", "TreeNode", "Node", "TrieNode")]
            lower = {n.lower(): n for n in pool}
            suggest = lower.get(name.lower()) or next(iter(difflib.get_close_matches(name, pool, n=1, cutoff=0.6)), None)
            hint = {"kind": "name", "got": name, "funcs": entries.names[:5]}
            if suggest:
                hint["suggest"] = suggest
                hint["fix"] = re.sub(rf"(?:Solution\(\)\.)?\b{re.escape(name)}\b", suggest, text, count=1)
            raise _CallHint(hint, f"name '{name}' is not defined")
        fn, prefix = found
        if not all(_literalish(a) for a in data.args) or not all(k.arg and _literalish(k.value) for k in data.keywords):
            if prefix:  # reverseList(...) 其實是 Solution 的方法：改寫後照一般方式執行
                return fn, None, None, {"display": prefix + text, "inferred": True, "conversions": []}
            return None
        args = [eval(compile(ast.Expression(a), INPUT_FILE, "eval"), ns) for a in data.args]
        kwargs = {k.arg: eval(compile(ast.Expression(k.value), INPUT_FILE, "eval"), ns) for k in data.keywords}
        # reverseList(...) 自動補上 Solution().；自己寫了 Solution().reverseList(...) 就不算自動解讀
        inferred = bool(prefix) and isinstance(func, ast.Name)
    else:
        if not entries.names:
            raise _CallHint({"kind": "noFunction"}, "No function is defined")
        values = [eval(compile(ast.Expression(e), INPUT_FILE, "eval"), ns) for e in (data if form == "positional" else [k.value for k in data])]
        keys = [k.arg for k in data] if form == "keywords" else []
        best = None
        for name in entries.names:
            fn, prefix = entries.get(name, ns)
            params = entries.params(name, fn)
            names = [pname for pname, _, _ in params]
            required = [pname for pname, _, req in params if req]
            if form == "keywords":
                ok = set(required) <= set(keys) and set(keys) <= set(names) | {"pos"}
            else:
                ok = len(required) <= len(values) <= len(names)
            if ok:
                best = (name, fn, prefix)
                break
        if best is None:
            name = entries.names[0]
            fn, _ = entries.get(name, ns)
            params = entries.params(name, fn)
            raise _CallHint({
                "kind": "args", "func": name,
                "params": [f"{pname}: {note}" if note else pname for pname, note, _ in params],
                "got": keys or len(values),
            }, f"the input does not match the parameters of {name}()")
        name, fn, prefix = best
        args, kwargs = (values, {}) if form == "positional" else ([], dict(zip(keys, values)))
        inferred = True

    # 依型別把 list 轉成鏈結串列 / 樹 / 圖
    params = entries.params(name, fn)
    names = [pname for pname, _, _ in params]
    extra = {k: v for k, v in kwargs.items() if k not in names}
    if "pos" in extra:  # 141 / 142 的 pos：用來把鏈結串列接成環，不是函式的參數
        kwargs.pop("pos")
    raw_args, raw_kwargs = list(args), dict(kwargs)
    conversions = []
    for i, (pname, note, _) in enumerate(params):
        if i < len(args):
            args[i], to = _convert(args[i], note, pname, extra, ns)
        elif pname in kwargs:
            kwargs[pname], to = _convert(kwargs[pname], note, pname, extra, ns)
        else:
            continue
        if to:
            conversions.append({"param": pname, "to": to})
    try:
        inspect.signature(fn).bind(*args, **kwargs)
    except TypeError as exc:
        raise _CallHint({
            "kind": "args", "func": name,
            "params": [f"{pname}: {note}" if note else pname for pname, note, _ in params],
            "got": list(kwargs) if kwargs and not args else len(args) + len(kwargs),
        }, f"{name}(): {exc}")
    # 顯示轉換前的寫法（head=[1, 2, 3]，而不是 ListNode 物件）；自動解讀時每個值都標上參數名稱
    label_all = inferred or bool(conversions)
    shown = [f"{names[i]}={_short_arg(v)}" if label_all and i < len(names) else _short_arg(v) for i, v in enumerate(raw_args)]
    shown += [f"{k}={_short_arg(v)}" for k, v in raw_kwargs.items()]
    if "pos" in extra and conversions:
        shown.append(f"pos={_short_arg(extra['pos'])}")
    display = f"{prefix}{name}({', '.join(shown)})"
    return fn, args, kwargs, {"display": display, "inferred": inferred, "conversions": conversions}


def _leet(value):
    """LeetCode 的寫法：null / true / false、字串用雙引號"""
    try:
        text = json.dumps(value, ensure_ascii=False)
    except (TypeError, ValueError):
        text = _short_value(value, None)
    return text if len(text) <= 24 else text[:23] + "…"


def algoalive_run(code, call_src, max_steps=None):
    limit = min(int(max_steps or MAX_STEPS), MAX_STEPS_LIMIT)
    steps = []
    stdout = io.StringIO()
    registry = _Registry()
    no_value = object()
    conditions = _CondAnalyzer(code, registry)
    loops = _LoopTracker(conditions)
    operations = _OpAnalyzer(conditions)
    tries = _TryTracker(conditions)
    builtin_calls = _BuiltinAnalyzer(conditions)
    comp_states = {}  # (id(frame), 行號) → 推導式進度
    entered = set()  # 已經出現過 line 事件的 frame；第一次出現代表剛進入這次呼叫

    def record(frame, event, ret=no_value, **extra):
        if len(steps) >= limit:
            raise TimeoutError(f"Execution exceeded {limit} steps (possible infinite loop)")
        ctx = _Ctx(registry)
        ctx.focus = {x for _, x in _visible_locals(frame) if isinstance(x, int) and not isinstance(x, bool) and 0 <= x < 10 ** 7}
        depth = _user_depth(frame)
        variables, stack_refs = _snapshot(frame, ctx, depth)
        step = {
            "stepIndex": len(steps),
            "lineNumber": frame.f_lineno,
            "event": event,
            "funcName": frame.f_code.co_name,
            "depth": depth,
            "variables": variables,
            "stdout": stdout.getvalue()[:MAX_STDOUT],
        }
        if stack_refs:
            step["stackRefs"] = stack_refs
        design = ns.get("_algoalive_design")
        if design is not None:
            step["design"] = {"index": design["index"], "outputs": [_leet(v) for v in design["outputs"]]}
        if ret is not no_value:
            step["returnValue"] = _ser(ret, ctx)
        stack = _LoopTracker.stack(frame, ctx)
        if len(stack) > 0:
            step["stack"] = stack
        if event == "line":
            if id(frame) not in entered:
                entered.add(id(frame))
                step["entered"] = True
            active = loops.on_line(frame)
            if active:
                step["loops"] = active
            op = operations.evaluate(frame, ctx)
            if op:
                step["op"] = op
            multi = conditions.multi(frame, ctx)
            if multi:
                step["multi"] = multi
            jump = conditions.jump_by_line.get(frame.f_lineno)
            if jump:
                step["jump"] = jump
            try_flow = tries.on_line(frame)
            if try_flow:
                step["tryFlow"] = try_flow
            # 產生器運算式 / lambda 自己的 frame 也在同一行：只在呼叫內建函式的那個 frame 說明
            if frame.f_lineno in builtin_calls.by_line and not frame.f_code.co_name.startswith("<"):
                # for 迴圈 header：只在第一圈說明 enumerate / zip / sorted 怎麼產生要走訪的序列
                header = next((l for l in step.get("loops", []) if l["line"] == frame.f_lineno and l["kind"] == "for"), None)
                calls = builtin_calls.evaluate(frame, None if header is None else header["iteration"] == 1)
                if calls:
                    step["builtins"] = calls
            slices = conditions.slices(frame, ctx)
            if slices:
                step["slices"] = slices
            if frame.f_lineno in conditions.comp_by_line:
                comp = conditions.comp(frame, ctx, comp_states.setdefault((id(frame), frame.f_lineno), {}))
                if comp:
                    step["comp"] = comp
                    comp_loop = loops.comp_loop(frame, comp)
                    if comp_loop:
                        step["loops"] = [*step.get("loops", []), comp_loop]
            cond = conditions.evaluate(frame, ctx)
            if cond:
                step["condition"] = cond
            else:
                calc = conditions.evaluate_calc(frame, ctx)
                if calc:
                    step["calc"] = calc
        heap = ctx.drain()
        if heap:
            step["heap"] = heap
        step.update(extra)
        steps.append(step)

    raising = set()  # 正在因例外而退出的 frame，其 return 事件不應記錄成「回傳 None」

    def tracer(frame, event, arg):
        if frame.f_code.co_filename != USER_FILE:
            return None
        # build_list / build_tree 建立節點時呼叫到使用者自訂的 __init__，不算在演算法步驟內
        caller = frame.f_back
        if event == "call" and caller is not None and caller.f_code.co_filename == PRELUDE_FILE \
                and caller.f_code.co_name.startswith("build_"):
            return None
        # __repr__ / __lt__ 這類特殊方法不算演算法步驟；__init__ 只在被測試呼叫 / run_design 直接建立時追蹤
        # （設計類題目的建構子），演算法中途建立節點（例如 insert 裡的 TrieNode()）則不追蹤
        name = frame.f_code.co_name
        if event == "call" and name.startswith("__") and name.endswith("__"):
            if name != "__init__" or (caller is not None and caller.f_code.co_filename == USER_FILE):
                return None
        # 產生器運算式 (x for x in …) 的內部：逐元素的過程由內建函式卡片說明（sum / any / all…），
        # 不另外產生步驟；否則 all() 提早結束時關閉產生器的 GeneratorExit 也會被當成例外
        if event == "call" and name == "<genexpr>":
            return None
        if event == "line":
            # 例外已被 try/except 接住，恢復正常；正在執行 finally（之後還會往外拋）時則否
            if not tries.still_raising(frame):
                raising.discard(id(frame))
            record(frame, "line")
        elif event == "return":
            loops.on_return(frame)
            tries.on_return(frame)
            for key in [k for k in comp_states if k[0] == id(frame)]:
                del comp_states[key]
            entered.discard(id(frame))
            if id(frame) in raising:
                raising.discard(id(frame))
            else:
                record(frame, "return", ret=arg)
        elif event == "exception":
            raising.add(id(frame))
            exc_type, exc_value, _ = arg
            if exc_value is None:  # 有些 C 函式只給型別
                exc_value = exc_type()
            record(frame, "exception", exception=f"{exc_type.__name__}: {exc_value}", exc=tries.on_exception(frame, exc_value))
        return tracer

    ns = {"__name__": "__main__"}
    result = {"steps": steps}
    old_stdout = sys.stdout
    sys.stdout = stdout
    try:
        exec(compile(PRELUDE, PRELUDE_FILE, "exec"), ns)
        # 1) 定義使用者函式（不追蹤 module 層級）
        exec(compile(code, USER_FILE, "exec"), ns)
        # 2) 編譯測試呼叫：設計題的兩個陣列交給 run_design；單一運算式用 eval，否則用 exec
        design = _design_call(call_src, ns)
        if design is not None:
            ops, args = design
            result["design"] = {"ops": ops, "calls": [
                f"{op}({', '.join(_leet(a) for a in arg)})" for op, arg in zip(ops, args)
            ]}
            sys.settrace(tracer)
            try:
                value = ns["run_design"](ops, args)
            finally:
                sys.settrace(None)
            if steps:
                # 最後補一步：所有操作都做完，回傳值是每個操作的輸出（LeetCode 的輸出格式）
                ctx = _Ctx(registry)
                final = {k: v for k, v in steps[-1].items() if k in ("lineNumber", "funcName", "depth", "variables", "stdout", "heap", "stackRefs")}
                final.update({
                    "stepIndex": len(steps), "event": "return", "returnValue": _ser(value, ctx),
                    "design": {"index": len(ops), "outputs": [_leet(v) for v in value]},
                })
                extra_heap = ctx.drain()
                if extra_heap:
                    final["heap"] = {**final.get("heap", {}), **extra_heap}
                steps.append(final)
        else:
            # 一般的測試呼叫：先解讀（LeetCode 範例格式、Solution 的方法、自動轉成鏈結串列 / 樹…），看不懂才照原樣執行
            try:
                user_tree = ast.parse(code)
            except SyntaxError:
                user_tree = None
            smart = _smart_call(call_src, ns, user_tree)
            if smart is not None and smart[1] is not None:
                fn, args, kwargs, info = smart
                result["call"] = info
                sys.settrace(tracer)
                try:
                    value = fn(*args, **kwargs)
                finally:
                    sys.settrace(None)
            else:
                source = call_src
                if smart is not None:  # Solution 的方法但參數不是單純的值：補上 Solution(). 再照原樣執行
                    result["call"] = smart[3]
                    source = smart[3]["display"]
                try:
                    call_code = compile(source, INPUT_FILE, "eval")
                    is_expr = True
                except SyntaxError:
                    call_code = compile(source, INPUT_FILE, "exec")
                    is_expr = False
                sys.settrace(tracer)
                try:
                    value = eval(call_code, ns) if is_expr else exec(call_code, ns)
                finally:
                    sys.settrace(None)
        ctx = _Ctx(registry)
        result["returnValue"] = _ser(value, ctx)
        heap = ctx.drain()
        if heap:
            result["returnHeap"] = heap
    except BaseException as exc:  # noqa: BLE001 — 必須攔下所有錯誤回報給前端
        sys.settrace(None)
        is_timeout = isinstance(exc, TimeoutError) and len(steps) >= limit
        line = _error_line(exc)
        if isinstance(exc, SyntaxError) and exc.filename == INPUT_FILE:
            msg = f"SyntaxError in test call: {exc.msg}"
        else:
            msg = f"{type(exc).__name__}: {exc}"
        result["error"] = {"type": type(exc).__name__, "message": msg, "line": line, "timeout": is_timeout}
        if isinstance(exc, _CallHint):
            result["error"].update({"type": "CallError", "message": str(exc), "line": None, "hint": exc.hint})
        if is_timeout and steps:
            last = dict(steps[-1])
            last.update({"stepIndex": len(steps), "event": "exception", "exception": msg})
            steps.append(last)
    finally:
        sys.stdout = old_stdout

    result["stdout"] = stdout.getvalue()[:MAX_STDOUT]
    return json.dumps(result, ensure_ascii=False)
