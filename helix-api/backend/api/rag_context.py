"""Lexical retrieval over the RAG knowledge store (``markdown-files/rag/``).

This build has no embedding provider, so retrieval is lexical rather than vector-based: prompt
terms are matched against each document's title and body, the best-scoring documents are packed
into a token budget, and the result is injected into the researcher's prompt. No match is a normal
outcome — the researcher then runs on its rules, skills, and the live catalog alone, and the run
reports 0 RAG tokens.
"""

from __future__ import annotations

import re
from typing import Any

from .token_usage import estimate_tokens

# Context budget for one run. Keeps a large knowledge base from crowding out the tool budget.
MAX_CONTEXT_TOKENS = 1500
MAX_DOCS = 5

# A term must be at least this long to be worth matching ("of", "by", "به" are noise).
MIN_TERM_LENGTH = 3

# One term repeated all over a long document must not outrank a focused document.
MAX_TERM_HITS = 3

# Title matches are a stronger signal of relevance than body matches.
TITLE_WEIGHT = 3
BODY_WEIGHT = 1

_WORD_RE = re.compile(r"[^\W_]+", re.UNICODE)

_STOPWORDS = frozenset(
    """
    and are for from how into its not that the their them then there these this those was
    were what when where which while with you your about all any can did does has have please
    """.split()
    + """
    است این آن برای از با که در به را می‌شود شود یک های ها هر چه کدام کدامین نمایش لطفا
    """.split()
)


def prompt_terms(prompt: str) -> list[str]:
    """Lowercased content words of a prompt, deduplicated in first-seen order."""
    terms: list[str] = []
    seen: set[str] = set()
    for raw in _WORD_RE.findall((prompt or "").lower()):
        if len(raw) < MIN_TERM_LENGTH or raw in _STOPWORDS or raw in seen:
            continue
        seen.add(raw)
        terms.append(raw)
    return terms


def _hits(haystack: str, term: str) -> int:
    if not haystack or not term:
        return 0
    return min(haystack.count(term), MAX_TERM_HITS)


def score_doc(doc: dict[str, Any], terms: list[str]) -> int:
    """Relevance score of one knowledge document for the given prompt terms."""
    title = str(doc.get("title") or "").lower()
    body = str(doc.get("content") or "").lower()
    score = 0
    for term in terms:
        score += TITLE_WEIGHT * _hits(title, term)
        score += BODY_WEIGHT * _hits(body, term)
    return score


_INTRO = (
    "## Retrieved knowledge\n"
    "Company notes retrieved for this question. Use them when they fit; the live catalog "
    "still wins on structure and column names.\n\n"
)


def _entry(doc: dict[str, Any]) -> str:
    title = str(doc.get("title") or doc.get("id") or "").strip()
    content = str(doc.get("content") or "").strip()
    return f"### {title}\n{content}".strip()


def _fit(entry: str, budget_tokens: int) -> tuple[str, int]:
    """Trim one entry so it fits ``budget_tokens``, keeping the head of the document.

    The budget is a contract, not a suggestion: a document larger than what is left is cut rather
    than let through in full, so a run's retrieval cost stays bounded however large the store is.
    """
    if budget_tokens <= 0:
        return "", 0
    tokens = estimate_tokens(entry)
    if tokens <= budget_tokens:
        return entry, tokens
    trimmed = entry
    # Estimate from this text's own characters-per-token ratio, then shrink until it really fits.
    ratio = max(1.0, len(entry) / max(1, tokens))
    cut = max(1, int(budget_tokens * ratio * 0.98))
    trimmed = entry[:cut].rstrip()
    while trimmed and estimate_tokens(trimmed) > budget_tokens:
        trimmed = trimmed[: int(len(trimmed) * 0.9)].rstrip()
    if not trimmed:
        return "", 0
    if len(trimmed) < len(entry):
        trimmed += "…"
    return trimmed, estimate_tokens(trimmed)


def select_rag_context(
    prompt: str,
    *,
    budget_tokens: int = MAX_CONTEXT_TOKENS,
    max_docs: int = MAX_DOCS,
) -> dict[str, Any]:
    """Pack the knowledge documents that match ``prompt`` into a token budget.

    Returns the prompt block plus the stats the UI reports (documents used, tokens spent,
    budget, and how many documents the store holds). An empty ``text`` means nothing matched.
    """
    from . import markdown_store as store

    try:
        docs = store.list_rag_docs()
    except Exception:  # noqa: BLE001 - a knowledge-base read must never fail a run
        docs = []

    stats: dict[str, Any] = {
        "docs": [],
        "tokens": 0,
        "budget_tokens": max(0, int(budget_tokens)),
        "available_docs": len(docs),
    }
    terms = prompt_terms(prompt)
    if not docs or not terms:
        return {"text": "", **stats}

    ranked = [(score_doc(doc, terms), doc) for doc in docs]
    ranked = [(score, doc) for score, doc in ranked if score > 0]
    if not ranked:
        return {"text": "", **stats}
    ranked.sort(key=lambda item: (-item[0], str(item[1].get("title") or "")))

    entries: list[str] = []
    used_ids: list[str] = []
    used_tokens = 0
    budget = stats["budget_tokens"]
    # The intro line is part of what the run pays for, so it comes out of the budget first.
    intro_tokens = estimate_tokens(_INTRO)
    if budget <= intro_tokens:
        return {"text": "", **stats}
    for _score, doc in ranked:
        if len(entries) >= max(0, int(max_docs)):
            break
        if used_tokens >= budget - intro_tokens:
            break
        entry, entry_tokens = _fit(_entry(doc), budget - intro_tokens - used_tokens)
        if not entry:
            continue
        entries.append(entry)
        used_ids.append(str(doc.get("id") or ""))
        used_tokens += entry_tokens

    if not entries:
        return {"text": "", **stats}

    text = _INTRO + "\n\n".join(entries)
    return {
        "text": text,
        **stats,
        "docs": used_ids,
        "tokens": min(estimate_tokens(text), budget),
    }
