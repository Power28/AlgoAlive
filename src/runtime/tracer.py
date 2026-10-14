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
USER_FILE = "<algoalive>"
INPUT_FILE = "<input>"

PRELUDE = """
from typing import *
from collections import *
import collections, math, heapq, bisect, itertools, functools, string, re
"""

_SKIP_TYPES = (
    types.FunctionType, types.BuiltinFunctionType, types.MethodType,
    types.ModuleType, type,
)


def _ser(v, depth=0, seen=None):
    """把 Python 值轉成帶型別標籤的 JSON 結構（深拷貝語意，不保留參照）。"""
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

    if depth >= MAX_DEPTH:
        return {"type": "repr", "value": "…"}
    if id(v) in seen:
        return {"type": "repr", "value": "[circular]"}

    seen = seen | {id(v)}
    if isinstance(v, (list, tuple, collections.deque)):
        kind = "list" if isinstance(v, list) else ("tuple" if isinstance(v, tuple) else "deque")
        items = list(v)
        out = {"type": kind, "items": [_ser(x, depth + 1, seen) for x in items[:MAX_ITEMS]]}
        if len(items) > MAX_ITEMS:
            out["truncated"] = len(items) - MAX_ITEMS
        return out
    if isinstance(v, (set, frozenset)):
        try:
            items = sorted(v)
        except TypeError:
            items = list(v)
        out = {"type": "set", "items": [_ser(x, depth + 1, seen) for x in items[:MAX_ITEMS]]}
        if len(items) > MAX_ITEMS:
            out["truncated"] = len(items) - MAX_ITEMS
        return out
    if isinstance(v, dict):
        entries = list(v.items())
        out = {
            "type": "dict",
            "entries": [[_ser(k, depth + 1, seen), _ser(x, depth + 1, seen)] for k, x in entries[:MAX_ITEMS]],
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


def _snapshot(frame):
    out = {}
    for name, value in frame.f_locals.items():
        # ".0" 之類是 comprehension / generator 的內部迭代器變數
        if name.startswith("__") or name.startswith(".") or name == "self":
            continue
        if isinstance(value, _SKIP_TYPES):
            continue
        out[name] = _ser(value)
    return out


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

    def record(frame, event, **extra):
        if len(steps) >= MAX_STEPS:
            raise TimeoutError(f"Execution exceeded {MAX_STEPS} steps (possible infinite loop)")
        step = {
            "stepIndex": len(steps),
            "lineNumber": frame.f_lineno,
            "event": event,
            "funcName": frame.f_code.co_name,
            "depth": _user_depth(frame),
            "variables": _snapshot(frame),
            "stdout": stdout.getvalue()[:MAX_STDOUT],
        }
        step.update(extra)
        steps.append(step)

    raising = set()  # 正在因例外而退出的 frame，其 return 事件不應記錄成「回傳 None」

    def tracer(frame, event, arg):
        if frame.f_code.co_filename != USER_FILE:
            return None
        if event == "line":
            raising.discard(id(frame))  # 例外已被 try/except 接住，恢復正常
            record(frame, "line")
        elif event == "return":
            if id(frame) in raising:
                raising.discard(id(frame))
            else:
                record(frame, "return", returnValue=_ser(arg))
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
        exec(PRELUDE, ns)
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
        result["returnValue"] = _ser(value)
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
