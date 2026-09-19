"""Lightweight version fingerprint for live UI sync.

Computed from mtimes/sizes of the file-backed stores so any UI or backend
change (REST mutation or direct file edit) is reflected immediately via
polling or SSE.
"""
from __future__ import annotations

import hashlib
import os
from pathlib import Path
from typing import Any

from django.conf import settings

from .markdown_store import root as markdown_root


def _stat_sig(path: Path) -> str:
    try:
        st = path.stat()
        return f"{int(st.st_mtime_ns)}:{st.st_size}"
    except FileNotFoundError:
        return "0:0"
    except OSError:
        return "0:0"


def _dir_sig(paths: list[Path], pattern: str = "**/*") -> str:
    """Aggregate sig for a directory (count + max mtime + total size)."""
    max_ns = 0
    total = 0
    count = 0
    for base in paths:
        if not base.exists():
            continue
        if base.is_file():
            try:
                st = base.stat()
                max_ns = max(max_ns, int(st.st_mtime_ns))
                total += st.st_size
                count += 1
            except OSError:
                continue
        else:
            for p in base.glob(pattern):
                if not p.is_file():
                    continue
                try:
                    st = p.stat()
                    max_ns = max(max_ns, int(st.st_mtime_ns))
                    total += st.st_size
                    count += 1
                except OSError:
                    continue
    return f"{count}:{max_ns}:{total}"


def collect_resource_versions() -> dict[str, str]:
    md_root = markdown_root()
    cfg_path = Path(settings.HELIX_CONFIG_PATH)
    # File-backed resources
    resources: dict[str, str] = {}
    resources["results"] = _stat_sig(md_root / "results.json")
    resources["logs"] = _stat_sig(md_root / "logs.json")
    resources["rules"] = _dir_sig([md_root / "rules"], "*.md")
    resources["skills"] = _dir_sig([md_root / "skills"], "**/*.md")
    resources["references"] = _dir_sig([md_root / "references"], "*.md")
    resources["instructions"] = _dir_sig([md_root / "instructions"], "*.md")
    resources["assignments"] = _stat_sig(md_root / "rule-assignments.json") + "|" + _stat_sig(md_root / "skill-assignments.json")
    resources["config"] = _stat_sig(cfg_path)
    resources["branding"] = _dir_sig([md_root / "branding"], "*")
    # pipeline_graph lives inside config, so covered by config sig, but expose separately for convenience (same sig)
    resources["pipeline_graph"] = resources["config"]
    # docs catalog is derived from DB introspection + markdown tables — not file-backed; use config+rules sig as proxy
    resources["docs"] = _dir_sig([md_root / "docs"], "**/*") if (md_root / "docs").exists() else resources["rules"]
    # database settings also in config
    resources["database"] = resources["config"]
    # agents definitions: analytics/agents + markdown_files/instructions
    agents_dir = Path(settings.AGENTS_DIR)
    resources["agents"] = _dir_sig([agents_dir, md_root / "instructions"], "**/*.md")
    return resources


def compute_version() -> dict[str, Any]:
    resources = collect_resource_versions()
    # stable global hash
    h = hashlib.sha256()
    for k in sorted(resources.keys()):
        h.update(f"{k}={resources[k]};".encode())
    version = h.hexdigest()[:16]
    return {"version": version, "resources": resources}


def fingerprint_for_wire() -> dict[str, Any]:
    from datetime import datetime, timezone

    data = compute_version()
    data["timestamp"] = datetime.now(timezone.utc).isoformat()
    return data
