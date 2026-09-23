"""MCP server configuration helpers.

Reads / writes Cursor's ``mcp.json``: list MCPs, enable/disable one, and
define an SQL Server MCP from the connection string already configured in
Settings → Database.  Environment values and auth headers are secrets:
they are written to the file but NEVER returned by :func:`list_servers`.
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

DEFAULT_MCP_CONFIG = r"C:\Users\armin\.cursor\mcp.json"
DISABLED_KEY = "disabledMcpServers"
ENABLED_KEY = "mcpServers"
_SQL_NAME_RE = re.compile(r"sql|mssql|sqlserver", re.IGNORECASE)
_SECRET_ARG_RE = re.compile(
    r"(?i)(key|token|secret|password|passwd|pwd)(=|\s+)\S+"
)
_SQL_ENGINES = {"sqlserver", "mssql"}


def mcp_config_path() -> Path:
    """Resolve the MCP config path on this host (Windows path or container)."""
    raw = os.environ.get("HELIX_MCP_CONFIG_PATH") or DEFAULT_MCP_CONFIG
    candidate = Path(raw)
    try:
        if candidate.exists():
            return candidate
    except OSError:
        pass
    # Running inside the Docker container: C:\Users\<user>\... -> /host/<user>/...
    normalized = raw.replace("/", "\\")
    match = re.match(r"^[A-Za-z]:\\Users\\(.+)$", normalized)
    if match:
        mapped = Path("/host") / match.group(1).replace("\\", "/")
        try:
            if mapped.exists() or mapped.parent.exists():
                return mapped
        except OSError:
            pass
    return candidate


def _read(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(f"mcp config not found: {DEFAULT_MCP_CONFIG}")
    try:
        data = json.loads(path.read_text(encoding="utf-8") or "{}")
    except json.JSONDecodeError as exc:
        raise ValueError("mcp config is not valid JSON") from exc
    if not isinstance(data, dict):
        raise ValueError("mcp config must be a JSON object")
    return data


def _write(path: Path, data: dict[str, Any]) -> None:
    path.write_text(
        json.dumps(data, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def _server_map(data: dict[str, Any], key: str) -> dict[str, Any]:
    raw = data.get(key)
    return raw if isinstance(raw, dict) else {}


def _scrub_args(args: list[str]) -> list[str]:
    """Mask inline secrets inside argv (``--token=abc`` style)."""
    return [
        _SECRET_ARG_RE.sub(lambda m: f"{m.group(1)}{m.group(2)}***", str(a))
        for a in args
    ]


def _summarize(name: str, spec: Any, enabled: bool) -> dict[str, Any]:
    spec_dict = spec if isinstance(spec, dict) else {}
    env_raw = spec_dict.get("env")
    env = env_raw if isinstance(env_raw, dict) else {}
    headers_raw = spec_dict.get("headers")
    headers = headers_raw if isinstance(headers_raw, dict) else {}
    url = str(spec_dict.get("url") or "")
    # Query strings may embed tokens — show the endpoint without them.
    url_display = url.split("?")[0]
    command = str(spec_dict.get("command") or "")
    args_raw = spec_dict.get("args")
    args_list = args_raw if isinstance(args_raw, list) else []
    args = _scrub_args([str(a) for a in args_list])
    haystack = " ".join([name, command, " ".join(args)])
    return {
        "name": name,
        "enabled": enabled,
        "transport": "http" if url else "stdio",
        "command": command,
        "args": args,
        "url": url_display,
        "env_keys": sorted(str(k) for k in env),
        "header_keys": sorted(str(k) for k in headers),
        "is_sql_server": bool(_SQL_NAME_RE.search(haystack)),
    }


def list_servers() -> dict[str, Any]:
    """All MCP servers with secrets stripped (env/header values never leave the file)."""
    path = mcp_config_path()
    if not path.exists():
        return {
            "config_path": DEFAULT_MCP_CONFIG,
            "exists": False,
            "servers": [],
        }
    data = _read(path)
    enabled_map = _server_map(data, ENABLED_KEY)
    disabled_map = _server_map(data, DISABLED_KEY)
    servers = [_summarize(str(n), s, True) for n, s in enabled_map.items()]
    servers += [_summarize(str(n), s, False) for n, s in disabled_map.items()]
    servers.sort(key=lambda s: (not s["is_sql_server"], s["name"].lower()))
    return {
        "config_path": DEFAULT_MCP_CONFIG,
        "exists": True,
        "servers": servers,
    }


def set_enabled(name: str, enabled: bool) -> dict[str, Any]:
    """Enable/disable one MCP by moving it between mcpServers / disabledMcpServers.

    ``disabledMcpServers`` is a sibling key Cursor ignores, so a disabled
    server keeps its full definition but is no longer loaded — a real toggle.
    """
    path = mcp_config_path()
    data = _read(path)
    enabled_map = _server_map(data, ENABLED_KEY)
    disabled_map = _server_map(data, DISABLED_KEY)

    if name in enabled_map:
        currently_enabled = True
    elif name in disabled_map:
        currently_enabled = False
    else:
        raise ValueError(f"unknown MCP server: {name}")

    if bool(enabled) == currently_enabled:
        return list_servers()

    if enabled:
        entry = disabled_map.pop(name)
        enabled_map[name] = entry
        if disabled_map:
            data[DISABLED_KEY] = disabled_map
        else:
            data.pop(DISABLED_KEY, None)
    else:
        entry = enabled_map.pop(name)
        disabled_map[name] = entry
        data[DISABLED_KEY] = disabled_map
    data[ENABLED_KEY] = enabled_map
    _write(path, data)
    return list_servers()


def ensure_sql_server() -> dict[str, Any]:
    """Create/refresh the SQL Server MCP entry from Settings → Database.

    Uses the mssql-mcp-server stdio entry (``npx -y mssql-mcp-server``) with
    ``MSSQL_CONNECTION_STRING`` built from the connection already configured
    in the app — the connection string never round-trips through the UI.
    """
    from .config_loader import get_database_engine, get_database_settings

    engine = str(get_database_engine() or "").lower()
    if engine not in _SQL_ENGINES:
        raise ValueError(
            f"configured database engine is {engine!r}; "
            "the SQL Server MCP requires engine 'sqlserver'"
        )
    db = get_database_settings()
    host = str(db.get("host") or "").strip()
    port = db.get("port") or 1433
    database = str(db.get("name") or "").strip()
    user = str(db.get("user") or "")
    password = str(db.get("password") or "")
    if not host or not database:
        raise ValueError("database host/name is not configured in Settings")

    # ADO-style string expected by the mssql npm driver (not the ODBC Driver={...} form).
    connection_string = (
        f"Server={host},{port};"
        f"Database={database};"
        f"User Id={user};"
        f"Password={password};"
        f"Encrypt={'true' if db.get('encrypt') else 'false'};"
        f"TrustServerCertificate="
        f"{'true' if db.get('trust_server_certificate') else 'false'};"
    )

    name = "helix-sqlserver"
    entry = {
        "command": "npx",
        "args": ["-y", "mssql-mcp-server"],
        "env": {
            "MSSQL_CONNECTION_STRING": connection_string,
            # Let the agent actually query through the MCP; Helix rules keep it SELECT-only.
            "MSSQL_ENABLE_EXECUTE_QUERY": "true",
        },
    }

    path = mcp_config_path()
    data = _read(path)
    enabled_map = _server_map(data, ENABLED_KEY)
    disabled_map = _server_map(data, DISABLED_KEY)
    disabled_map.pop(name, None)
    enabled_map[name] = entry
    data[ENABLED_KEY] = enabled_map
    if DISABLED_KEY in data:
        data[DISABLED_KEY] = disabled_map
    _write(path, data)
    return _summarize(name, entry, True)
