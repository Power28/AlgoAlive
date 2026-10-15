"""直接用 Python tracer 驗證所有教學範例，以及 tracer 本身的行為（不需要瀏覽器）。

用法：python scripts/check_examples.py   （或 npm run test:tracer）

每個範例檢查：
- 執行沒有錯誤、步數在 MAX_STEPS 以內
- 回傳值依前端 formatPy 的規則格式化後，等於 src/tutorials/*.ts 裡的 expected
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src" / "runtime"))
from tracer import MAX_STEPS, algoalive_run  # noqa: E402

# ─────────────── 與 src/lib/pyValue.ts 的 formatPy / formatCell 相同的格式化 ───────────────

GRAPH_FIELDS = re.compile(r"^(neighbors|neighbours|children|adj|adjacent|edges|nbrs)$", re.I)


def node_kind(obj):
    f = obj["fields"]
    if "left" in f or "right" in f:
        return "tree"
    if "next" in f:
        return "list"
    for name, v in f.items():
        items = v.get("items")
        if items is not None and (GRAPH_FIELDS.match(name) or (items and all(x["type"] == "ref" for x in items))):
            return "graph"
    return "object"


def ref_target(v, heap):
    return v["id"] if v and v["type"] == "ref" and v["id"] in heap else None


def fmt_cell(v, heap=None):
    t = v["type"]
    if t == "ref":
        val = (heap or {}).get(v["id"], {}).get("fields", {}).get("val")
        return f"({fmt_cell(val)})" if val else v["cls"]
    if t == "str":
        return v["value"]
    if t == "float" and isinstance(v["value"], str) and v["value"] in ("inf", "-inf"):
        return "∞" if v["value"] == "inf" else "-∞"
    if t == "bool":
        return "T" if v["value"] else "F"
    return fmt(v, heap)


def fmt_float(x):
    if isinstance(x, str):
        return f"float('{x}')" if x in ("inf", "-inf", "nan") else x
    return f"{x:.1f}" if float(x).is_integer() else repr(x)


def fmt(v, heap=None):
    t = v["type"]
    f = lambda x: fmt(x, heap)  # noqa: E731
    more = f", …+{v['truncated']}" if v.get("truncated") else ""
    if t == "none":
        return "None"
    if t == "bool":
        return "True" if v["value"] else "False"
    if t == "int":
        return str(v["value"])
    if t == "float":
        return fmt_float(v["value"])
    if t == "str":
        s = v["value"].replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n")
        return f"'{s}'"
    if t == "list":
        return f"[{', '.join(map(f, v['items']))}{more}]"
    if t == "deque":
        return f"deque([{', '.join(map(f, v['items']))}{more}])"
    if t == "tuple":
        return f"({f(v['items'][0])},)" if len(v["items"]) == 1 else f"({', '.join(map(f, v['items']))}{more})"
    if t == "set":
        return "set()" if not v["items"] else f"{{{', '.join(map(f, v['items']))}{more}}}"
    if t == "dict":
        return "{" + ", ".join(f"{f(k)}: {f(x)}" for k, x in v["entries"]) + more + "}"
    if t == "repr":
        return v["value"]
    if t == "ref":
        return fmt_ref(v, heap)
    raise ValueError(f"unknown type {t}")


def fmt_ref(v, heap):
    obj = (heap or {}).get(v["id"])
    if not obj:
        return f"{v['cls']}(…)"
    kind = node_kind(obj)
    none = {"type": "none"}
    if kind == "list":
        vals, seen, cur = [], set(), v["id"]
        while cur and cur not in seen and len(vals) < 30:
            seen.add(cur)
            vals.append(fmt_cell(heap[cur]["fields"].get("val", none)))
            cur = ref_target(heap[cur]["fields"].get("next"), heap)
        tail = (" ↺" if cur in seen else " → …") if cur else ""
        return " → ".join(vals) + tail
    if kind == "tree":
        out, queue, seen = [], [v["id"]], set()
        while queue and len(out) < 63:
            cur = queue.pop(0)
            if not cur or cur in seen:
                out.append("null")
                continue
            seen.add(cur)
            fields = heap[cur]["fields"]
            out.append(fmt_cell(fields.get("val", none)))
            queue += [ref_target(fields.get("left"), heap), ref_target(fields.get("right"), heap)]
        while out and out[-1] == "null":
            out.pop()
        return f"[{', '.join(out)}]"
    if kind == "graph":
        val = obj["fields"].get("val")
        return f"{obj['cls']}({fmt_cell(val) if val else ''})"
    fields = ", ".join(f"{k}={x['cls'] + '(…)' if x['type'] == 'ref' else fmt(x)}" for k, x in obj["fields"].items())
    return f"{obj['cls']}({fields})"


# ─────────────── 讀取教學範例 ───────────────

EXAMPLE_RE = re.compile(
    r"id: '(lc\d+)'.*?code: `(.*?)`,\s*call: '((?:[^'\\]|\\.)*)',\s*expected: '((?:[^'\\]|\\.)*)',",
    re.S,
)


def unescape(s):
    return re.sub(r"\\(.)", r"\1", s)


def load_examples():
    examples = []
    for path in sorted((ROOT / "src" / "tutorials").glob("*.ts")):
        src = path.read_text(encoding="utf-8")
        for m in EXAMPLE_RE.finditer(src):
            examples.append({
                "id": m.group(1),
                "file": path.name,
                "code": m.group(2),
                "call": unescape(m.group(3)),
                "expected": unescape(m.group(4)),
            })
    return examples


def run(code, call):
    return json.loads(algoalive_run(code, call))


# ─────────────── tracer 行為測試 ───────────────

def tracer_cases():
    """(名稱, 檢查函式)；檢查函式回傳錯誤訊息，通過則回傳 None。"""

    def infinite_loop():
        r = run("def f():\n    while True:\n        pass\n", "f()")
        if not (r.get("error", {}).get("timeout") and len(r["steps"]) == MAX_STEPS + 1):
            return f"expected TimeoutError after {MAX_STEPS} steps, got {r.get('error')} / {len(r['steps'])} steps"

    def syntax_error():
        r = run("def f(:\n    pass\n", "f()")
        err = r.get("error") or {}
        if err.get("type") != "SyntaxError" or err.get("line") != 1:
            return f"expected SyntaxError at line 1, got {err}"

    def runtime_error_line():
        r = run("def f(a):\n    x = 1\n    return a[5]\n", "f([1])")
        err = r.get("error") or {}
        if err.get("type") != "IndexError" or err.get("line") != 3 or r["steps"][-1]["event"] != "exception":
            return f"expected IndexError at line 3, got {err}"

    def class_solution():
        code = "class Solution:\n    def add(self, a, b):\n        total = a + b\n        return total\n"
        r = run(code, "Solution().add(2, 3)")
        if fmt(r["returnValue"]) != "5" or any("self" in s["variables"] for s in r["steps"]):
            return "class Solution: wrong result or `self` leaked into variables"

    def stdout_capture():
        r = run("def f():\n    print('hi')\n    return 1\n", "f()")
        if r["steps"][-1]["stdout"] != "hi\n":
            return f"stdout not captured: {r['steps'][-1]['stdout']!r}"

    def user_listnode_init_skipped():
        code = (
            "class ListNode:\n    def __init__(self, val=0, next=None):\n        self.val = val\n        self.next = next\n\n"
            "def first(head):\n    return head.val\n"
        )
        r = run(code, "first(build_list([7, 8]))")
        funcs = {s["funcName"] for s in r["steps"]}
        if funcs != {"first"}:
            return f"__init__ called from build_list should not be traced, got {funcs}"

    def recursion_stack_refs():
        code = "def depth(root):\n    if not root:\n        return 0\n    return 1 + max(depth(root.left), depth(root.right))\n"
        r = run(code, "depth(build_tree([1, 2]))")
        deep = [s for s in r["steps"] if s["depth"] == 3]
        if not deep or not deep[0].get("stackRefs") or len(deep[0].get("heap", {})) != 2:
            return "inner recursive frames should still see the whole tree (heap + stackRefs)"

    def condition_values():
        code = "def f(nums, target):\n    left, right = 0, len(nums) - 1\n    while left < right:\n        left += 1\n    return left\n"
        r = run(code, "f([1, 2, 3], 9)")
        cond = next((s["condition"] for s in r["steps"] if "condition" in s), None)
        if not cond or cond["display"] != "0 < 2" or cond["result"] is not True:
            return f"expected condition '0 < 2' → True, got {cond and (cond['display'], cond['result'])}"
        locs = [t.get("loc") for t in cond["parts"][0]["terms"]]
        if locs != [{"var": "left"}, {"var": "right"}]:
            return f"operands should point at left / right, got {locs}"

    def condition_short_circuit():
        code = "def f(stack, t):\n    while stack and stack[-1] < t:\n        stack.pop()\n    return len(stack)\n"
        r = run(code, "f([], 5)")
        cond = next((s["condition"] for s in r["steps"] if "condition" in s), None)
        parts = cond and cond["parts"]
        if not parts or parts[0]["result"] is not False or not parts[1].get("skipped"):
            return f"`stack` should be False and the comparison skipped, got {parts}"

    def condition_side_effects_not_evaluated():
        r = run("def f(stack):\n    if stack.pop() > 1:\n        return 1\n    return 0\n", "f([1, 2])")
        cond = next((s["condition"] for s in r["steps"] if "condition" in s), None)
        if fmt(r["returnValue"]) != "1":
            return f"evaluating the condition changed the program: returned {fmt(r['returnValue'])}"
        if not cond or cond["result"] is not None:
            return "a condition with stack.pop() must not be evaluated ahead of time"

    def first_calc(code, call, line):
        r = run(code, call)
        return r, next((s["calc"] for s in r["steps"] if s.get("calc") and s["lineNumber"] == line), None)

    def calc_stages():
        code = "def f(lo, hi):\n    mid = (lo + hi) // 2\n    return mid\n"
        _, calc = first_calc(code, "f(0, 7)", 2)
        if not calc or calc["stages"] != ["(0 + 7) // 2", "7 // 2", "3"] or calc.get("targetLoc") != {"var": "mid"}:
            return f"expected (0 + 7) // 2 → 7 // 2 → 3 into mid, got {calc and (calc['stages'], calc.get('targetLoc'))}"

    def calc_augmented():
        _, calc = first_calc("def f(left):\n    left += 1\n    return left\n", "f(0)", 2)
        if not calc or calc["kind"] != "aug" or calc["stages"] != ["0 + 1", "1"]:
            return f"expected left += 1 as 0 + 1 → 1, got {calc and (calc['kind'], calc['stages'])}"

    def calc_cell_read_write():
        code = "def f(dp, i):\n    dp[i] = dp[i - 1] + dp[i - 2]\n    return dp\n"
        _, calc = first_calc(code, "f([1, 2, 0], 2)", 2)
        reads = [t.get("loc") for t in (calc or {}).get("terms", [])]
        if not calc or calc.get("targetLoc") != {"var": "dp", "index": 2} or reads != [{"var": "dp", "index": 1}, {"var": "dp", "index": 0}]:
            return f"dp[2] should be written from dp[1] and dp[0], got {calc and (calc.get('targetLoc'), reads)}"

    def calc_skips_user_calls():
        code = "def helper(x):\n    return x * 2\n\ndef f(y):\n    z = helper(y) + 1\n    return z\n"
        r, calc = first_calc(code, "f(3)", 5)
        if calc is not None:
            return "an expression calling a user function must not be evaluated ahead of time"
        if fmt(r["returnValue"]) != "7":
            return f"program result changed: {fmt(r['returnValue'])}"

    def first_cond(code, call, line):
        r = run(code, call)
        return next((s["condition"] for s in r["steps"] if s.get("condition") and s["lineNumber"] == line), None)

    def logic_or_returns_operand():
        cond = first_cond("def f(a, b):\n    x = a or b\n    return x\n", "f(None, build_list([3]))", 2)
        if not cond or cond.get("context") != "value" or (cond.get("value") or {}).get("type") != "ref":
            return f"`None or node` should evaluate to the node itself, got {cond and (cond.get('context'), cond.get('value'))}"

    def logic_tree_short_circuit():
        code = "def f(a, b, c):\n    if (a > 0 and b > 0) or not c:\n        return 1\n    return 0\n"
        cond = first_cond(code, "f(-1, 5, [])", 2)
        tree = (cond or {}).get("tree") or {}
        and_node = (tree.get("children") or [{}])[0]
        b_cmp = (and_node.get("children") or [{}, {}])[1]
        if tree.get("op") != "or" or tree.get("truthy") is not True or and_node.get("shortCircuitAt") != 0 or not b_cmp.get("skipped"):
            return f"expected or(and(a>0 ✗, b>0 skipped), not c ✓) → True, got {tree}"

    def bits_recorded():
        code = "def f(n):\n    n &= n - 1\n    return n\n"
        _, calc = first_calc(code, "f(11)", 2)
        if not calc or calc.get("bits") != [{"op": "&", "left": 11, "right": 10, "result": 10}]:
            return f"expected 11 & 10 = 10 in bits, got {calc and calc.get('bits')}"

    def loop_iterations():
        r = run("def f(nums):\n    total = 0\n    for num in nums:\n        total += num\n    return total\n", "f([5, 6])")
        seen = [(s["lineNumber"], l["iteration"], l.get("total"), bool(l.get("done")))
                for s in r["steps"] for l in s.get("loops", [])]
        want = [(3, 1, 2, False), (4, 1, 2, False), (3, 2, 2, False), (4, 2, 2, False), (3, 3, 2, True)]
        if seen != want:
            return f"expected passes {want}, got {seen}"
        loop = next(l for s in r["steps"] for l in s.get("loops", []))
        if loop.get("seq") != "nums" or loop.get("item") != "num":
            return f"for num in nums should point `num` at `nums`, got {loop}"

    def nested_loop_restarts():
        code = "def g(rows, cols):\n    c = 0\n    for r in range(rows):\n        for k in range(cols):\n            c += 1\n    return c\n"
        r = run(code, "g(2, 2)")
        inner = [l["iteration"] for s in r["steps"] if s["lineNumber"] == 5 for l in s.get("loops", []) if l["line"] == 4]
        if inner != [1, 2, 1, 2]:
            return f"inner loop should restart from 1 on each outer pass, got {inner}"

    def call_stack_frames():
        code = "def depth(root):\n    if not root:\n        return 0\n    return 1 + max(depth(root.left), depth(root.right))\n"
        r = run(code, "depth(build_tree([3, 9]))")
        deepest = max(r["steps"], key=lambda s: len(s.get("stack", [])))
        frames = [(f["func"], f["args"]) for f in deepest["stack"]]
        want = [("depth", [["root", "(3)"]]), ("depth", [["root", "(9)"]]), ("depth", [["root", "None"]])]
        entered = sum(1 for s in r["steps"] if s.get("entered"))
        if frames != want:
            return f"expected stack {want}, got {frames}"
        if entered != 5:  # depth(3)、depth(9)、depth(9).left、depth(9).right、depth(3).right
            return f"expected 5 calls to be marked as entered, got {entered}"

    def container_ops():
        code = (
            "def f(st, q, seen, d):\n    st.append(3)\n    x = st.pop()\n    y = q.popleft()\n"
            "    seen.add(1)\n    d['a'] = 5\n    return x + y\n"
        )
        r = run(code, "f([1, 2], deque([7, 8]), {1}, {})")
        ops = [(s["op"]["kind"], s["op"]["target"], s["op"].get("display"), s["op"].get("index"), s["op"].get("assignTo"))
               for s in r["steps"] if s.get("op")]
        want = [("push", "st", "3", 2, None), ("pop", "st", "3", 2, "x"), ("popleft", "q", "7", 0, "y"),
                ("add", "seen", "1", None, None), ("setitem", "d", "5", None, None)]
        if ops != want:
            return f"expected {want}, got {ops}"
        if fmt(r["returnValue"]) != "10":
            return f"reading ahead must not change the program: returned {fmt(r['returnValue'])}"

    def heap_ops():
        code = "def g(stones):\n    heap = [-s for s in stones]\n    heapq.heapify(heap)\n    first = -heapq.heappop(heap)\n    heapq.heappush(heap, -3)\n    return first\n"
        r = run(code, "g([2, 7, 4])")
        ops = [(s["op"]["kind"], s["op"]["container"], s["op"].get("display")) for s in r["steps"] if s.get("op")]
        want = [("heapify", "heap", None), ("heappop", "heap", "-7"), ("heappush", "heap", "-3")]
        if ops != want or fmt(r["returnValue"]) != "7":
            return f"expected {want} returning 7, got {ops} / {fmt(r['returnValue'])}"

    def empty_pop_flagged():
        r = run("def h(st):\n    return st.pop()\n", "h([])")
        op = next((s["op"] for s in r["steps"] if s.get("op")), None)
        if not op or not op.get("empty") or (r.get("error") or {}).get("type") != "IndexError":
            return f"pop on an empty list should be flagged before the IndexError, got {op}"

    return [
        ("infinite loop stops at MAX_STEPS", infinite_loop),
        ("syntax error reports line", syntax_error),
        ("runtime error reports line", runtime_error_line),
        ("class Solution hides self", class_solution),
        ("print output is captured", stdout_capture),
        ("build_list does not trace user __init__", user_listnode_init_skipped),
        ("recursion keeps whole tree reachable", recursion_stack_refs),
        ("condition values are substituted", condition_values),
        ("and / or short-circuit is recorded", condition_short_circuit),
        ("conditions with side effects are not evaluated", condition_side_effects_not_evaluated),
        ("arithmetic is reduced step by step", calc_stages),
        ("augmented assignment is shown as a calculation", calc_augmented),
        ("calculation reads / writes list cells", calc_cell_read_write),
        ("calculations calling user functions are skipped", calc_skips_user_calls),
        ("and / or return the operand itself", logic_or_returns_operand),
        ("logic tree records short-circuit", logic_tree_short_circuit),
        ("bitwise operands are recorded in binary", bits_recorded),
        ("loop passes are counted", loop_iterations),
        ("nested loops restart their count", nested_loop_restarts),
        ("call stack lists frames and arguments", call_stack_frames),
        ("container operations are described ahead of time", container_ops),
        ("heapq operations are recognised", heap_ops),
        ("pop on an empty container is flagged", empty_pop_flagged),
    ]


def main():
    failures = 0
    examples = load_examples()
    if not examples:
        print("✗ no examples found in src/tutorials/*.ts")
        return 1

    print(f"Tutorial examples ({len(examples)})")
    seen = set()
    for ex in examples:
        problems = []
        if ex["id"] in seen:
            problems.append("duplicate id")
        seen.add(ex["id"])
        r = run(ex["code"], ex["call"])
        if r.get("error"):
            problems.append(r["error"]["message"])
        elif len(r["steps"]) >= MAX_STEPS:
            problems.append(f"{len(r['steps'])} steps (limit {MAX_STEPS})")
        else:
            got = fmt(r["returnValue"], r.get("returnHeap"))
            if got != ex["expected"]:
                problems.append(f"expected {ex['expected']!r}, got {got!r}")
        mark = "✗" if problems else "✓"
        print(f"  {mark} {ex['id']:<7} {len(r['steps']):>3} steps  {'; '.join(problems)}")
        failures += bool(problems)

    print("Tracer behaviour")
    for name, check in tracer_cases():
        problem = check()
        print(f"  {'✗' if problem else '✓'} {name}{'  — ' + problem if problem else ''}")
        failures += bool(problem)

    print(f"\n{'FAILED' if failures else 'PASSED'}: {failures} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
