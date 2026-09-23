"""Canonical agent pipeline metadata."""

AGENT_PIPELINE = [
    {
        "id": "orchester",
        "name": "Orchester",
        "description": "Supervise the pipeline: route work, read agent inbox, package SSE for the UI",
    },
    {
        "id": "guardian",
        "name": "guardian",
        "description": "Block dangerous or off-product prompts and check the caller's permission",
    },
    {
        "id": "researcher",
        "name": "researcher",
        "description": "Connect to the live catalog, run SELECT gathers, optional web search",
    },
    {
        "id": "final-approver",
        "name": "final-approver",
        "description": "Validate research/data, write the report text, hand the package to orchester",
    },
]

AGENT_IDS = [a["id"] for a in AGENT_PIPELINE]
AGENT_BY_ID = {a["id"]: a for a in AGENT_PIPELINE}

# No separate phase-only roster — the four pipeline agents are the runtime graph.
PHASE_AGENT_PIPELINE: list[dict] = []
PHASE_AGENT_IDS: list[str] = []
PHASE_AGENT_BY_ID: dict[str, dict] = {}

# Sub-agents: registered for prompts/models/admin, but not pipeline graph steps.
SUB_AGENT_PIPELINE = [
    {
        "id": "web-searcher",
        "name": "web-searcher",
        "description": "Search the public web when researcher requests external context (sub-agent only)",
        "sub_agent": True,
    },
]

SUB_AGENT_IDS = [a["id"] for a in SUB_AGENT_PIPELINE]
SUB_AGENT_BY_ID = {a["id"]: a for a in SUB_AGENT_PIPELINE}

# Seed markdown for pipeline agents and web-searcher.
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
        "data-gatherer",
        "validator",
        "result-builder",
        "publisher",
    }
)

LEGACY_AGENT_RENAMES = {
    "task_validator": "orchester",
    "solution_strategist": "orchester",
    "technical_architect": "orchester",
    "code_builder": "orchester",
    "sql": "orchester",
    "sql_fetcher": "researcher",
    "sql_guardian": "guardian",
    "response_builder": "final-approver",
    "response_publisher": "final-approver",
    "implementation_auditor": "orchester",
    "data-gatherer": "researcher",
    "validator": "final-approver",
    "result-builder": "final-approver",
    "publisher": "final-approver",
}

_RUNTIME_PIPELINE_AGENT_IDS = frozenset(AGENT_IDS)


def resolve_agent_definition_id(agent_id: str) -> str:
    """Map graph instance id (e.g. guardian__2) to roster agent id."""
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
    """Kept for callers; phase-only roster is empty — always False."""
    return False


def is_pipeline_agent(agent_id: str) -> bool:
    """True for graph-eligible agents (orchester, guardian, researcher, final-approver)."""
    rid = resolve_agent_definition_id(agent_id)
    return rid in AGENT_BY_ID
