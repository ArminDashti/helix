"""Read/write helix.config.yaml (database + openrouter LLM)."""

from __future__ import annotations

import json
import os
import re
import socket
import time
import urllib.error
import urllib.request
import uuid
from urllib.parse import urlparse
from copy import deepcopy
from pathlib import Path
from typing import Any

import yaml
from django.conf import settings

from .agents import (
    AGENT_BY_ID,
    AGENT_IDS,
    AGENT_PIPELINE,
    LEGACY_AGENT_IDS,
    LEGACY_AGENT_RENAMES,
    is_builtin_agent,
)

AGENT_ID_RE = re.compile(r"^[a-z][a-z0-9_-]{0,63}$")
TOKEN_ENV_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
DEFAULT_OPENROUTER_TOKEN_ENV = "OPENROUTER_TOKEN"
DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
PROVIDER_OPENROUTER = "openrouter"
PROVIDER_OPENAI_COMPATIBLE = "openai_compatible"
PROVIDER_CURSOR_HEADLESS_CLI = "cursor_headless_cli"
PROVIDER_OPENCODE_GO = "opencode_go"

# Connectors: every LLM back-end the user can pick, in dropdown order. A connector owns whatever
# the app can decide for the user — endpoint, default model, key env var — so Settings only asks
# for the API key when the vendor endpoint is fixed (`asks_base_url` False), hides the
# Cursor-proxy workspace field on connectors that never use it, and skips the key field entirely
# on connectors that authenticate out of band (`api_key_required` False).
CONNECTORS: dict[str, dict[str, Any]] = {
    PROVIDER_OPENROUTER: {
        "id": PROVIDER_OPENROUTER,
        "label": "OpenRouter",
        "base_url": DEFAULT_OPENROUTER_BASE_URL,
        "token_env": DEFAULT_OPENROUTER_TOKEN_ENV,
        "asks_base_url": True,
        "asks_workspace": True,
        "api_key_required": True,
        "key_url": "https://openrouter.ai/keys",
    },
    # OpenCode Go: one API key and nothing else — the plan's subscription endpoint and model
    # catalog are the vendor's. base_url is the OpenAI-compatible root serving
    # /chat/completions and /models.
    PROVIDER_OPENCODE_GO: {
        "id": PROVIDER_OPENCODE_GO,
        "label": "OpenCode-Go",
        "base_url": "https://opencode.ai/zen/go/v1",
        "default_model": "deepseek-v4-flash",
        "token_env": "OPENCODE_GO_API_KEY",
        "asks_base_url": False,
        "asks_workspace": False,
        "api_key_required": True,
        "key_url": "https://opencode.ai/auth",
        # opencode.ai sits behind Cloudflare, which answers urllib's default User-Agent with
        # 403 / error 1010 — /models and /chat/completions both need a real one.
        "headers": {"User-Agent": "Helix/1.0"},
        # Go routes on a stable per-conversation id and rejects a request without one
        # (400 MissingSessionID), so the header name lives with the connector.
        "session_header": "x-opencode-session",
    },
    PROVIDER_OPENAI_COMPATIBLE: {
        "id": PROVIDER_OPENAI_COMPATIBLE,
        "label": "OpenAI-compatible",
        "base_url": "",
        "token_env": DEFAULT_OPENROUTER_TOKEN_ENV,
        "asks_base_url": True,
        "asks_workspace": True,
        "api_key_required": True,
        "key_url": "",
    },
    PROVIDER_CURSOR_HEADLESS_CLI: {
        "id": PROVIDER_CURSOR_HEADLESS_CLI,
        "label": "Cursor-Headless-CLI",
        "base_url": "",
        "token_env": "CURSOR_API_KEY",
        "asks_base_url": False,
        "asks_workspace": True,
        "api_key_required": False,
        "key_url": "",
    },
}
VALID_PROVIDERS = tuple(CONNECTORS)


def _normalize_llm_mode(value: Any) -> str:
    """Cursor headless / proxy mode — Agent only (ask/plan are non-executing)."""
    mode = str(value or "").strip().lower()
    if mode in ("", "agent"):
        return "agent"
    # Coerce ask/plan (and any unknown) to agent.
    return "agent"


DEFAULT_DATABASE = {
    # Built-in AdventureWorks LT sample SQLite (seeded on first start).
    "engine": "sqlite",
    "host": "",
    "port": 0,
    "name": "helix-sample.sqlite",
    "user": "",
    "password": "",
    "sslmode": "prefer",
    "driver": "ODBC Driver 18 for SQL Server",
    "trust_server_certificate": True,
    "encrypt": True,
    "path": "",
}

DEFAULT_LLM_MODEL = "composer-2.5"

DEFAULT_AGENT_MODELS = {
    "orchester": DEFAULT_LLM_MODEL,
    "web-searcher": DEFAULT_LLM_MODEL,
}

DEFAULT_OPENROUTER = {
    "token_env": DEFAULT_OPENROUTER_TOKEN_ENV,
    "base_url": DEFAULT_OPENROUTER_BASE_URL,
    "app_name": "Helix",
    "default_model": DEFAULT_LLM_MODEL,
    "agents": {agent_id: {"model": model} for agent_id, model in DEFAULT_AGENT_MODELS.items()},
}

DEFAULT_PROVIDER = PROVIDER_OPENROUTER


def connector_meta(provider: str | None) -> dict[str, Any]:
    """Descriptor of one connector; {} when the id is unknown."""
    return CONNECTORS.get(str(provider or "").strip().lower(), {})


def get_connectors() -> list[dict[str, Any]]:
    """Connector descriptors for the Settings form. Never carries a secret."""
    return [dict(CONNECTORS[provider_id]) for provider_id in VALID_PROVIDERS]


def provider_default_base_url(provider: str | None) -> str:
    """Vendor endpoint of a connector that owns one; '' means the user supplies it."""
    return str(connector_meta(provider).get("base_url") or "")


def provider_default_model(provider: str | None) -> str:
    """Model the app proposes for a connector (falls back to the shared default)."""
    return str(connector_meta(provider).get("default_model") or DEFAULT_LLM_MODEL)


def provider_default_token_env(provider: str | None) -> str:
    """Env var an unset connector falls back to when no key is stored in config."""
    return str(connector_meta(provider).get("token_env") or DEFAULT_OPENROUTER_TOKEN_ENV)


def new_llm_session_id() -> str:
    """A fresh conversation id for vendors that route on one (OpenCode Go)."""
    return f"helix-{uuid.uuid4().hex}"


