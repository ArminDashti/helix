"""Canonical agent pipeline metadata."""

AGENT_PIPELINE = [
    {
        "id": "guardian",
        "name": "guardian",
        "description": "Block dangerous prompts and check the caller's permission",
    },
    {
        "id": "data-gatherer",
        "name": "data-gatherer",
        "description": "Write a cheap SELECT from catalog and references, then fetch rows",
    },
    {
        "id": "researcher",
        "name": "researcher",
        "description": "Tiered gather and validate passes for research mode, then aggregate for result-builder",
    },
    {
        "id": "validator",
        "name": "validator",
        "description": "Check gathered or built results against the user prompt",
    },
    {
        "id": "result-builder",
        "name": "result-builder",
        "description": "Build report text from fetched rows",
    },
    {
        "id": "publisher",
        "name": "publisher",
        "description": "Package report, grid, and chart for the UI",
    },
]

AGENT_IDS = [a["id"] for a in AGENT_PIPELINE]
AGENT_BY_ID = {a["id"]: a for a in AGENT_PIPELINE}

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
SYNC_AGENT_IDS = AGENT_IDS + SUB_AGENT_IDS
ALL_BUILTIN_AGENT_BY_ID = {**AGENT_BY_ID, **SUB_AGENT_BY_ID}

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
    "task_validator": "guardian",
    "sql": "data-gatherer",
    "sql_fetcher": "data-gatherer",
    "sql_guardian": "data-gatherer",
    "response_builder": "result-builder",
    "response_publisher": "result-builder",
    "implementation_auditor": "validator",
}


def resolve_agent_definition_id(agent_id: str) -> str:
    """Map graph instance id (e.g. validator__2) to roster agent id."""
    if "__" in agent_id:
        base = agent_id.rsplit("__", 1)[0]
        if base in AGENT_BY_ID or base in LEGACY_AGENT_RENAMES:
            return LEGACY_AGENT_RENAMES.get(base, base)
    return LEGACY_AGENT_RENAMES.get(agent_id, agent_id)


def is_builtin_agent(agent_id: str) -> bool:
    return resolve_agent_definition_id(agent_id) in ALL_BUILTIN_AGENT_BY_ID


def is_sub_agent(agent_id: str) -> bool:
    return resolve_agent_definition_id(agent_id) in SUB_AGENT_BY_ID


def is_pipeline_agent(agent_id: str) -> bool:
    return resolve_agent_definition_id(agent_id) in AGENT_BY_ID
