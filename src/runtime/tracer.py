"""AlgoAlive Python Execution Tracer.

使用 sys.settrace 攔截使用者函式每一行的執行狀態，序列化成 JSON 回傳給前端。
只追蹤 filename == USER_FILE 的 frame，因此 typing / collections 等內部呼叫不會被記錄。
"""
import sys
import io
import json
import math
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
