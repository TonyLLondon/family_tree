#!/usr/bin/env python3
"""Resumable background batches for `extract_source.py triage` mechanical steps.

Runs one step at a time per job, skips completed steps, records success/failure,
and estimates ETA from measured pages/sec on finished steps.

Usage:
  .venv/bin/python3 projects/ingest_source/runner/batch_runner.py fleet-status --fleet projects/ingest_source/jobs/tehran-gazette-full-ocr-fleet.yaml
  .venv/bin/python3 projects/ingest_source/runner/batch_runner.py fleet-start --fleet projects/ingest_source/jobs/tehran-gazette-full-ocr-fleet.yaml
  .venv/bin/python3 projects/ingest_source/runner/batch_runner.py status --job projects/ingest_source/jobs/<job-id>.yaml

`start` detaches via nohup (same log/state paths as `run`).
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yaml

REPO_ROOT = Path(__file__).resolve().parents[3]
EXTRACT = REPO_ROOT / "projects" / "ingest_source" / "runner" / "extract_source.py"
MARKER_PAGES = REPO_ROOT / "scripts" / "tehran_gazette_marker_pages.py"
MARKER_FULL = REPO_ROOT / "scripts" / "marker_reextract.py"
JOBS_DIR = REPO_ROOT / "projects" / "ingest_source" / "history" / "jobs"


def _utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _parse_pages(spec: str) -> list[int]:
    out: set[int] = set()
    spec = (spec or "").strip()
    for chunk in spec.split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        if "-" in chunk:
            a, b = chunk.split("-", 1)
            lo, hi = int(a), int(b)
            if lo > hi:
                lo, hi = hi, lo
            out.update(range(lo, hi + 1))
        else:
            out.add(int(chunk))
    return sorted(out)


def _job_id(job_path: Path, job: dict[str, Any]) -> str:
    return str(job.get("id") or job_path.stem)


def _paths(job_path: Path, job: dict[str, Any]) -> tuple[Path, Path, Path]:
    jid = _job_id(job_path, job)
    log_dir = REPO_ROOT / job.get("log_dir", "projects/ingest_source/history/jobs")
    log_dir.mkdir(parents=True, exist_ok=True)
    return (
        log_dir / f"{jid}.state.json",
        log_dir / f"{jid}.log",
        log_dir / f"{jid}.pid",
    )


def _load_job(path: Path) -> dict[str, Any]:
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    if not isinstance(data, dict):
        raise SystemExit(f"Job file must be a mapping: {path}")
    if not data.get("slug") or not data.get("steps"):
        raise SystemExit(f"Job needs slug and steps: {path}")
    return data


def _strip_job_keys(job_path: Path, keys: list[str]) -> list[str]:
    """Remove keys from job YAML on disk; return keys actually removed."""
    if not job_path.is_file():
        return []
    raw = job_path.read_text(encoding="utf-8")
    data = yaml.safe_load(raw) or {}
    if not isinstance(data, dict):
        return []
    removed: list[str] = []
    for key in keys:
        if key in data:
            del data[key]
            removed.append(key)
    if not removed:
        return []
    job_path.write_text(yaml.dump(data, allow_unicode=True, sort_keys=False), encoding="utf-8")
    return removed


def _load_state(state_path: Path) -> dict[str, Any]:
    if not state_path.is_file():
        return {"started_at": None, "updated_at": None, "steps": {}}
    try:
        data = json.loads(state_path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {"steps": {}}
    except Exception:
        return {"steps": {}}


def _save_state(state_path: Path, state: dict[str, Any]) -> None:
    state["updated_at"] = _utc_now()
    state_path.write_text(json.dumps(state, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def _python() -> str:
    venv_py = REPO_ROOT / ".venv" / "bin" / "python3"
    if venv_py.is_file():
        return str(venv_py)
    return sys.executable


def _step_page_count(step: dict[str, Any], job: dict[str, Any] | None = None) -> int:
    pages = step.get("pages")
    if pages:
        return len(_parse_pages(str(pages)))
    if step.get("kind") == "marker-full" and job:
        return int(job.get("page_count") or step.get("page_count") or 0)
    return int(step.get("page_count") or 0)


def _eta_seconds(state: dict[str, Any], job: dict[str, Any]) -> tuple[float | None, dict[str, float]]:
    """Return (eta_sec, stats) from completed steps with page counts."""
    steps_state = state.get("steps") or {}
    total_sec = 0.0
    total_pages = 0
    by_kind: dict[str, list[float]] = {}

    for step in job["steps"]:
        sid = step["id"]
        rec = steps_state.get(sid)
        if not rec or rec.get("status") != "ok":
            continue
        elapsed = float(rec.get("elapsed_sec") or 0)
        pc = int(rec.get("page_count") or _step_page_count(step, job))
        if pc <= 0 or elapsed <= 0:
            continue
        total_sec += elapsed
        total_pages += pc
        kind = step.get("kind") or "unknown"
        by_kind.setdefault(kind, []).append(elapsed / pc)

    if total_pages <= 0:
        return None, {}

    avg = total_sec / total_pages
    remaining = 0
    for step in job["steps"]:
        sid = step["id"]
        rec = steps_state.get(sid)
        if rec and rec.get("status") == "ok":
            continue
        remaining += _step_page_count(step, job)

    stats = {k: sum(v) / len(v) for k, v in by_kind.items()}
    return avg * remaining, stats


def _log_line(log_path: Path, msg: str) -> None:
    line = f"[{_utc_now()}] {msg}\n"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("a", encoding="utf-8") as f:
        f.write(line)
    print(line, end="")


def _build_step_cmd(job: dict[str, Any], step: dict[str, Any]) -> list[str]:
    kind = step.get("kind")
    if kind == "marker-pages":
        slug = job["slug"]
        pages = str(step.get("pages") or "")
        out = str(step.get("output") or job.get("marker_output") or "transcription.marker-pilot.fa.md")
        cmd = [_python(), str(MARKER_PAGES), "--slug", slug, "--pages", pages, "--output", out]
        # Detached workers often lack Homebrew on PATH (llama-server for marker-pdf 2.x / Surya).
        llama = Path("/opt/homebrew/bin/llama-server")
        if llama.is_file():
            cmd = ["env", f"LLAMA_CPP_BINARY={llama}", *cmd]
        if step.get("marker_no_force_ocr") or job.get("marker_no_force_ocr"):
            cmd.append("--no-force-ocr")
        return cmd
    if kind == "marker-full":
        slug = job["slug"]
        cmd = [_python(), str(MARKER_FULL), "--slug", slug, "--force-ocr"]
        llama = Path("/opt/homebrew/bin/llama-server")
        if llama.is_file():
            cmd = ["env", f"LLAMA_CPP_BINARY={llama}", *cmd]
        if step.get("marker_backup") or job.get("marker_backup"):
            cmd.append("--backup")
        return cmd
    return _build_triage_cmd(job, step)


def _build_triage_cmd(job: dict[str, Any], step: dict[str, Any]) -> list[str]:
    slug = job["slug"]
    kind = step.get("kind")
    pages = str(step.get("pages") or "")
    dpi = str(step.get("dpi") or job.get("dpi") or 200)
    cmd = [_python(), str(EXTRACT), "triage", "--slug", slug, "--tier", "c"]
    if kind == "render":
        cmd += ["--pages", pages, "--dpi", dpi]
    elif kind == "ocr-index":
        cmd += ["--ocr-index", "--ocr-index-pages", pages]
        if step.get("ocr_index_force") or job.get("ocr_index_force"):
            cmd.append("--ocr-index-force")
        hdpi = step.get("ocr_highres_dpi") or job.get("ocr_highres_dpi")
        if hdpi is not None:
            cmd += ["--ocr-highres-dpi", str(int(hdpi))]
        if step.get("ocr_enable_math") or job.get("ocr_enable_math"):
            cmd.append("--ocr-enable-math")
        if step.get("ocr_no_prefer_pages_png") or job.get("ocr_no_prefer_pages_png"):
            cmd.append("--ocr-no-prefer-pages-png")
    elif kind == "focus":
        focus = str(step.get("focus") or job.get("focus") or "")
        if not focus:
            raise SystemExit(f"Step {step.get('id')} kind=focus needs focus:")
        ctx = str(step.get("context") or job.get("context") or 1)
        cmd += ["--focus", focus, "--context", ctx]
    else:
        raise SystemExit(f"Unknown step kind {kind!r} in step {step.get('id')}")
    return cmd


def cmd_run(args: argparse.Namespace) -> int:
    job_path = Path(args.job).resolve()
    job = _load_job(job_path)
    state_path, log_path, pid_path = _paths(job_path, job)

    if not state_path.parent.exists():
        state_path.parent.mkdir(parents=True, exist_ok=True)

    state = _load_state(state_path)
    if not state.get("started_at"):
        state["started_at"] = _utc_now()
        state["job_file"] = str(job_path.relative_to(REPO_ROOT))
        state["slug"] = job["slug"]

    steps_state = state.setdefault("steps", {})
    retry_failed = bool(args.retry_failed)

    for step in job["steps"]:
        sid = step["id"]
        rec = steps_state.get(sid) or {}
        if rec.get("status") == "running":
            _log_line(log_path, f"RESET {sid} (stale running — interrupted worker)")
            steps_state.pop(sid, None)

    _log_line(log_path, f"batch run begin job={_job_id(job_path, job)} slug={job['slug']}")

    any_failed = False
    for step in job["steps"]:
        sid = step["id"]
        rec = steps_state.get(sid) or {}
        if rec.get("status") == "ok":
            continue
        if rec.get("status") == "failed" and not retry_failed:
            _log_line(log_path, f"SKIP {sid} (failed; pass --retry-failed to retry)")
            any_failed = True
            continue

        pc = _step_page_count(step, job)
        cmd = _build_step_cmd(job, step)
        steps_state[sid] = {
            "status": "running",
            "started_at": _utc_now(),
            "kind": step.get("kind"),
            "pages": step.get("pages"),
            "page_count": pc,
        }
        _save_state(state_path, state)

        eta, stats = _eta_seconds(state, job)
        eta_s = f" ETA ~{_fmt_duration(eta)}" if eta is not None else ""
        _log_line(log_path, f"START {sid} ({pc} pg) {' '.join(cmd[-6:])}{eta_s}")

        t0 = time.monotonic()
        proc = subprocess.run(cmd, cwd=str(REPO_ROOT), capture_output=True, text=True)
        elapsed = time.monotonic() - t0

        if proc.stdout or proc.stderr:
            with log_path.open("a", encoding="utf-8") as lf:
                if proc.stdout:
                    lf.write(proc.stdout)
                    if not proc.stdout.endswith("\n"):
                        lf.write("\n")
                if proc.stderr:
                    lf.write(proc.stderr)
                    if not proc.stderr.endswith("\n"):
                        lf.write("\n")

        if proc.returncode == 0:
            steps_state[sid] = {
                "status": "ok",
                "finished_at": _utc_now(),
                "elapsed_sec": round(elapsed, 2),
                "page_count": pc,
                "sec_per_page": round(elapsed / pc, 2) if pc else None,
                "kind": step.get("kind"),
                "pages": step.get("pages"),
            }
            rate = f"{pc / elapsed:.2f} pg/s" if pc and elapsed > 0 else "—"
            _log_line(log_path, f"OK    {sid} in {_fmt_duration(elapsed)} ({rate})")
        else:
            any_failed = True
            tail = (proc.stderr or proc.stdout or "").strip().splitlines()
            err_tail = "\n".join(tail[-15:]) if tail else "(no output)"
            steps_state[sid] = {
                "status": "failed",
                "finished_at": _utc_now(),
                "elapsed_sec": round(elapsed, 2),
                "page_count": pc,
                "returncode": proc.returncode,
                "error_tail": err_tail,
                "kind": step.get("kind"),
                "pages": step.get("pages"),
            }
            _log_line(log_path, f"FAIL  {sid} rc={proc.returncode} after {_fmt_duration(elapsed)}")
            _log_line(log_path, err_tail)

        _save_state(state_path, state)

    eta, _ = _eta_seconds(state, job)
    done = sum(1 for s in job["steps"] if (steps_state.get(s["id"]) or {}).get("status") == "ok")
    failed = sum(1 for s in job["steps"] if (steps_state.get(s["id"]) or {}).get("status") == "failed")
    pending = len(job["steps"]) - done - failed
    _log_line(
        log_path,
        f"batch run end ok={done} failed={failed} pending={pending}"
        + (f" est_remaining={_fmt_duration(eta)}" if eta else ""),
    )

    if failed == 0 and pending == 0 and job.get("ocr_index_force"):
        removed = _strip_job_keys(job_path, ["ocr_index_force"])
        if removed:
            _log_line(
                log_path,
                f"job complete — removed {', '.join(removed)} from {job_path.relative_to(REPO_ROOT)}",
            )

    if pid_path.is_file():
        try:
            pid_path.unlink()
        except OSError:
            pass

    if failed == 0 and pending == 0 and job.get("on_complete_fleet"):
        _queue_next_fleet_job(job, log_path)

    return 1 if any_failed else 0


def _queue_next_fleet_job(job: dict[str, Any], log_path: Path) -> None:
    """Start the next incomplete PDF in a fleet manifest (same process exit, new worker)."""
    fleet_rel = str(job.get("on_complete_fleet") or "").strip()
    if not fleet_rel:
        return
    fleet_path = (REPO_ROOT / fleet_rel).resolve()
    if not fleet_path.is_file():
        _log_line(log_path, f"WARN on_complete_fleet missing: {fleet_rel}")
        return
    runner = REPO_ROOT / "projects" / "ingest_source" / "runner" / "batch_runner.py"
    py = _python()
    _log_line(log_path, f"job 100% — fleet-start next PDF ({fleet_rel})")
    proc = subprocess.run(
        [
            py,
            str(runner),
            "fleet-start",
            "--fleet",
            str(fleet_path),
            "--parallel",
            "1",
            "--retry-failed",
        ],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
    )
    tail = (proc.stdout or proc.stderr or "").strip().splitlines()
    for line in tail[-3:]:
        _log_line(log_path, f"  fleet-start: {line}")


def _fmt_duration(sec: float | None) -> str:
    if sec is None:
        return "—"
    sec = max(0, sec)
    if sec < 90:
        return f"{sec:.0f}s"
    if sec < 3600:
        return f"{sec / 60:.1f}m"
    return f"{sec / 3600:.1f}h"


def cmd_status(args: argparse.Namespace) -> int:
    job_path = Path(args.job).resolve()
    job = _load_job(job_path)
    state_path, log_path, pid_path = _paths(job_path, job)
    state = _load_state(state_path)
    steps_state = state.get("steps") or {}

    print(f"Job:     {_job_id(job_path, job)}")
    print(f"Slug:    {job['slug']}")
    print(f"State:   {state_path.relative_to(REPO_ROOT)}")
    print(f"Log:     {log_path.relative_to(REPO_ROOT)}")
    if pid_path.is_file():
        pid = pid_path.read_text(encoding="utf-8").strip()
        alive = _pid_alive(int(pid)) if pid.isdigit() else False
        print(f"Worker:  pid {pid} {'(running)' if alive else '(stale pid file)'}")

    eta, stats = _eta_seconds(state, job)
    if stats:
        print("Rates:  " + ", ".join(f"{k} {_fmt_duration(1/v) if v else '—'}/pg" for k, v in stats.items()))
    if eta is not None:
        print(f"ETA:     ~{_fmt_duration(eta)} for incomplete steps (from completed timings)")

    print()
    for step in job["steps"]:
        sid = step["id"]
        rec = steps_state.get(sid) or {}
        st = rec.get("status") or "pending"
        pc = _step_page_count(step, job)
        extra = ""
        if st == "ok":
            extra = f" {_fmt_duration(rec.get('elapsed_sec'))} {rec.get('sec_per_page')} s/pg"
        elif st == "failed":
            extra = f" rc={rec.get('returncode')}"
        print(f"  [{st:7}] {sid:28} {step.get('kind'):10} {step.get('pages') or '':12} ({pc} pg){extra}")

    return 0


def _pid_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def _job_page_progress(job: dict[str, Any], state: dict[str, Any]) -> tuple[int, int, int, int]:
    """Return (pages_done, pages_total, steps_ok, steps_total)."""
    steps_state = state.get("steps") or {}
    pages_done = 0
    pages_total = 0
    steps_ok = 0
    for step in job["steps"]:
        pc = _step_page_count(step, job)
        pages_total += pc
        rec = steps_state.get(step["id"]) or {}
        if rec.get("status") == "ok":
            steps_ok += 1
            pages_done += int(rec.get("page_count") or pc)
    return pages_done, pages_total, steps_ok, len(job["steps"])


def _job_running(job_path: Path, job: dict[str, Any]) -> bool:
    _, _, pid_path = _paths(job_path, job)
    if not pid_path.is_file():
        return False
    pid = pid_path.read_text(encoding="utf-8").strip()
    return pid.isdigit() and _pid_alive(int(pid))


def _load_fleet(path: Path) -> dict[str, Any]:
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    if not isinstance(data, dict) or not data.get("jobs"):
        raise SystemExit(f"Fleet manifest needs jobs: list: {path}")
    return data


def _fleet_job_paths(fleet: dict[str, Any]) -> list[Path]:
    out: list[Path] = []
    for row in fleet["jobs"]:
        jp = REPO_ROOT / str(row.get("job_file") or "")
        if not jp.is_file():
            raise SystemExit(f"Fleet job file missing: {jp}")
        out.append(jp)
    return out


def cmd_fleet_status(args: argparse.Namespace) -> int:
    fleet_path = Path(args.fleet).resolve()
    fleet = _load_fleet(fleet_path)
    jobs_meta = {str(r["job_file"]): r for r in fleet["jobs"]}

    total_pages = 0
    done_pages = 0
    total_steps = 0
    ok_steps = 0
    failed_steps = 0
    running_jobs: list[str] = []
    weighted_sec = 0.0
    weighted_pages = 0

    print(f"Fleet:   {fleet.get('id') or fleet_path.stem}")
    print(f"Manifest:{fleet_path.relative_to(REPO_ROOT)}")
    if fleet.get("description"):
        print(f"Note:    {str(fleet['description']).strip().splitlines()[0]}")
    print()

    for job_path in _fleet_job_paths(fleet):
        job = _load_job(job_path)
        state_path, _, pid_path = _paths(job_path, job)
        state = _load_state(state_path)
        pd, pt, so, st = _job_page_progress(job, state)
        total_pages += pt
        done_pages += pd
        total_steps += st
        ok_steps += so
        steps_state = state.get("steps") or {}
        failed_steps += sum(
            1 for s in job["steps"] if (steps_state.get(s["id"]) or {}).get("status") == "failed"
        )

        for step in job["steps"]:
            rec = steps_state.get(step["id"])
            if not rec or rec.get("status") != "ok":
                continue
            pc = int(rec.get("page_count") or _step_page_count(step, job))
            el = float(rec.get("elapsed_sec") or 0)
            if pc > 0 and el > 0:
                weighted_sec += el
                weighted_pages += pc

        jid = _job_id(job_path, job)
        meta = jobs_meta.get(str(job_path.relative_to(REPO_ROOT)), {})
        run = _job_running(job_path, job)
        if run:
            running_jobs.append(jid)
        eta, _ = _eta_seconds(state, job)
        pct = (100.0 * pd / pt) if pt else 0.0
        eta_s = f" ~{_fmt_duration(eta)}" if eta is not None else ""
        flag = " RUN" if run else ""
        pdf_short = Path(str(meta.get("pdf") or "")).name
        print(
            f"  {jid:42} {pd:4}/{pt:<4} pg ({pct:5.1f}%){eta_s}{flag}"
            + (f"  {pdf_short}" if pdf_short else "")
        )

    remain = total_pages - done_pages
    fleet_eta: float | None = None
    if weighted_pages > 0 and remain > 0:
        fleet_eta = (weighted_sec / weighted_pages) * remain

    print()
    pct_all = (100.0 * done_pages / total_pages) if total_pages else 0.0
    print(
        f"Total:   {done_pages}/{total_pages} pages ({pct_all:.1f}%)"
        f"  |  steps ok {ok_steps}/{total_steps}"
        + (f"  failed {failed_steps}" if failed_steps else "")
    )
    if weighted_pages > 0:
        avg = weighted_sec / weighted_pages
        print(f"Rate:    {_fmt_duration(avg)}/page (fleet average from {weighted_pages} completed pages)")
    if fleet_eta is not None:
        print(f"ETA:     ~{_fmt_duration(fleet_eta)} for {remain} remaining pages")
    if running_jobs:
        print(f"Workers: {', '.join(running_jobs)}")
    else:
        print("Workers: (none — run fleet-start to resume)")

    return 0


def cmd_fleet_start(args: argparse.Namespace) -> int:
    fleet_path = Path(args.fleet).resolve()
    fleet = _load_fleet(fleet_path)
    parallel = max(1, int(args.parallel))
    started = 0

    for job_path in _fleet_job_paths(fleet):
        job = _load_job(job_path)
        state = _load_state(_paths(job_path, job)[0])
        pd, pt, _, _ = _job_page_progress(job, state)
        if pd >= pt and pt > 0:
            continue
        if _job_running(job_path, job):
            continue

        alive = sum(
            1 for jp in _fleet_job_paths(fleet) if _job_running(jp, _load_job(jp))
        )
        if alive >= parallel:
            break

        ns = argparse.Namespace(
            job=str(job_path),
            retry_failed=bool(getattr(args, "retry_failed", False)),
        )
        cmd_start(ns)
        started += 1

    if started == 0:
        alive = sum(
            1 for jp in _fleet_job_paths(fleet) if _job_running(jp, _load_job(jp))
        )
        if alive:
            print(f"No new workers started ({alive} already at parallel limit {parallel}).")
        else:
            print("Fleet complete — all jobs at 100% pages.")
    else:
        print(f"Started {started} worker(s) (parallel limit {parallel}).")
    return 0


def cmd_start(args: argparse.Namespace) -> int:
    job_path = Path(args.job).resolve()
    job = _load_job(job_path)
    _, log_path, pid_path = _paths(job_path, job)

    if pid_path.is_file():
        pid = pid_path.read_text(encoding="utf-8").strip()
        if pid.isdigit() and _pid_alive(int(pid)):
            print(f"Already running (pid {pid}). Log: {log_path.relative_to(REPO_ROOT)}")
            return 0

    runner = REPO_ROOT / "projects" / "ingest_source" / "runner" / "batch_runner.py"
    py = _python()
    log_path.parent.mkdir(parents=True, exist_ok=True)
    run_argv = [py, str(runner), "run", "--job", str(job_path)]
    if getattr(args, "retry_failed", False):
        run_argv.append("--retry-failed")
    with open(log_path, "a", encoding="utf-8") as logf:
        proc = subprocess.Popen(
            run_argv,
            cwd=str(REPO_ROOT),
            stdout=logf,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )
    pid_path.write_text(str(proc.pid), encoding="utf-8")
    print(f"Started background worker pid={proc.pid}")
    print(f"  log:   {log_path.relative_to(REPO_ROOT)}")
    print(f"  state: {_paths(job_path, job)[0].relative_to(REPO_ROOT)}")
    print(f"  watch: tail -f {log_path.relative_to(REPO_ROOT)}")
    print(f"  status: {py} {runner.relative_to(REPO_ROOT)} status --job {job_path.relative_to(REPO_ROOT)}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Resumable triage batch runner")
    sub = ap.add_subparsers(dest="cmd", required=True)

    pr = sub.add_parser("run", help="Run pending steps (foreground)")
    pr.add_argument("--job", required=True, help="Path to job YAML")
    pr.add_argument(
        "--retry-failed",
        action="store_true",
        help="Retry steps previously marked failed",
    )
    pr.set_defaults(func=cmd_run)

    ps = sub.add_parser("status", help="Print step table and ETA")
    ps.add_argument("--job", required=True)
    ps.set_defaults(func=cmd_status)

    pst = sub.add_parser("start", help="Detach worker (nohup-style)")
    pst.add_argument("--job", required=True)
    pst.add_argument(
        "--retry-failed",
        action="store_true",
        help="Retry steps previously marked failed",
    )
    pst.set_defaults(func=cmd_start)

    pfs = sub.add_parser("fleet-status", help="Aggregate progress/ETA for a fleet manifest")
    pfs.add_argument(
        "--fleet",
        default="projects/ingest_source/jobs/tehran-gazette-full-ocr-fleet.yaml",
        help="Path to fleet YAML (jobs list)",
    )
    pfs.set_defaults(func=cmd_fleet_status)

    pfst = sub.add_parser("fleet-start", help="Start workers for incomplete fleet jobs")
    pfst.add_argument(
        "--fleet",
        default="projects/ingest_source/jobs/tehran-gazette-full-ocr-fleet.yaml",
    )
    pfst.add_argument(
        "--parallel",
        type=int,
        default=1,
        help="Max concurrent batch_runner workers (default 1: one Surya OCR at a time)",
    )
    pfst.add_argument(
        "--retry-failed",
        action="store_true",
        help="Pass --retry-failed to each started worker (OCR MPS blips)",
    )
    pfst.set_defaults(func=cmd_fleet_start)

    args = ap.parse_args()
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