# Fallback conversation id: stable for the life of this process, so call sites that have no
# conversation of their own (settings tester, policy check) still send a routable session.
_PROCESS_SESSION_ID = new_llm_session_id()


def get_llm_headers(provider: str | None = None, session_id: str | None = None) -> dict[str, str]:
    """Extra HTTP headers the connector's vendor expects on every LLM request.

    Vendors front their API with a WAF (opencode.ai answers urllib's default User-Agent with
    403 / error 1010), so the User-Agent and any attribution headers belong to the connector
    rather than to each call site. A connector that routes on a session id (``session_header``)
    gets one here too: the caller's conversation id when it has one, else the process id.
    """
    meta = connector_meta(provider or get_provider())
    headers = dict(meta["headers"]) if isinstance(meta.get("headers"), dict) else {}
    session_header = str(meta.get("session_header") or "").strip()
    if session_header:
        headers[session_header] = str(session_id or "").strip() or _PROCESS_SESSION_ID
    return headers


def provider_label(provider: str | None = None) -> str:
    """Human-facing connector name, for status text; falls back to the raw id."""
    provider_id = str(provider or get_provider()).strip().lower()
    return str(connector_meta(provider_id).get("label") or provider_id)


def _config_path() -> Path:
    return Path(settings.HELIX_CONFIG_PATH)


def _example_path() -> Path:
    return Path(settings.HELIX_CONFIG_EXAMPLE_PATH)


def ensure_config_exists() -> Path:
    path = _config_path()
    if path.exists():
        return path
    example = _example_path()
    if example.exists():
        path.write_text(example.read_text(encoding="utf-8"), encoding="utf-8")
    else:
        path.write_text(
            yaml.safe_dump({"database": deepcopy(DEFAULT_DATABASE)}, sort_keys=False),
            encoding="utf-8",
        )
    return path


DEFAULT_SQL = {
    "max_retries": 3,
    "require_row_limit": False,
    "enforce_allowlist": False,
    "forbid_select_star": True,
    "max_rows": 10000,
}


