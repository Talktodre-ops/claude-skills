"""Per-step summary of a k6 CSV: offered vs served requests a minute, latency, failures.

    python3 analyze.py out/run.csv <step_rpm>"""
import csv
import statistics
import sys
from collections import defaultdict

STEP_SECONDS = 90
STEP_RPM = int(sys.argv[2]) if len(sys.argv) > 2 else 500

path = sys.argv[1]
rows = defaultdict(lambda: {"dur": [], "fail": 0, "n": 0, "s429": 0, "s5xx": 0, "sign": [], "reg_ok": 0, "reg": 0})
start = None
with open(path) as f:
    for r in csv.DictReader(f):
        if r["metric_name"] != "http_req_duration":
            continue
        t = int(float(r["timestamp"]))
        start = start if start is not None else t
        b = rows[(t - start) // STEP_SECONDS]
        status = int(r["status"] or 0)
        b["n"] += 1
        if status == 429:
            b["s429"] += 1
        if status >= 500 or status == 0:
            b["s5xx"] += 1
        if r["scenario"] == "visit":
            b["dur"].append(float(r["metric_value"]))
            if r["expected_response"] == "false":
                b["fail"] += 1
        else:
            b["sign"].append(float(r["metric_value"]))
            if r["name"] == "register":
                b["reg"] += 1
                b["reg_ok"] += status == 201


def pct(xs, p):
    if not xs:
        return 0
    xs = sorted(xs)
    return xs[min(len(xs) - 1, int(len(xs) * p))]


print(f"{'step':>4} {'offered':>8} {'served':>7} {'p50':>6} {'p95':>7} {'p99':>7} {'fail%':>6} {'429':>5} {'5xx':>5} {'signup_p95':>10} {'reg_ok':>7}")
for k in sorted(rows):
    b = rows[k]
    served = b["n"] * 60 / STEP_SECONDS
    bd = b["dur"]
    print(
        f"{k + 1:>4} {(k + 1) * STEP_RPM:>8} {served:>7.0f} {pct(bd, .5):>6.0f} {pct(bd, .95):>7.0f} {pct(bd, .99):>7.0f}"
        f" {100 * b['fail'] / max(1, len(bd)):>6.1f} {b['s429']:>5} {b['s5xx']:>5} {pct(b['sign'], .95):>10.0f}"
        f" {b['reg_ok']:>3}/{b['reg']:<3}"
    )
