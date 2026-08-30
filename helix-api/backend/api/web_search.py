"""Public web search for the web-searcher sub-agent (no warehouse connection)."""

from __future__ import annotations

import html
import re
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

USER_AGENT = "Helix/1.0 (web-searcher sub-agent)"
MAX_QUERIES = 3
MAX_RESULTS_PER_QUERY = 5
SEARCH_TIMEOUT_SECONDS = 20

_RESULT_RE = re.compile(
    r'<a[^>]+class="result__a"[^>]+href="(?P<url>[^"]+)"[^>]*>(?P<title>.*?)</a>'
    r'.*?class="result__snippet"[^>]*>(?P<snippet>.*?)</',
    re.IGNORECASE | re.DOTALL,
)
_TAG_RE = re.compile(r"<[^>]+>")


def _strip_tags(text: str) -> str:
    cleaned = _TAG_RE.sub("", text or "")
    return html.unescape(cleaned).strip()


def _ddg_search(query: str, *, max_results: int) -> list[dict[str, str]]:
    query = (query or "").strip()
    if not query:
        return []
    body = urllib.parse.urlencode({"q": query, "b": "", "kl": "wt-wt"}).encode("utf-8")
    request = urllib.request.Request(
        "https://html.duckduckgo.com/html/",
        data=body,
        headers={
            "User-Agent": USER_AGENT,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=SEARCH_TIMEOUT_SECONDS) as response:
            page = response.read().decode("utf-8", errors="replace")
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        return [{"query": query, "error": str(exc)}]

    results: list[dict[str, str]] = []
    for match in _RESULT_RE.finditer(page):
        url = html.unescape(match.group("url") or "").strip()
        if not url or url.startswith("//duckduckgo.com"):
            continue
        results.append(
            {
                "query": query,
                "title": _strip_tags(match.group("title") or ""),
                "url": url,
                "snippet": _strip_tags(match.group("snippet") or ""),
            }
        )
        if len(results) >= max_results:
            break
    if not results:
        results.append(
            {
                "query": query,
                "title": "",
                "url": "",
                "snippet": "No web results returned for this query.",
            }
        )
    return results


def search_web(
    queries: list[str],
    *,
    max_results_per_query: int = MAX_RESULTS_PER_QUERY,
) -> list[dict[str, Any]]:
    """Run up to MAX_QUERIES distinct searches and return flat result rows."""
    seen: set[str] = set()
    flat: list[dict[str, Any]] = []
    for raw in queries[:MAX_QUERIES]:
        query = str(raw or "").strip()
        if not query:
            continue
        key = query.lower()
        if key in seen:
            continue
        seen.add(key)
        cap = max(1, min(int(max_results_per_query), MAX_RESULTS_PER_QUERY))
        flat.extend(_ddg_search(query, max_results=cap))
    return flat