def _migrate_agent_model_map(agents: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key, value in agents.items():
        if key in LEGACY_AGENT_IDS and key not in LEGACY_AGENT_RENAMES:
            continue
        out[LEGACY_AGENT_RENAMES.get(key, key)] = value
    return out


def _migrate_legacy_agent_ids(data: dict[str, Any]) -> dict[str, Any]:
    """Rewrite retired pipeline agent ids in agent-model maps and graphs only."""
    migrated = deepcopy(data)
    for section in ("openrouter",):
        block = migrated.get(section)
        if isinstance(block, dict) and isinstance(block.get("agents"), dict):
            block["agents"] = _migrate_agent_model_map(block["agents"])
    deleted = migrated.get("deleted_agents")
    if isinstance(deleted, list):
        next_deleted: list[str] = []
        for item in deleted:
            value = str(item).strip()
            if value in LEGACY_AGENT_IDS and value not in LEGACY_AGENT_RENAMES:
                continue
            next_deleted.append(LEGACY_AGENT_RENAMES.get(value, value))
        migrated["deleted_agents"] = next_deleted
    graph = migrated.get("pipeline_graph")
    if isinstance(graph, dict):
        if str(graph.get("entry") or "") in LEGACY_AGENT_RENAMES:
            graph["entry"] = LEGACY_AGENT_RENAMES[str(graph["entry"])]
        for node in graph.get("nodes") or []:
            if isinstance(node, dict):
                node_id = str(node.get("id") or "")
                if node_id in LEGACY_AGENT_RENAMES:
                    node["id"] = LEGACY_AGENT_RENAMES[node_id]
        for edge in graph.get("edges") or []:
            if not isinstance(edge, dict):
                continue
            for end in ("source", "target"):
                value = str(edge.get(end) or "")
                if value in LEGACY_AGENT_RENAMES:
                    edge[end] = LEGACY_AGENT_RENAMES[value]
    return migrated


def _drop_stale_pipeline_graph(data: dict[str, Any]) -> dict[str, Any]:
    graph = data.get("pipeline_graph")
    if not isinstance(graph, dict):
        return data
    node_ids = {
        str(node.get("id") or "").strip()
        for node in (graph.get("nodes") or [])
        if isinstance(node, dict)
    }
    if node_ids & LEGACY_AGENT_IDS:
        data = dict(data)
        data.pop("pipeline_graph", None)
        data.pop("pipeline_flow", None)
    return data


_DEFAULT_PIPELINE_AGENT_IDS = ("orchester", "guardian", "researcher", "final-approver")


def _ensure_single_orchester_pipeline(data: dict[str, Any]) -> dict[str, Any]:
    """Reset saved graphs that are not the four-agent LangGraph seed."""
    expected = set(_DEFAULT_PIPELINE_AGENT_IDS)
    needs_reset = False
    graph = data.get("pipeline_graph")
    if isinstance(graph, dict):
        node_ids = {
            str(node.get("id") or "").strip()
            for node in (graph.get("nodes") or [])
            if isinstance(node, dict)
        }
        if node_ids != expected:
            needs_reset = True
        for edge in graph.get("edges") or []:
            if not isinstance(edge, dict):
                continue
            eid = str(edge.get("id") or "")
            src = str(edge.get("source") or "")
            tgt = str(edge.get("target") or "")
            if eid.startswith("e_retry_") and src == tgt:
                needs_reset = True
                break
    flow = data.get("pipeline_flow")
    if isinstance(flow, dict) and flow.get("type") == "stages":
        children = flow.get("children") or []
        agent_ids = [
            str(child.get("agent_id") or "").strip()
            for child in children
            if isinstance(child, dict)
        ]
        if agent_ids != list(_DEFAULT_PIPELINE_AGENT_IDS):
            needs_reset = True
    if not needs_reset:
        return data
    out = dict(data)
    out.pop("pipeline_graph", None)
    out.pop("pipeline_flow", None)
    return out


def _migrate_cursor_provider(data: dict[str, Any]) -> dict[str, Any]:
    raw = data.get("provider")
    if isinstance(raw, str) and raw.strip().lower() == "cursor":
        out = dict(data)
        out["provider"] = "openai_compatible"
        return out
    return data


def load_config() -> dict[str, Any]:
    path = ensure_config_exists()
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    if not isinstance(data, dict):
        data = {}
    migrated = _ensure_single_orchester_pipeline(
        _drop_stale_pipeline_graph(
            _migrate_legacy_agent_ids(_migrate_cursor_provider(data))
        )
    )
    if not isinstance(migrated, dict):
        migrated = {}
    if migrated != data:
        save_config(migrated)
        return migrated
    return data


def save_config(data: dict[str, Any]) -> None:
    path = ensure_config_exists()
    path.write_text(
        yaml.safe_dump(data, sort_keys=False, allow_unicode=True),
        encoding="utf-8",
    )


def is_user_provided_database(db: dict[str, Any] | None) -> bool:
    """True when the user configured a real database (not the built-in sample)."""
    from .db_dialects.base import normalize_engine
    from .sample_database import is_sample_db_path

    if not isinstance(db, dict) or not db:
        return False
    engine = normalize_engine(db.get("engine"))
    name = str(db.get("name") or db.get("path") or "").strip()
    host = str(db.get("host") or "").strip()
    if engine == "sqlite":
        return bool(name) and not is_sample_db_path(name)
    return bool(host and name)


def _explicit_warehouse_engine(db: dict[str, Any]) -> str | None:
    from .db_dialects.base import ENGINE_ALIASES

    raw = str(db.get("engine") or "").strip().lower()
    if not raw:
        return None
    engine = ENGINE_ALIASES.get(raw)
    if engine in ("sqlserver", "postgresql"):
        return engine
    return None


def _finalize_database(db: dict[str, Any] | None) -> dict[str, Any]:
    """Normalize settings. Sample SQLite is only used when the engine is sqlite."""
    from .db_dialects.base import normalize_engine
    from .sample_database import SAMPLE_FILENAME, is_sample_db_path, resolve_sqlite_path

    raw = db if isinstance(db, dict) else {}
    warehouse_engine = _explicit_warehouse_engine(raw)
    merged = {**DEFAULT_DATABASE, **raw}
    if warehouse_engine:
        merged["engine"] = warehouse_engine
        leftover_name = str(merged.get("name") or merged.get("path") or "").strip()
        if is_sample_db_path(leftover_name):
            merged["name"] = ""
            merged["path"] = ""
    elif not is_user_provided_database(merged):
        merged = deepcopy(DEFAULT_DATABASE)
    merged["engine"] = normalize_engine(merged.get("engine"))
    if merged["engine"] == "sqlite":
        default_port = 0
    elif merged["engine"] == "postgresql":
        default_port = 5432
    else:
        default_port = 1433
    try:
        merged["port"] = int(merged.get("port") or default_port)
    except (TypeError, ValueError):
        merged["port"] = default_port
    merged["trust_server_certificate"] = bool(merged.get("trust_server_certificate", True))
    merged["encrypt"] = bool(merged.get("encrypt", True))
    for key in (
        "host",
        "name",
        "user",
        "password",
        "driver",
        "sslmode",
        "path",
    ):
        merged[key] = "" if merged.get(key) is None else str(merged[key])
    if merged["engine"] == "sqlite":
        raw_name = (merged.get("name") or merged.get("path") or SAMPLE_FILENAME).strip()
        resolved = resolve_sqlite_path(raw_name or SAMPLE_FILENAME)
        merged["name"] = str(resolved)
        merged["path"] = str(resolved)
    else:
        merged["path"] = ""
    return merged


def get_database_engine() -> str:
    from .db_dialects.base import normalize_engine

    db = get_database_settings()
    return normalize_engine(db.get("engine"))


def get_database_settings() -> dict[str, Any]:
    data = load_config()
    db = data.get("database") or {}
    if not isinstance(db, dict):
        db = {}
    return _finalize_database(db)


def update_database_settings(payload: dict[str, Any]) -> dict[str, Any]:
    data = load_config()
    conn = payload.get("connection_string")
    engine_hint = _explicit_warehouse_engine(payload)
    use_connection_string = conn is not None and str(conn).strip() != ""
    if use_connection_string and engine_hint in ("sqlserver", "postgresql"):
        if str(conn).strip().lower().startswith("file:"):
            use_connection_string = False
    if use_connection_string:
        current = connection_string_to_database(str(conn))
        if engine_hint:
            current["engine"] = engine_hint
    else:
        current = get_database_settings()
        if engine_hint:
            current["engine"] = engine_hint
    allowed = set(DEFAULT_DATABASE.keys())
    for key, value in payload.items():
        if key not in allowed:
            continue
        if key == "port":
            try:
                current[key] = int(value)
            except (TypeError, ValueError) as exc:
                raise ValueError("port must be an integer") from exc
        elif key in ("trust_server_certificate", "encrypt"):
            current[key] = bool(value)
        elif key == "engine":
            from .db_dialects.base import normalize_engine

            current[key] = normalize_engine(str(value))
        else:
            current[key] = "" if value is None else str(value)
    current = _finalize_database(current)
    data["database"] = current
    save_config(data)
    if current.get("engine") == "sqlite" and not is_user_provided_database(current):
        from .sample_database import ensure_sample_database

        try:
            ensure_sample_database()
        except PermissionError:
            pass
    return current


def database_to_connection_string(db: dict[str, Any] | None = None) -> str:
    from .db_dialects.base import normalize_engine

    db = db or get_database_settings()
    engine = normalize_engine(db.get("engine"))
    if engine == "postgresql":
        parts = [
            f"host={db['host']}",
            f"port={db['port']}",
            f"dbname={db['name']}",
            f"user={db['user']}",
            f"password={db['password']}",
        ]
        sslmode = (db.get("sslmode") or "prefer").strip()
        if sslmode:
            parts.append(f"sslmode={sslmode}")
        return " ".join(parts)
    if engine == "sqlite":
        from .sample_database import resolve_sqlite_path

        path = resolve_sqlite_path(db.get("name") or db.get("path") or "")
        return f"file:{path}"
    parts = [
        f"Driver={{{db['driver']}}}",
        f"Server={db['host']},{db['port']}",
        f"Database={db['name']}",
        f"Uid={db['user']}",
        f"Pwd={db['password']}",
        f"Encrypt={'yes' if db['encrypt'] else 'no'}",
        f"TrustServerCertificate={'yes' if db['trust_server_certificate'] else 'no'}",
        "Connection Timeout=15",
    ]
    return ";".join(parts)


def connection_string_to_database(conn: str) -> dict[str, Any]:
    """Parse a connection string into database settings."""
    if not isinstance(conn, str) or not conn.strip():
        raise ValueError("connection_string must be a non-empty string")

    current = get_database_settings()
    stripped = conn.strip()
    if stripped.lower().startswith("file:"):
        current["engine"] = "sqlite"
        current["name"] = stripped[5:]
        current["path"] = current["name"]
        return current

    if "host=" in stripped and "dbname=" in stripped:
        parts: dict[str, str] = {}
        for chunk in stripped.split():
            if "=" not in chunk:
                continue
            key, value = chunk.split("=", 1)
            parts[key.strip().lower()] = value.strip()
        current["engine"] = "postgresql"
        current["host"] = parts.get("host", current["host"])
        if "port" in parts:
            try:
                current["port"] = int(parts["port"])
            except ValueError as exc:
                raise ValueError("connection_string port must be an integer") from exc
        current["name"] = parts.get("dbname", current["name"])
        current["user"] = parts.get("user", current["user"])
        current["password"] = parts.get("password", current["password"])
        if "sslmode" in parts:
            current["sslmode"] = parts["sslmode"]
        return current

    parts = {}
    for chunk in stripped.split(";"):
        chunk = chunk.strip()
        if not chunk or "=" not in chunk:
            continue
        key, value = chunk.split("=", 1)
        parts[key.strip().lower()] = value.strip()

    current["engine"] = "sqlserver"
    driver = parts.get("driver")
    if driver:
        current["driver"] = driver.strip("{}")

    server = parts.get("server") or parts.get("data source") or parts.get("address")
    if server:
        if "," in server:
            host, port_s = server.rsplit(",", 1)
            current["host"] = host.strip()
            try:
                current["port"] = int(port_s.strip())
            except ValueError as exc:
                raise ValueError("connection_string Server port must be an integer") from exc
        else:
            current["host"] = server.strip()

    if "database" in parts or "initial catalog" in parts:
        current["name"] = parts.get("database") or parts.get("initial catalog") or ""
    if "uid" in parts or "user id" in parts or "username" in parts:
        current["user"] = (
            parts.get("uid") or parts.get("user id") or parts.get("username") or ""
        )
    if "pwd" in parts or "password" in parts:
        current["password"] = parts.get("pwd") or parts.get("password") or ""

    encrypt = parts.get("encrypt")
    if encrypt is not None:
        current["encrypt"] = encrypt.lower() in ("yes", "true", "1")
    trust = parts.get("trustservercertificate")
    if trust is not None:
        current["trust_server_certificate"] = trust.lower() in ("yes", "true", "1")

    return current


def _normalize_token_env(value: Any, default: str) -> str:
    name = default if value is None else str(value).strip()
    if not name:
        name = default
    if not TOKEN_ENV_RE.match(name):
        raise ValueError("token_env must be a valid environment variable name")
    return name


def _token_env_from_section(raw: dict[str, Any], default: str) -> str:
    try:
        return _normalize_token_env(raw.get("token_env"), default)
    except ValueError:
        return default


def get_openrouter_token_env() -> str:
    data = load_config()
    raw = data.get("openrouter") or {}
    if not isinstance(raw, dict):
        raw = {}
    return _token_env_from_section(raw, provider_default_token_env(get_provider()))


def _section_stored_token(raw: Any) -> str:
    if not isinstance(raw, dict):
        return ""
    return str(raw.get("token") or "").strip()


def get_openrouter_token() -> str:
    """LLM API key from Settings (config), then optional env fallback."""
    data = load_config()
    token = _section_stored_token(data.get("openrouter"))
    if token:
        return token
    return os.environ.get(get_openrouter_token_env(), "").strip()


def _normalize_base_url(raw: Any) -> str:
    return str(raw or "").strip().rstrip("/")


def _rewrite_unresolvable_hostname_to_localhost(base_url: str) -> str:
    """
    Rewrite an unresolvable LLM hostname to localhost.

    Why: config may point at a container hostname which is only resolvable from
    inside Docker. When running on the host, DNS will fail, and the pipeline
    should fall back to `127.0.0.1`.
    """
    parsed = urlparse(base_url)
    hostname = parsed.hostname
    if not hostname:
        return base_url

    try:
        socket.getaddrinfo(hostname, None)
        return base_url
    except OSError:
        netloc = "127.0.0.1"
        if parsed.port:
            netloc = f"127.0.0.1:{parsed.port}"
        return parsed._replace(netloc=netloc).geturl()


def get_llm_base_url() -> str:
    """Chat/models host: the stored URL, else the connector's own endpoint."""
    data = load_config()
    raw = data.get("openrouter") or {}
    if not isinstance(raw, dict):
        raw = {}
    stored = _rewrite_unresolvable_hostname_to_localhost(
        _normalize_base_url(raw.get("base_url"))
    )
    if stored:
        return stored
    return provider_default_base_url(get_provider())


DEFAULT_LLM_TIMEOUT_SECONDS = 600


def get_llm_timeout_seconds() -> int:
    """HTTP read timeout for chat/completions (pipeline agents can run long)."""
    data = load_config()
    raw = data.get("openrouter") or {}
    if not isinstance(raw, dict):
        raw = {}
    try:
        value = int(raw.get("timeout_seconds") or DEFAULT_LLM_TIMEOUT_SECONDS)
    except (TypeError, ValueError):
        value = DEFAULT_LLM_TIMEOUT_SECONDS
    return max(30, min(value, 900))


_MODELS_CACHE: dict[str, Any] = {"fetched_at": 0.0, "models": [], "base_url": ""}
_MODELS_CACHE_TTL_SEC = 600


def _catalog_with_auto(models: list[dict[str, str]]) -> list[dict[str, str]]:
    out = list(models)
    if not any(str(item.get("id", "")).lower() == "auto" for item in out):
        out.append({"id": "auto", "name": "Auto"})
    out.sort(key=lambda item: str(item.get("name") or item.get("id") or "").lower())
    return out


def fetch_openrouter_models(*, force: bool = False) -> list[dict[str, str]]:
    """
    Fetch the LLM model catalog from {base_url}/models (cached ~10 minutes).
    Returns list of {id, name}. Raises ValueError if token/base URL missing or request fails.
    """
    now = time.time()
    if get_provider() == PROVIDER_CURSOR_HEADLESS_CLI:
        from .llm_client import list_cursor_cli_models

        cache_key = "cursor_headless_cli"
        if (
            not force
            and _MODELS_CACHE["models"]
            and _MODELS_CACHE.get("base_url") == cache_key
            and (now - float(_MODELS_CACHE["fetched_at"])) < _MODELS_CACHE_TTL_SEC
        ):
            return list(_MODELS_CACHE["models"])
        models = _catalog_with_auto(list_cursor_cli_models())
        _MODELS_CACHE["fetched_at"] = now
        _MODELS_CACHE["models"] = models
        _MODELS_CACHE["base_url"] = cache_key
        return list(models)

    base_url = get_llm_base_url()
    if (
        not force
        and _MODELS_CACHE["models"]
        and _MODELS_CACHE.get("base_url") == base_url
        and (now - float(_MODELS_CACHE["fetched_at"])) < _MODELS_CACHE_TTL_SEC
    ):
        return list(_MODELS_CACHE["models"])

    token = get_openrouter_token()
    if not token:
        raise ValueError("API key is not set")
    if not base_url:
        raise ValueError("Base URL is not set")

    req = urllib.request.Request(
        f"{base_url}/models",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            **get_llm_headers(),
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:300]
        raise ValueError(f"Models request failed ({exc.code}): {body}") from exc
    except urllib.error.URLError as exc:
        raise ValueError(f"Models request failed: {exc.reason}") from exc

    raw_list = None
    if isinstance(payload, dict):
        if isinstance(payload.get("data"), list):
            raw_list = payload.get("data")
        elif isinstance(payload.get("models"), list):
            raw_list = payload.get("models")
    elif isinstance(payload, list):
        raw_list = payload
    if not isinstance(raw_list, list):
        raise ValueError("Unexpected models response")

    models: list[dict[str, str]] = []
    for item in raw_list:
        if not isinstance(item, dict):
            continue
        model_id = item.get("id")
        if not model_id:
            continue
        name = item.get("name") or model_id
        models.append({"id": str(model_id), "name": str(name)})

    models = _catalog_with_auto(models)
    _MODELS_CACHE["fetched_at"] = now
    _MODELS_CACHE["models"] = models
    _MODELS_CACHE["base_url"] = base_url
    return list(models)


def get_openrouter_settings() -> dict[str, Any]:
    data = load_config()
    raw = data.get("openrouter") or {}
    if not isinstance(raw, dict):
        raw = {}

    provider = get_provider()
    agents_raw = raw.get("agents") if isinstance(raw.get("agents"), dict) else {}
    # Agents without a model of their own follow the connector's default (not the OpenRouter-era
    # constant), so switching connector never leaves an agent pinned to a retired vendor's model.
    default_model = (
        str(raw.get("default_model") or "").strip() or provider_default_model(provider)
    )
    # Every known agent gets an entry. The Settings form round-trips this map straight back on
    # save, so an agent missing here would return as the form's placeholder and overwrite the
    # model the admin had stored for it.
    agents: dict[str, dict[str, str]] = {}
    for agent_id in ordered_agent_ids():
        entry = agents_raw.get(agent_id) if isinstance(agents_raw.get(agent_id), dict) else {}
        model = str(entry.get("model") or "").strip()
        agents[agent_id] = {"model": model or default_model}

    token = get_openrouter_token()
    stored_base_url = _normalize_base_url(raw.get("base_url"))
    base_url = stored_base_url or provider_default_base_url(provider)
    workspace = str(raw.get("workspace") or "").strip()
    mode = _normalize_llm_mode(raw.get("mode"))
    return {
        "base_url": base_url,
        "app_name": (
            DEFAULT_OPENROUTER["app_name"]
            if raw.get("app_name") in (None, "")
            else str(raw.get("app_name"))
        ),
        "default_model": default_model,
        "agents": agents,
        "token_configured": bool(token),
        "workspace": workspace,
        "mode": mode,
    }


def update_openrouter_settings(payload: dict[str, Any]) -> dict[str, Any]:
    data = load_config()
    provider = get_provider()
    current = get_openrouter_settings()
    raw = data.get("openrouter") if isinstance(data.get("openrouter"), dict) else {}
    stored_token = _section_stored_token(raw)
    stored_env = _token_env_from_section(raw, provider_default_token_env(provider))

    if "token" in payload:
        incoming = payload.get("token")
        if incoming is not None and str(incoming).strip():
            stored_token = str(incoming).strip()
    if "token_env" in payload:
        stored_env = _normalize_token_env(
            payload["token_env"], DEFAULT_OPENROUTER_TOKEN_ENV
        )
    stored_base_url = _normalize_base_url(raw.get("base_url"))
    if "base_url" in payload:
        stored_base_url = _normalize_base_url(payload.get("base_url"))
    # A connector that owns its endpoint decides it here, not the caller: the Settings form shows
    # no field for it, and a URL left over from another connector would misroute every request.
    if not connector_meta(provider).get("asks_base_url", True):
        managed_base_url = provider_default_base_url(provider)
        if managed_base_url:
            stored_base_url = managed_base_url
    stored_workspace = str(raw.get("workspace") or "").strip()
    if "workspace" in payload:
        stored_workspace = str(payload.get("workspace") or "").strip()
    stored_mode = _normalize_llm_mode(raw.get("mode"))
    if "mode" in payload:
        stored_mode = _normalize_llm_mode(payload.get("mode"))
    if "app_name" in payload:
        value = payload["app_name"]
        current["app_name"] = (
            DEFAULT_OPENROUTER["app_name"] if value in (None, "") else str(value)
        )
    if "default_model" in payload:
        value = payload["default_model"]
        if value is None or str(value).strip() == "":
            raise ValueError("default_model must be a non-empty string")
        current["default_model"] = str(value).strip()

    agents_payload = payload.get("agents")
    if isinstance(agents_payload, dict):
        allowed_ids = known_agent_ids()
        for agent_id, entry in agents_payload.items():
            agent_key = str(agent_id)
            if agent_key not in allowed_ids:
                continue
            if isinstance(entry, dict):
                model = entry.get("model")
            else:
                model = entry
            if model is None or str(model).strip() == "":
                raise ValueError(f"agents.{agent_key}.model must be a non-empty string")
            current["agents"][agent_key] = {"model": str(model).strip()}

    section: dict[str, Any] = {
        "token_env": stored_env,
        "base_url": stored_base_url,
        "app_name": current["app_name"],
        "default_model": current["default_model"],
        "agents": deepcopy(current["agents"]),
    }
    if stored_workspace:
        section["workspace"] = stored_workspace
    if stored_mode:
        section["mode"] = stored_mode
    if "timeout_seconds" in raw:
        section["timeout_seconds"] = raw["timeout_seconds"]
    if stored_token:
        section["token"] = stored_token
    data["openrouter"] = section
    save_config(data)
    _MODELS_CACHE["fetched_at"] = 0.0
    _MODELS_CACHE["models"] = []
    _MODELS_CACHE["base_url"] = ""
    return get_openrouter_settings()


def get_provider() -> str:
    data = load_config()
    raw = data.get("provider")
    if isinstance(raw, str):
        value = raw.strip().lower()
        if value == "cursor":
            update_provider("openai_compatible")
            return "openai_compatible"
        if value in VALID_PROVIDERS:
            return value
    return DEFAULT_PROVIDER


def update_provider(provider: str) -> str:
    value = (provider or "").strip().lower()
    if value not in VALID_PROVIDERS:
        raise ValueError(f"provider must be one of: {', '.join(VALID_PROVIDERS)}")
    data = load_config()
    previous = str(data.get("provider") or "").strip().lower()
    data["provider"] = value
    if value != previous:
        _seed_connector_defaults(data, previous, value)
    save_config(data)
    return value


def _seed_connector_defaults(data: dict[str, Any], previous: str, provider: str) -> None:
    """Carry the app-owned LLM settings over to the connector being selected.

    Only values the app itself wrote — or left empty — are replaced; a base URL or model the user
    typed is kept. Without this, picking a connector that owns its endpoint would keep the previous
    vendor's URL and model ids and fail on the first request.
    """
    raw = data.get("openrouter")
    if not isinstance(raw, dict):
        raw = {}

    previous_url = provider_default_base_url(previous)
    next_url = provider_default_base_url(provider)
    stored_url = _normalize_base_url(raw.get("base_url"))
    if next_url:
        if not stored_url or stored_url in (previous_url, next_url):
            raw["base_url"] = next_url
    elif stored_url and stored_url == previous_url:
        # The new connector has no vendor endpoint of its own: keeping the old one would silently
        # send its traffic to the wrong host, so the user supplies a URL again.
        raw["base_url"] = ""

    previous_model = provider_default_model(previous)
    next_model = provider_default_model(provider)
    stored_model = str(raw.get("default_model") or "").strip()
    if stored_model in ("", previous_model, next_model):
        raw["default_model"] = next_model

    previous_env = provider_default_token_env(previous)
    next_env = provider_default_token_env(provider)
    stored_env = str(raw.get("token_env") or "").strip()
    if stored_env in ("", previous_env, next_env):
        raw["token_env"] = next_env

    agents = raw.get("agents")
    if isinstance(agents, dict):
        for entry in agents.values():
            if not isinstance(entry, dict):
                continue
            model = str(entry.get("model") or "").strip()
            if model in ("", previous_model, next_model):
                entry["model"] = next_model

    data["openrouter"] = raw


# Max data-URL length for company logo (~300KB binary as base64).
_MAX_BRANDING_LOGO_CHARS = 400_000


def get_branding() -> dict[str, str]:
    data = load_config()
    raw = data.get("branding") if isinstance(data.get("branding"), dict) else {}
    name = raw.get("company_name")
    logo = raw.get("company_logo_data_url")
    return {
        "company_name": "" if name in (None, "") else str(name).strip(),
        "company_logo_data_url": (
            ""
            if logo in (None, "")
            else str(logo).strip()[:_MAX_BRANDING_LOGO_CHARS]
        ),
    }


def update_branding(payload: dict[str, Any]) -> dict[str, str]:
    if not isinstance(payload, dict):
        raise ValueError("branding payload must be an object")
    current = get_branding()
    if "company_name" in payload:
        value = payload.get("company_name")
        current["company_name"] = (
            "" if value in (None, "") else str(value).strip()
        )
    if "company_logo_data_url" in payload:
        value = payload.get("company_logo_data_url")
        if value in (None, ""):
            current["company_logo_data_url"] = ""
        else:
            text = str(value).strip()
            if text and not text.startswith("data:image/"):
                raise ValueError(
                    "company_logo_data_url must be an image data URL or empty"
                )
            if len(text) > _MAX_BRANDING_LOGO_CHARS:
                raise ValueError("company_logo_data_url is too large")
            current["company_logo_data_url"] = text
    data = load_config()
    data["branding"] = {
        "company_name": current["company_name"],
        "company_logo_data_url": current["company_logo_data_url"],
    }
    save_config(data)
    return get_branding()


def get_custom_agents() -> list[dict[str, str]]:
    data = load_config()
    raw = data.get("custom_agents")
    if not isinstance(raw, list):
        return []
    agents: list[dict[str, str]] = []
    seen: set[str] = set()
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        agent_id = str(entry.get("id") or "").strip()
        if not agent_id or agent_id in seen:
            continue
        if not AGENT_ID_RE.match(agent_id):
            continue
        seen.add(agent_id)
        name = str(entry.get("name") or "").strip() or agent_id
        description = str(entry.get("description") or "").strip()
        agents.append(
            {
                "id": agent_id,
                "name": name,
                "description": description,
                "builtin": agent_id in AGENT_BY_ID,
                "disabled": bool(entry.get("disabled")),
            }
        )
    return agents


def _apply_agent_profile(meta: dict[str, Any], profiles: dict[str, Any]) -> dict[str, Any]:
    item = dict(meta)
    profile = profiles.get(meta["id"])
    if not isinstance(profile, dict):
        return item
    if profile.get("name"):
        item["name"] = str(profile["name"]).strip()
    if "description" in profile:
        item["description"] = str(profile.get("description") or "").strip()
    return item


def restore_seed_pipeline_agents() -> None:
    """Bring back seed pipeline agents hidden by deleted_agents (one-time)."""
    data = load_config()
    if data.get("pipeline_agents_restored"):
        return
    deleted = get_deleted_agent_ids()
    data["deleted_agents"] = sorted(deleted - set(AGENT_IDS))
    data["pipeline_agents_restored"] = True
    save_config(data)


def get_all_agent_metas() -> list[dict[str, Any]]:
    restore_seed_pipeline_agents()
    disabled = get_disabled_agent_ids()
    deleted = get_deleted_agent_ids()
    data = load_config()
    profiles = data.get("agent_profiles") if isinstance(data.get("agent_profiles"), dict) else {}
    custom_by_id = {item["id"]: item for item in get_custom_agents()}
    result: list[dict[str, Any]] = []
    from .agents import AGENT_PIPELINE, SUB_AGENT_PIPELINE

    for meta in [*AGENT_PIPELINE, *SUB_AGENT_PIPELINE]:
        if meta["id"] in deleted:
            continue
        base = {
            **meta,
            "builtin": True,
            "disabled": meta["id"] in disabled,
            "sub_agent": bool(meta.get("sub_agent")),
        }
        custom = custom_by_id.get(meta["id"])
        if custom:
            for key in ("name", "description", "disabled"):
                if custom.get(key) not in (None, ""):
                    base[key] = custom[key]
            base["disabled"] = bool(custom.get("disabled")) if "disabled" in custom else base["disabled"]
        result.append(_apply_agent_profile(base, profiles))
    for custom in custom_by_id.values():
        if custom["id"] in AGENT_BY_ID or custom["id"] in deleted:
            continue
        result.append(_apply_agent_profile(custom, profiles))
    return result


def get_deleted_agent_ids() -> set[str]:
    data = load_config()
    raw = data.get("deleted_agents")
    if not isinstance(raw, list):
        return set()
    return {str(item).strip() for item in raw if str(item).strip()}


def get_disabled_agent_ids() -> set[str]:
    data = load_config()
    raw = data.get("disabled_agents")
    if not isinstance(raw, list):
        return set()
    return {str(item).strip() for item in raw if str(item).strip()}


def web_search_enabled() -> bool:
    """Web search is off while the web-searcher sub-agent is disabled.

    The tool list follows this: a disabled capability must not stay callable through
    `search_web`, and no agent prompt may advertise it.
    """
    return "web-searcher" not in get_disabled_agent_ids()


def set_agent_disabled(agent_id: str, disabled: bool) -> dict[str, Any]:
    if agent_id not in known_agent_ids():
        raise KeyError(f"Unknown agent: {agent_id}")
    data = load_config()
    if is_builtin_agent(agent_id):
        current = get_disabled_agent_ids()
        if disabled:
            current.add(agent_id)
        else:
            current.discard(agent_id)
        data["disabled_agents"] = sorted(current)
    else:
        custom = data.get("custom_agents")
        if not isinstance(custom, list):
            raise KeyError(f"Unknown agent: {agent_id}")
        found = False
        for entry in custom:
            if isinstance(entry, dict) and str(entry.get("id") or "").strip() == agent_id:
                entry["disabled"] = bool(disabled)
                found = True
                break
        if not found:
            raise KeyError(f"Unknown agent: {agent_id}")
        data["custom_agents"] = custom
    save_config(data)
    return get_agent_meta(agent_id)


def known_agent_ids() -> set[str]:
    from .agents import PHASE_AGENT_IDS

    ids = {meta["id"] for meta in get_all_agent_metas()}
    ids.update(PHASE_AGENT_IDS)
    return ids


def ordered_agent_ids() -> list[str]:
    """Known agent ids in a stable order: pipeline, sub-agents, then custom agents.

    Settings maps are written back to YAML in this order, so the same set of agents always
    produces the same file instead of reshuffling on every save.
    """
    ids: list[str] = []
    for meta in get_all_agent_metas():
        agent_id = str(meta.get("id") or "").strip()
        if agent_id and agent_id not in ids:
            ids.append(agent_id)
    return ids


def get_agent_meta(agent_id: str) -> dict[str, Any]:
    from .agents import PHASE_AGENT_BY_ID, resolve_agent_definition_id

    definition_id = resolve_agent_definition_id(agent_id)
    for meta in get_all_agent_metas():
        if meta["id"] == definition_id:
            return dict(meta)
    phase = PHASE_AGENT_BY_ID.get(definition_id)
    if phase:
        return {
            **phase,
            "builtin": True,
            "disabled": False,
            "phase": True,
        }
    raise KeyError(f"Unknown agent: {agent_id}")


def create_custom_agent(
    agent_id: str,
    name: str,
    description: str = "",
) -> dict[str, Any]:
    cleaned_id = (agent_id or "").strip()
    if not AGENT_ID_RE.match(cleaned_id):
        raise ValueError(
            "id must be lowercase letters, digits, underscores, or hyphens, starting with a letter"
        )
    data = load_config()
    deleted = get_deleted_agent_ids()
    if cleaned_id in deleted:
        deleted.discard(cleaned_id)
        data["deleted_agents"] = sorted(deleted)
        save_config(data)
        if is_builtin_agent(cleaned_id):
            return update_agent_fields(
                cleaned_id,
                name=name,
                description=description,
            )
    if cleaned_id in known_agent_ids():
        raise ValueError(f"Agent already exists: {cleaned_id}")
    cleaned_name = (name or "").strip()
    if not cleaned_name:
        raise ValueError("name must be a non-empty string")
    if len(cleaned_name) > 80:
        raise ValueError("name must be at most 80 characters")
    cleaned_description = (description or "").strip()
    if len(cleaned_description) > 500:
        raise ValueError("description must be at most 500 characters")

    data = load_config()
    custom = data.get("custom_agents")
    if not isinstance(custom, list):
        custom = []
    custom.append(
        {
            "id": cleaned_id,
            "name": cleaned_name,
            "description": cleaned_description,
        }
    )
    data["custom_agents"] = custom
    save_config(data)

    # Lazy import avoids circular import at module load
    from . import markdown_store as store

    store.ensure_dirs()
    skills_path = store.skills_dir() / cleaned_id
    skills_path.mkdir(parents=True, exist_ok=True)

    return {
        "id": cleaned_id,
        "name": cleaned_name,
        "description": cleaned_description,
        "builtin": False,
    }


def delete_custom_agent(agent_id: str) -> None:
    cleaned_id = (agent_id or "").strip()
    if cleaned_id not in known_agent_ids():
        raise KeyError(f"Unknown agent: {cleaned_id}")
    data = load_config()

    if is_builtin_agent(cleaned_id):
        deleted = get_deleted_agent_ids()
        deleted.add(cleaned_id)
        data["deleted_agents"] = sorted(deleted)
        disabled = get_disabled_agent_ids()
        disabled.discard(cleaned_id)
        data["disabled_agents"] = sorted(disabled)
    else:
        custom = data.get("custom_agents")
        if not isinstance(custom, list):
            raise KeyError(f"Unknown agent: {cleaned_id}")
        next_custom = [
            entry
            for entry in custom
            if isinstance(entry, dict) and str(entry.get("id") or "").strip() != cleaned_id
        ]
        if len(next_custom) == len(custom):
            raise KeyError(f"Unknown agent: {cleaned_id}")
        data["custom_agents"] = next_custom

    names = data.get("agent_names") if isinstance(data.get("agent_names"), dict) else {}
    if cleaned_id in names:
        names = dict(names)
        names.pop(cleaned_id, None)
        data["agent_names"] = names

    profiles = data.get("agent_profiles") if isinstance(data.get("agent_profiles"), dict) else {}
    if cleaned_id in profiles:
        profiles = dict(profiles)
        profiles.pop(cleaned_id, None)
        data["agent_profiles"] = profiles

    for section in ("openrouter",):
        section_data = data.get(section)
        if isinstance(section_data, dict) and isinstance(section_data.get("agents"), dict):
            agents = dict(section_data["agents"])
            agents.pop(cleaned_id, None)
            section_data = dict(section_data)
            section_data["agents"] = agents
            data[section] = section_data

    graph = data.get("pipeline_graph")
    if isinstance(graph, dict):
        nodes = [
            node
            for node in (graph.get("nodes") or [])
            if isinstance(node, dict) and str(node.get("id") or "").strip() != cleaned_id
        ]
        edges = [
            edge
            for edge in (graph.get("edges") or [])
            if isinstance(edge, dict)
            and str(edge.get("source") or "").strip() != cleaned_id
            and str(edge.get("target") or "").strip() != cleaned_id
        ]
        entry = str(graph.get("entry") or "").strip()
        if entry == cleaned_id:
            entry = str(nodes[0].get("id") or "").strip() if nodes else ""
        data["pipeline_graph"] = {"entry": entry or None, "nodes": nodes, "edges": edges}
        data["pipeline_flow"] = None

    save_config(data)

    from . import markdown_store as store

    store.save_assignments(store.load_assignments())
    store.save_skill_assignments(store.load_skill_assignments())


def get_agent_display_names() -> dict[str, str]:
    data = load_config()
    raw = data.get("agent_names") if isinstance(data.get("agent_names"), dict) else {}
    names: dict[str, str] = {}
    for meta in get_all_agent_metas():
        override = raw.get(meta["id"])
        names[meta["id"]] = (
            str(override).strip() if override and str(override).strip() else meta["name"]
        )
    return names


def update_agent_display_name(agent_id: str, name: str) -> dict[str, str]:
    if agent_id not in known_agent_ids():
        raise KeyError(f"Unknown agent: {agent_id}")
    cleaned = (name or "").strip()
    if not cleaned:
        raise ValueError("name must be a non-empty string")
    if len(cleaned) > 80:
        raise ValueError("name must be at most 80 characters")
    data = load_config()
    if not is_builtin_agent(agent_id):
        custom = data.get("custom_agents")
        if isinstance(custom, list):
            for entry in custom:
                if isinstance(entry, dict) and str(entry.get("id") or "").strip() == agent_id:
                    entry["name"] = cleaned
                    break
    names = data.get("agent_names") if isinstance(data.get("agent_names"), dict) else {}
    names[agent_id] = cleaned
    data["agent_names"] = names
    save_config(data)
    return get_agent_display_names()


def update_agent_fields(
    agent_id: str,
    *,
    name: str | None = None,
    description: str | None = None,
) -> dict[str, Any]:
    if agent_id not in known_agent_ids():
        raise KeyError(f"Unknown agent: {agent_id}")
    data = load_config()
    profiles = data.get("agent_profiles") if isinstance(data.get("agent_profiles"), dict) else {}
    profile = dict(profiles.get(agent_id) or {}) if isinstance(profiles.get(agent_id), dict) else {}

    if name is not None:
        update_agent_display_name(agent_id, name)
        data = load_config()
        profiles = data.get("agent_profiles") if isinstance(data.get("agent_profiles"), dict) else {}
        profile = dict(profiles.get(agent_id) or {}) if isinstance(profiles.get(agent_id), dict) else {}

    if description is not None:
        cleaned_description = str(description).strip()
        if len(cleaned_description) > 500:
            raise ValueError("description must be at most 500 characters")
        profile["description"] = cleaned_description

    if not is_builtin_agent(agent_id):
        custom = data.get("custom_agents")
        if isinstance(custom, list):
            for entry in custom:
                if isinstance(entry, dict) and str(entry.get("id") or "").strip() == agent_id:
                    if "description" in profile:
                        entry["description"] = profile["description"]
                    break
        data["custom_agents"] = custom

    if profile:
        profiles[agent_id] = profile
        data["agent_profiles"] = profiles
    save_config(data)
    return get_agent_meta(agent_id)


def agent_company_label(agent_id: str) -> str:
    from .agents import resolve_agent_definition_id

    definition_id = resolve_agent_definition_id(agent_id)
    try:
        meta = get_agent_meta(definition_id)
    except KeyError:
        return agent_id
    names = get_agent_display_names()
    role = names.get(definition_id, meta.get("name") or definition_id)
    return str(role or agent_id).strip()


def get_sql_settings() -> dict[str, Any]:
    data = load_config()
    raw = data.get("sql")
    if not isinstance(raw, dict):
        raw = data.get("sql_guardian") if isinstance(data.get("sql_guardian"), dict) else {}
    merged = {**DEFAULT_SQL, **raw}
    try:
        merged["max_retries"] = max(1, int(merged.get("max_retries") or 3))
    except (TypeError, ValueError):
        merged["max_retries"] = 3
    try:
        merged["max_rows"] = max(1, int(merged.get("max_rows") or 10000))
    except (TypeError, ValueError):
        merged["max_rows"] = 10000
    merged["require_row_limit"] = bool(merged.get("require_row_limit", False))
    merged["enforce_allowlist"] = bool(merged.get("enforce_allowlist", False))
    merged["forbid_select_star"] = bool(merged.get("forbid_select_star", True))
    return merged


def get_active_provider_settings() -> dict[str, Any]:
    """The active connector plus the catalog the Settings form builds its pickers from."""
    provider = get_provider()
    return {
        "provider": provider,
        "connectors": get_connectors(),
        "settings": get_openrouter_settings(),
    }


def get_agent_model(agent_id: str) -> str:
    from .agents import PHASE_AGENT_BY_ID, resolve_agent_definition_id

    lookup_id = resolve_agent_definition_id(agent_id)
    if lookup_id in PHASE_AGENT_BY_ID:
        lookup_id = "orchester"
    settings = get_active_provider_settings()["settings"]
    agents = settings.get("agents") if isinstance(settings.get("agents"), dict) else {}
    entry = agents.get(lookup_id) or agents.get(agent_id)
    if isinstance(entry, dict):
        model = str(entry.get("model") or "").strip()
        if model and model != "auto":
            return model
    default = str(settings.get("default_model") or "").strip()
    if default and default != "auto":
        return default
    return DEFAULT_LLM_MODEL
