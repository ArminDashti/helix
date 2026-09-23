"""Registry of pipeline runs parked on an operator question.

A paused run keeps its ``ctx`` so the answer request continues the same conversation instead of
replaying SQL and LLM turns. The ctx is held in this process *and* spooled to disk, because the
answer arrives in a different HTTP request: with more than one worker (``gunicorn --workers 2``)
or after a restart the file is what makes the question still answerable. Both stores are keyed by
run id; a pause older than ``PAUSE_TTL_SECONDS`` is forgotten and the operator is told it expired.
"""

from __future__ import annotations

import os
import pickle
import re
import tempfile
import threading
import time
import uuid
from pathlib import Path
from typing import Any

# How long a parked run waits for an answer before it is forgotten (seconds).
PAUSE_TTL_SECONDS = float(os.environ.get("HELIX_PAUSE_TTL_SECONDS") or 1800)

# Where parked runs are spooled when they outlive a request. Every worker on the host must see the
# same directory, so it defaults to a fixed name under the system temp dir rather than a per-process one.
SPOOL_DIR = Path(
    os.environ.get("HELIX_PAUSE_DIR") or Path(tempfile.gettempdir()) / "helix-pauses"
)

# A run id is echoed from the client on the answer request and then used as a file name: keep it to
# characters that cannot walk out of SPOOL_DIR.
_RUN_ID_RE = re.compile(r"^[A-Za-z0-9_.-]{1,128}$")

_LOCK = threading.Lock()
_PAUSED: dict[str, dict[str, Any]] = {}


def _valid_run_id(run_id: str | None) -> str:
    key = str(run_id or "").strip()
    return key if _RUN_ID_RE.match(key) else ""


def _spool_path(run_id: str) -> Path:
    return SPOOL_DIR / f"pause-{run_id}.pickle"


def _write_spool(item: dict[str, Any]) -> None:
    """Best-effort: a ctx that will not pickle still works in this process only."""
    try:
        SPOOL_DIR.mkdir(mode=0o700, parents=True, exist_ok=True)
        target = _spool_path(str(item["run_id"]))
        tmp = target.with_suffix(f".{uuid.uuid4().hex}.tmp")
        tmp.write_bytes(pickle.dumps(item, protocol=pickle.HIGHEST_PROTOCOL))
        os.replace(tmp, target)
    except Exception:  # noqa: BLE001 - persistence is an optimisation, never a failure
        pass


def _read_spool(run_id: str) -> dict[str, Any] | None:
    try:
        with _spool_path(run_id).open("rb") as handle:
            item = pickle.load(handle)
    except Exception:  # noqa: BLE001 - missing/corrupt spool == expired
        return None
    return item if isinstance(item, dict) else None


def _unlink_spool(run_id: str) -> None:
    try:
        _spool_path(run_id).unlink(missing_ok=True)
    except Exception:  # noqa: BLE001
        pass


def _fresh(item: dict[str, Any] | None, now: float) -> dict[str, Any] | None:
    if not item:
        return None
    if now - float(item.get("paused_at") or 0.0) > PAUSE_TTL_SECONDS:
        return None
    return item


def _prune_locked(now: float) -> None:
    stale = [
        run_id
        for run_id, item in _PAUSED.items()
        if _fresh(item, now) is None
    ]
    for run_id in stale:
        _PAUSED.pop(run_id, None)
        _unlink_spool(run_id)
    try:
        for path in SPOOL_DIR.glob("pause-*.pickle"):
            if now - path.stat().st_mtime > PAUSE_TTL_SECONDS:
                path.unlink(missing_ok=True)
    except Exception:  # noqa: BLE001 - the spool dir may not exist yet
        pass


def pause_run(
    ctx: dict[str, Any],
    *,
    agent_id: str,
    node: str,
    questions: list[dict[str, Any]],
) -> str:
    """Park a paused run and return the run id its answer request is addressed to."""
    run_id = str(ctx.get("run_id") or "").strip() or uuid.uuid4().hex
    ctx["run_id"] = run_id
    now = time.time()
    item = {
        "run_id": run_id,
        "ctx": ctx,
        "agent_id": str(agent_id or ""),
        "node": str(node or ""),
        "questions": list(questions or []),
        "paused_at": now,
    }
    with _LOCK:
        _prune_locked(now)
        _PAUSED[run_id] = item
    _write_spool(item)
    return run_id


def pop_paused(run_id: str | None) -> dict[str, Any] | None:
    """Take a parked run out of the registry (None when it expired or never existed)."""
    key = _valid_run_id(run_id)
    if not key:
        return None
    now = time.time()
    with _LOCK:
        _prune_locked(now)
        item = _PAUSED.pop(key, None)
    item = _fresh(item, now) or _fresh(_read_spool(key), now)
    if item is None:
        return None
    if str(item.get("run_id") or "") != key:
        # A spool file whose contents disagree with its name is not something to resume.
        return None
    _unlink_spool(key)
    return item


def peek_paused(run_id: str | None) -> dict[str, Any] | None:
    """Look at a parked run without consuming it (for status/tests)."""
    key = _valid_run_id(run_id)
    if not key:
        return None
    now = time.time()
    with _LOCK:
        _prune_locked(now)
        item = _PAUSED.get(key)
    item = _fresh(item, now) or _fresh(_read_spool(key), now)
    return dict(item) if item else None
