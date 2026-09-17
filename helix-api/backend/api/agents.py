"""Canonical agent pipeline metadata."""

AGENT_PIPELINE = [
    {
        "id": "orchester",
        "name": "Orchester",
        "description": "Guard prompts, gather warehouse data, research when needed, build and package analysis results",
    },
]

AGENT_IDS = [a["id"] for a in AGENT_PIPELINE]
AGENT_BY_ID = {a["id"]: a for a in AGENT_PIPELINE}

# Internal phase agents: prompts/skills only — not graph nodes or Agents UI roster.
PHASE_AGENT_PIPELINE = [
    {
        "id": "guardian",
        "name": "guardian",
        "description": "Block dangerous prompts and check the caller's permission",
        "phase": True,
    },
    {
        "id": "data-gatherer",
        "name": "data-gatherer",
        "description": "Write a cheap SELECT from catalog and references, then fetch rows",
        "phase": True,
    },
    {
        "id": "researcher",
        "name": "researcher",
        "description": "Tiered gather and validate passes for research mode",
        "phase": True,
    },
    {
        "id": "validator",
        "name": "validator",
        "description": "Check gathered or built results against the user prompt",
        "phase": True,
    },
    {
        "id": "result-builder",
        "name": "result-builder",
        "description": "Build report text from fetched rows",
        "phase": True,
    },
    {
        "id": "publisher",
        "name": "publisher",
        "description": "Package report, grid, and chart for the UI",
        "phase": True,
    },
]

PHASE_AGENT_IDS = [a["id"] for a in PHASE_AGENT_PIPELINE]
PHASE_AGENT_BY_ID = {a["id"]: a for a in PHASE_AGENT_PIPELINE}

# Sub-agents: registered for prompts/models/admin, but not pipeline graph steps.
SUB_AGENT_PIPELINE = [
    {
        "id": "web-searcher",
        "name": "web-searcher",
        "description": "Search the public web when another agent requests external context (sub-agent only)",
        "sub_agent": True,
    },
]

SUB_AGENT_IDS = [a["id"] for a in SUB_AGENT_PIPELINE]
SUB_AGENT_BY_ID = {a["id"]: a for a in SUB_AGENT_PIPELINE}
# Seed markdown for Orchester, phase prompts, and web-searcher.
SYNC_AGENT_IDS = AGENT_IDS + PHASE_AGENT_IDS + SUB_AGENT_IDS
ALL_BUILTIN_AGENT_BY_ID = {**AGENT_BY_ID, **PHASE_AGENT_BY_ID, **SUB_AGENT_BY_ID}

LEGACY_AGENT_IDS = frozenset(
    {
        "task_validator",
        "solution_strategist",
        "technical_architect",
        "code_builder",
        "sql",
        "sql_fetcher",
        "sql_guardian",
        "response_builder",
        "response_publisher",
        "implementation_auditor",
    }
)

LEGACY_AGENT_RENAMES = {
    "task_validator": "orchester",
    "solution_strategist": "orchester",
    "technical_architect": "orchester",
    "code_builder": "orchester",
    "sql": "orchester",
    "sql_fetcher": "orchester",
    "sql_guardian": "orchester",
    "response_builder": "orchester",
    "response_publisher": "orchester",
    "implementation_auditor": "orchester",
    "guardian": "orchester",
    "data-gatherer": "orchester",
    "researcher": "orchester",
    "validator": "orchester",
    "result-builder": "orchester",
    "publisher": "orchester",
}

# Phase ids used by _run_orchester when calling _run_agent internally.
_RUNTIME_PIPELINE_AGENT_IDS = frozenset(PHASE_AGENT_IDS)


def resolve_agent_definition_id(agent_id: str) -> str:
    """Map graph instance id (e.g. validator__2) to roster/phase agent id."""
    if "__" in agent_id:
        base = agent_id.rsplit("__", 1)[0]
        if base in _RUNTIME_PIPELINE_AGENT_IDS:
            return base
        if base in AGENT_BY_ID or base in LEGACY_AGENT_RENAMES:
            return LEGACY_AGENT_RENAMES.get(base, base)
    if agent_id in _RUNTIME_PIPELINE_AGENT_IDS:
        return agent_id
    return LEGACY_AGENT_RENAMES.get(agent_id, agent_id)


def is_builtin_agent(agent_id: str) -> bool:
    return resolve_agent_definition_id(agent_id) in ALL_BUILTIN_AGENT_BY_ID


def is_sub_agent(agent_id: str) -> bool:
    return resolve_agent_definition_id(agent_id) in SUB_AGENT_BY_ID


def is_phase_agent(agent_id: str) -> bool:
    return resolve_agent_definition_id(agent_id) in PHASE_AGENT_BY_ID


def is_pipeline_agent(agent_id: str) -> bool:
    """True for graph-eligible agents (Orchester only)."""
    rid = resolve_agent_definition_id(agent_id)
    return rid in AGENT_BY_ID
