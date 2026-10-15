"""AlgoAlive Python Execution Tracer.

使用 sys.settrace 攔截使用者函式每一行的執行狀態，序列化成 JSON 回傳給前端。
只追蹤 filename == USER_FILE 的 frame，因此 typing / collections 等內部呼叫不會被記錄。
"""
import ast
import copy
import io
import json
import math
import operator
import sys
import types
import collections

MAX_STEPS = 500
MAX_ITEMS = 100      # 單一容器最多序列化的元素數
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
    "sorted", "tuple", "list", "set", "isinstance", "round", "any", "all",
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
        self.compiled = {}
        self.tree = None
        try:
            tree = ast.parse(code)
        except SyntaxError:
            return
        self.tree = tree
        for node in ast.walk(tree):
            if not isinstance(node, ast.stmt) or node.lineno in self.by_line or node.lineno in self.calc_by_line:
                continue
            expr = self._condition_of(node)
            if expr is not None:
                is_test = isinstance(node, (ast.If, ast.While, ast.Assert)) or isinstance(getattr(node, "value", None), ast.IfExp)
                self.by_line[node.lineno] = (expr, "test" if is_test else "value")
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
        try:
            return eval(self.compiled[key], frame.f_globals, dict(frame.f_locals))
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
            if isinstance(node, ast.Name):
                return {"var": node.id}
            if isinstance(node, ast.Subscript):
                idx = self._eval(node.slice, frame)
                if isinstance(node.value, ast.Name) and isinstance(idx, int):
                    return {"var": node.value.id, "index": idx}
                inner = node.value
                if isinstance(inner, ast.Subscript) and isinstance(inner.value, ast.Name) and isinstance(idx, int):
                    row = self._eval(inner.slice, frame)
                    if isinstance(row, int):
                        return {"var": inner.value.id, "index": row, "col": idx}
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
    def _subst(node, repl):
        """把 repl 中的子節點換成顯示用的名稱節點，回傳新的 AST（不改動原本的樹）"""
        if id(node) in repl:
            return ast.Name(id=repl[id(node)], ctx=ast.Load())
        new = copy.copy(node)
        for field, value in ast.iter_fields(node):
            if isinstance(value, ast.AST):
                setattr(new, field, _CondAnalyzer._subst(value, repl))
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
                    if len(ints) == 3 and all(0 <= x < _MAX_BITS_VALUE for x in ints):
                        bits.append({"op": _BIT_OPS[type(node.op)], "left": left, "right": right, "result": value})
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
        if isinstance(func, ast.Attribute) and isinstance(func.value, ast.Name):
            if func.value.id == "heapq" and func.attr in _HEAPQ_OPS and call.args and isinstance(call.args[0], ast.Name):
                return func.attr, call.args[0].id, call.args[1:]
            if func.attr in _METHOD_OPS:
                return _METHOD_OPS[func.attr], func.value.id, call.args
        if isinstance(func, ast.Name) and func.id in _HEAPQ_OPS and call.args and isinstance(call.args[0], ast.Name):
            return func.id, call.args[0].id, call.args[1:]
        return None

    def _op_of(self, stmt):
        src = self.analyzer._src(stmt)
        # d[k] = v、del d[k]（只算 dict；list 的 nums[i] = x 交給一般賦值）
        if isinstance(stmt, ast.Assign) and len(stmt.targets) == 1:
            t = stmt.targets[0]
            if isinstance(t, ast.Subscript) and isinstance(t.value, ast.Name):
                return {"kind": "setitem", "target": t.value.id, "key": t.slice, "value": stmt.value, "src": src}
        if isinstance(stmt, ast.Delete) and len(stmt.targets) == 1:
            t = stmt.targets[0]
            if isinstance(t, ast.Subscript) and isinstance(t.value, ast.Name):
                return {"kind": "delitem", "target": t.value.id, "key": t.slice, "src": src}
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

    def _arg(self, node, frame):
        try:
            return self.analyzer._eval(node, frame), True
        except _Unknown:
            return None, False

    def _evaluate(self, spec, frame, ctx):
        a = self.analyzer
        container = frame.f_locals.get(spec["target"])
        if container is None and spec["target"] in frame.f_globals:
            container = frame.f_globals[spec["target"]]
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
        if isinstance(iter_node, ast.Name):
            return iter_node.id
        if (isinstance(iter_node, ast.Call) and isinstance(iter_node.func, ast.Name)
                and iter_node.func.id == "enumerate" and iter_node.args and isinstance(iter_node.args[0], ast.Name)):
            return iter_node.args[0].id
        return None

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


def _visible_locals(frame):
    for name, value in frame.f_locals.items():
        # ".0" 之類是 comprehension / generator 的內部迭代器變數
        if name.startswith("__") or name.startswith(".") or name == "self":
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


def algoalive_run(code, call_src):
    steps = []
    stdout = io.StringIO()
    registry = _Registry()
    no_value = object()
    conditions = _CondAnalyzer(code, registry)
    loops = _LoopTracker(conditions)
    operations = _OpAnalyzer(conditions)
    entered = set()  # 已經出現過 line 事件的 frame；第一次出現代表剛進入這次呼叫

    def record(frame, event, ret=no_value, **extra):
        if len(steps) >= MAX_STEPS:
            raise TimeoutError(f"Execution exceeded {MAX_STEPS} steps (possible infinite loop)")
        ctx = _Ctx(registry)
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
        if event == "call" and frame.f_back is not None and frame.f_back.f_code.co_filename == PRELUDE_FILE:
            return None
        if event == "line":
            raising.discard(id(frame))  # 例外已被 try/except 接住，恢復正常
            record(frame, "line")
        elif event == "return":
            loops.on_return(frame)
            entered.discard(id(frame))
            if id(frame) in raising:
                raising.discard(id(frame))
            else:
                record(frame, "return", ret=arg)
        elif event == "exception":
            raising.add(id(frame))
            exc_type, exc_value, _ = arg
            record(frame, "exception", exception=f"{exc_type.__name__}: {exc_value}")
        return tracer

    ns = {"__name__": "__main__"}
    result = {"steps": steps}
    old_stdout = sys.stdout
    sys.stdout = stdout
    try:
        exec(compile(PRELUDE, PRELUDE_FILE, "exec"), ns)
        # 1) 定義使用者函式（不追蹤 module 層級）
        exec(compile(code, USER_FILE, "exec"), ns)
        # 2) 編譯測試呼叫：單一運算式用 eval，否則用 exec
        try:
            call_code = compile(call_src, INPUT_FILE, "eval")
            is_expr = True
        except SyntaxError:
            call_code = compile(call_src, INPUT_FILE, "exec")
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
        is_timeout = isinstance(exc, TimeoutError) and len(steps) >= MAX_STEPS
        line = _error_line(exc)
        if isinstance(exc, SyntaxError) and exc.filename == INPUT_FILE:
            msg = f"SyntaxError in test call: {exc.msg}"
        else:
            msg = f"{type(exc).__name__}: {exc}"
        result["error"] = {"type": type(exc).__name__, "message": msg, "line": line, "timeout": is_timeout}
        if is_timeout and steps:
            last = dict(steps[-1])
            last.update({"stepIndex": len(steps), "event": "exception", "exception": msg})
            steps.append(last)
    finally:
        sys.stdout = old_stdout

    result["stdout"] = stdout.getvalue()[:MAX_STDOUT]
    return json.dumps(result, ensure_ascii=False)
