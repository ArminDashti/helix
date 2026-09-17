/**
 * API helpers. In dev, Vite proxies /api → Django :8000.
 * Absolute VITE_API_BASE_URL still supported when set.
 */

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

const errorListeners = new Set();

export function subscribeApiErrors(listener) {
  errorListeners.add(listener);
  return () => errorListeners.delete(listener);
}

function emitApiError(err) {
  for (const listener of errorListeners) {
    try {
      listener(err);
    } catch {
      /* ignore subscriber errors */
    }
  }
}

export class ApiError extends Error {
  /**
   * @param {{ kind: string, title: string, message: string, status?: number, detail?: string, path?: string, reasons?: string }} opts
   */
  constructor({ kind, title, message, status, detail, path, reasons }) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.title = title;
    this.status = status ?? null;
    this.detail = detail || "";
    this.path = path || "";
    this.reasons = reasons || "";
  }
}

const GUARDIAN_AGENT_IDS = new Set(["guardian", "task_validator"]);

function isStreamRejection(payload) {
  if (!payload || typeof payload !== "object") return false;
  if (payload.kind === "rejection") return true;
  const agentId = String(payload.agent_id || "").trim();
  return GUARDIAN_AGENT_IDS.has(agentId);
}

function apiUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (API_BASE) return `${API_BASE}${p}`;
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  if (!base || base === "/") return p;
  return `${base}${p}`;
}

function httpTitle(status) {
  if (status === 400) return "Request rejected";
  if (status === 401 || status === 403) return "Not authorized";
  if (status === 404) return "Not found";
  if (status === 502 || status === 503) return "Upstream provider error";
  if (status >= 500) return "Server error";
  return "API error";
}

function toApiError(err, path) {
  if (err instanceof ApiError) return err;
  return new ApiError({
    kind: "network",
    title: "Cannot reach helix-api",
    message: "API host unreachable — is the server running?",
    detail: err instanceof Error ? err.message : String(err || "Failed to fetch"),
    path,
  });
}

/**
 * @param {string} path
 * @param {RequestInit & { silent?: boolean }} [options]
 */
async function apiFetch(path, options = {}) {
  const { silent = false, ...fetchOpts } = options;
  const url = apiUrl(path);
  let response;
  try {
    response = await fetch(url, fetchOpts);
  } catch (err) {
    const apiErr = toApiError(err, path);
    if (!silent) emitApiError(apiErr);
    throw apiErr;
  }
  return response;
}

async function parseJson(response, path, { silent = false } = {}) {
  const text = await response.text();
  let data = null;
  if (text) {
    const trimmed = text.trim();
    const looksLikeHtml =
      trimmed.startsWith("<!DOCTYPE") ||
      trimmed.startsWith("<html") ||
      trimmed.startsWith("<HTML") ||
      /<head>[\s\S]*<title>\s*404/i.test(trimmed);
    if (looksLikeHtml) {
      const serverError = response.status >= 500;
      const apiErr = new ApiError({
        kind: "parse",
        status: response.status,
        title: serverError ? "Server error" : "API misconfigured",
        message: serverError
          ? "The API timed out or crashed — try again or check helix-api logs."
          : "Got HTML instead of JSON — check the API proxy or base URL.",
        detail: `HTTP ${response.status}`,
        path,
      });
      if (!silent) emitApiError(apiErr);
      throw apiErr;
    }
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }
  if (!response.ok) {
    const serverMsg =
      (data && typeof data.error === "string" && data.error) ||
      `API error ${response.status}`;
    const kind =
      response.status === 502 || response.status === 503 ? "server" : "http";
    const apiErr = new ApiError({
      kind,
      status: response.status,
      title: httpTitle(response.status),
      message: serverMsg,
      detail: `HTTP ${response.status}`,
      path,
    });
    if (!silent) emitApiError(apiErr);
    throw apiErr;
  }
  return data;
}

async function requestJson(path, options = {}) {
  const { silent = false, ...fetchOpts } = options;
  const response = await apiFetch(path, { ...fetchOpts, silent });
  return parseJson(response, path, { silent });
}

export async function fetchHealth({ silent = false } = {}) {
  return requestJson("/api/health/", { silent });
}

export async function fetchAgents() {
  const data = await requestJson("/api/agents/");
  return data.agents;
}

export async function createAgent({
  id,
  name,
  description = "",
}) {
  return requestJson("/api/agents/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, name, description }),
  });
}

export async function deleteAgent(agentId) {
  return requestJson(`/api/agents/${encodeURIComponent(agentId)}/`, {
    method: "DELETE",
  });
}

export async function renameAgent(agentId, name) {
  return requestJson(`/api/agents/${encodeURIComponent(agentId)}/`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

export async function updateAgent(agentId, payload) {
  return requestJson(`/api/agents/${encodeURIComponent(agentId)}/`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function setAgentDisabled(agentId, disabled) {
  return requestJson(`/api/agents/${encodeURIComponent(agentId)}/`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ disabled }),
  });
}

export async function fetchReferences() {
  const data = await requestJson("/api/references/");
  return data.references;
}

export async function createReference(name, content = "") {
  return requestJson("/api/references/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, content }),
  });
}

export async function updateReference(name, content) {
  return requestJson(`/api/references/${encodeURIComponent(name)}/`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}

export async function deleteReference(name) {
  const path = `/api/references/${encodeURIComponent(name)}/`;
  const res = await apiFetch(path, { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    await parseJson(res, path);
  }
}

export async function fetchRules() {
  const data = await requestJson("/api/rules/");
  return data.rules;
}

export async function createRule(id, { content = "", agents = [], name = "", disabled = false } = {}) {
  return requestJson("/api/rules/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, content, agents, name, disabled }),
  });
}

export async function updateRule(id, { content, agents, name, disabled }) {
  return requestJson(`/api/rules/${encodeURIComponent(id)}/`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, agents, name, disabled }),
  });
}

export async function renameRule(id, newId) {
  return requestJson(`/api/rules/${encodeURIComponent(id)}/rename/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ new_id: newId }),
  });
}

export async function deleteRule(id) {
  const path = `/api/rules/${encodeURIComponent(id)}/`;
  const res = await apiFetch(path, { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    await parseJson(res, path);
  }
}

export async function fetchSkills(scope) {
  const qs = scope ? `?scope=${encodeURIComponent(scope)}` : "";
  const data = await requestJson(`/api/skills/${qs}`);
  return data.skills;
}

export async function createSkill({
  id,
  scope,
  content = "",
  agents = [],
  name = "",
  disabled = false,
}) {
  return requestJson("/api/skills/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, scope, content, agents, name, disabled }),
  });
}

export async function updateSkill(scope, id, { content, agents, name, disabled }) {
  return requestJson(
    `/api/skills/${encodeURIComponent(scope)}/${encodeURIComponent(id)}/`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, agents, name, disabled }),
    },
  );
}

export async function renameSkill(scope, id, newId) {
  return requestJson(
    `/api/skills/${encodeURIComponent(scope)}/${encodeURIComponent(id)}/rename/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ new_id: newId }),
    },
  );
}

export async function deleteSkill(scope, id) {
  const path = `/api/skills/${encodeURIComponent(scope)}/${encodeURIComponent(id)}/`;
  const res = await apiFetch(path, { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    await parseJson(res, path);
  }
}

export async function saveRuleAssignments(assignments) {
  return requestJson("/api/rules/assignments/", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assignments }),
  });
}

export async function fetchSkillAssignments() {
  const data = await requestJson("/api/skills/assignments/");
  return data.assignments;
}

export async function saveSkillAssignments(assignments) {
  return requestJson("/api/skills/assignments/", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assignments }),
  });
}

export async function fetchDatabaseSettings() {
  return requestJson("/api/admin/database/");
}

export async function saveDatabaseSettings(database) {
  return requestJson("/api/admin/database/", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ database }),
  });
}

export async function fetchSampleTiers() {
  const data = await requestJson("/api/sample-tiers/");
  return data.tiers || [];
}

export async function ensureSampleTier(tierId, { force = false } = {}) {
  return requestJson(`/api/sample-tiers/${encodeURIComponent(tierId)}/ensure/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ force }),
  });
}

export async function fetchProviderSettings() {
  return requestJson("/api/admin/provider/");
}

export async function saveProvider(provider) {
  return requestJson("/api/admin/provider/", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider }),
  });
}

export async function fetchBranding() {
  return requestJson("/api/admin/branding/");
}

export async function saveBranding(payload) {
  return requestJson("/api/admin/branding/", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ branding: payload }),
  });
}

export async function fetchUsers() {
  const data = await requestJson("/api/admin/users/");
  return data.users;
}

export async function createUser(payload) {
  return requestJson("/api/admin/users/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateUser(userId, payload) {
  return requestJson(`/api/admin/users/${encodeURIComponent(userId)}/`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deleteUser(userId) {
  return requestJson(`/api/admin/users/${encodeURIComponent(userId)}/`, {
    method: "DELETE",
  });
}

export async function fetchOpenRouterSettings() {
  return requestJson("/api/admin/openrouter/");
}

export async function saveOpenRouterSettings(openrouter) {
  return requestJson("/api/admin/openrouter/", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ openrouter }),
  });
}

export async function fetchOpenRouterModels({ force = false, silent = false } = {}) {
  const qs = force ? "?force=1" : "";
  return requestJson(`/api/admin/openrouter/models/${qs}`, { silent });
}

export async function fetchPipelineBundle() {
  return requestJson("/api/admin/pipeline-graph/");
}

export async function fetchPipelineGraph() {
  const data = await fetchPipelineBundle();
  return data.pipeline_graph;
}

export async function savePipelineBundle(payload) {
  return requestJson("/api/admin/pipeline-graph/", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function savePipelineGraph(pipeline_graph) {
  const data = await savePipelineBundle({ pipeline_graph });
  return data.pipeline_graph;
}

export async function resetPipelineBundle() {
  return requestJson("/api/admin/pipeline-graph/", {
    method: "DELETE",
  });
}

export async function resetPipelineGraph() {
  const data = await resetPipelineBundle();
  return data.pipeline_graph;
}

export async function fetchDocsTables() {
  return requestJson("/api/docs/tables/");
}

export async function fetchDocsTable(table) {
  return requestJson(`/api/docs/tables/${encodeURIComponent(table)}/`);
}

export async function saveDocsTableOverview(table, overview) {
  return requestJson(`/api/docs/tables/${encodeURIComponent(table)}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ overview }),
  });
}

export async function saveDocsColumn(
  table,
  { column, description = "", sql_description = "" },
) {
  return requestJson(`/api/docs/tables/${encodeURIComponent(table)}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ column, description, sql_description }),
  });
}

export async function fetchResults() {
  const data = await requestJson("/api/results/");
  return data.results || [];
}

export async function fetchResult(resultId) {
  return requestJson(`/api/results/${encodeURIComponent(resultId)}/`);
}

export async function createResult(payload) {
  return requestJson("/api/results/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function setResultArchived(resultId, archived) {
  return requestJson(`/api/results/${encodeURIComponent(resultId)}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ archived }),
  });
}

export async function deleteResult(resultId) {
  const path = `/api/results/${encodeURIComponent(resultId)}/`;
  const res = await apiFetch(path, { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    await parseJson(res, path);
  }
}

export async function fetchLogs() {
  const data = await requestJson("/api/logs/");
  return data.logs || [];
}

export async function fetchLog(logId) {
  return requestJson(`/api/logs/${encodeURIComponent(logId)}/`);
}

export async function deleteLog(logId) {
  const path = `/api/logs/${encodeURIComponent(logId)}/`;
  const res = await apiFetch(path, { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    await parseJson(res, path);
  }
}

/**
 * Persist a client-side failure (network drop, stream timeout) to helix-api logs.
 * Uses silent fetch so a logging failure does not mask the original error.
 */
export async function reportLogError(
  {
    message,
    kind = "api",
    prompt = "",
    mode = "",
    language = "en",
    path = "",
    status_code = null,
    agent_id = "",
    node_id = "",
    sql = "",
    run_id = "",
    detail = "",
    duration_s = null,
    steps = [],
    report_type = "",
    chart_type = "",
  },
  { silent = true } = {},
) {
  const trimmed = String(message || "").trim();
  if (!trimmed) return null;
  const body = {
    kind,
    message: trimmed,
    prompt,
    mode,
    language,
    path,
    status_code,
  };
  if (agent_id) body.agent_id = agent_id;
  if (node_id) body.node_id = node_id;
  if (sql) body.sql = sql;
  if (run_id) body.run_id = run_id;
  if (detail) body.detail = detail;
  if (duration_s != null && Number.isFinite(duration_s)) {
    body.duration_s = Math.round(duration_s * 100) / 100;
  }
  if (Array.isArray(steps) && steps.length) body.steps = steps;
  if (report_type) body.report_type = report_type;
  if (chart_type) body.chart_type = chart_type;
  try {
    return await requestJson("/api/logs/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      silent,
    });
  } catch {
    return null;
  }
}

function streamFailureMessage(err, fallback = "Run failed") {
  if (err instanceof ApiError) {
    const parts = [err.message];
    if (err.detail && err.detail !== err.message) parts.push(err.detail);
    return parts.filter(Boolean).join(" — ");
  }
  if (err instanceof Error) return err.message || fallback;
  return String(err || fallback);
}

async function reportStreamFailure(err, path, context = {}) {
  const message = streamFailureMessage(err);
  const kind = err instanceof ApiError ? err.kind === "network" ? "api" : err.kind : "api";
  await reportLogError({
    message,
    kind,
    prompt: context.prompt || "",
    mode: context.mode || "",
    language: context.language || "en",
    path,
    status_code: err instanceof ApiError ? err.status : null,
    agent_id: context.agent_id || "",
    node_id: context.node_id || "",
    sql: context.sql || "",
    run_id: context.run_id || "",
    detail: context.detail || "",
    duration_s: context.duration_s ?? null,
    steps: context.steps || [],
    report_type: context.report_type || "",
    chart_type: context.chart_type || "",
  });
}

function trackStreamEvent(logContext, payload) {
  if (!payload || typeof payload !== "object") return;
  if (payload.run_id) logContext.run_id = payload.run_id;
  if (payload.event === "step") {
    logContext.steps.push({
      agent_id: payload.agent_id || "",
      node_id: payload.node_id || "",
      status: payload.status || "",
      message: payload.message || "",
    });
    if (logContext.steps.length > 30) {
      logContext.steps = logContext.steps.slice(-30);
    }
    if (payload.node_id) logContext.node_id = payload.node_id;
    if (payload.agent_id && payload.agent_id !== "user") {
      logContext.agent_id = payload.agent_id;
    }
  }
}

export async function fetchDbExplorerTables() {
  return requestJson("/api/db-explorer/tables/");
}

export async function fetchDbExplorerColumns(table) {
  const qs = `?table=${encodeURIComponent(table)}`;
  return requestJson(`/api/db-explorer/columns/${qs}`);
}

export async function runDbExplorerQuery(payload) {
  return requestJson("/api/db-explorer/query/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/**
 * Stream a run via SSE (POST). Calls onEvent for each parsed JSON payload.
 * @returns {Promise<{mode: string, text_report: string|null, echarts_option: object|null, grid?: object|null, used_demo?: boolean}>}
 */
export async function streamRun(
  {
    prompt,
    mode,
    language = "en",
    report_type,
    chart_type,
    chart_types,
    columns,
  },
  onEvent,
  signal,
) {
  const path = "/api/runs/stream";
  const body = { prompt, mode, language };
  if (report_type) body.report_type = report_type;
  if (chart_type) body.chart_type = chart_type;
  if (chart_types?.length) body.chart_types = chart_types;
  if (columns?.length) body.columns = columns;
  const logContext = {
    prompt,
    mode,
    language,
    report_type: report_type || "",
    chart_type: chart_type || "",
    steps: [],
  };
  const streamStartedAt = performance.now();

  let response;
  try {
    response = await apiFetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    const apiErr = toApiError(err, path);
    logContext.duration_s = (performance.now() - streamStartedAt) / 1000;
    await reportStreamFailure(apiErr, path, logContext);
    throw apiErr;
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let message = text;
    try {
      message = JSON.parse(text)?.error || text;
    } catch {
      /* keep text */
    }
    const apiErr = new ApiError({
      kind: "stream",
      status: response.status,
      title: httpTitle(response.status),
      message: message || `API error ${response.status}`,
      detail: `HTTP ${response.status}`,
      path,
    });
    emitApiError(apiErr);
    logContext.duration_s = (performance.now() - streamStartedAt) / 1000;
    await reportStreamFailure(apiErr, path, logContext);
    throw apiErr;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";
      for (const chunk of parts) {
        const line = chunk
          .split("\n")
          .find((l) => l.startsWith("data: "));
        if (!line) continue;
        const payload = JSON.parse(line.slice(6));
        trackStreamEvent(logContext, payload);
        onEvent?.(payload);
        if (payload.event === "result") {
          result = payload;
        }
        if (payload.event === "error") {
          // #region agent log
          fetch("http://127.0.0.1:7706/ingest/ac544aa8-f980-4348-bd8e-331cdfbc33b6", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Debug-Session-Id": "9f5f92",
            },
            body: JSON.stringify({
              sessionId: "9f5f92",
              location: "client.js:streamRun",
              message: "SSE error event",
              data: {
                error: payload.error || payload.message || "Run failed",
              },
              timestamp: Date.now(),
              hypothesisId: "C",
            }),
          }).catch(() => {});
          // #endregion
          const body =
            payload.error || payload.message || "Run failed";
          const rejection = isStreamRejection(payload);
          const apiErr = new ApiError({
            kind: rejection ? "rejection" : "stream",
            title: rejection
              ? "Your request is rejected"
              : "Run stream failed",
            message: body,
            reasons: rejection ? body : "",
            path: rejection ? "" : path,
          });
          apiErr.skipLogReport = true;
          emitApiError(apiErr);
          throw apiErr;
        }
      }
    }
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    if (err?.skipLogReport) throw err;
    const apiErr = err instanceof ApiError ? err : toApiError(err, path);
    logContext.duration_s = (performance.now() - streamStartedAt) / 1000;
    await reportStreamFailure(apiErr, path, logContext);
    throw apiErr;
  }

  if (!result) {
    // #region agent log
    fetch("http://127.0.0.1:7706/ingest/ac544aa8-f980-4348-bd8e-331cdfbc33b6", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "9f5f92",
      },
      body: JSON.stringify({
        sessionId: "9f5f92",
        location: "client.js:streamRun",
        message: "Stream ended without result",
        data: { bufferTailLen: buffer.length },
        timestamp: Date.now(),
        hypothesisId: "B",
      }),
    }).catch(() => {});
    // #endregion
    const apiErr = new ApiError({
      kind: "stream",
      title: "Run stream failed",
      message: "Stream ended without a result",
      path,
    });
    emitApiError(apiErr);
    logContext.duration_s = (performance.now() - streamStartedAt) / 1000;
    await reportStreamFailure(apiErr, path, logContext);
    throw apiErr;
  }
  return result;
}

/**
 * Calculate the full result first, then return it (no SSE).
 * This avoids realtime streaming UI updates.
 */
export async function runChat(
  { prompt, mode, language = "en", report_type, chart_type, chart_types, columns },
  signal,
) {
  const path = "/api/chat";
  const body = {
    prompt,
    mode,
    language,
  };
  if (report_type) body.report_type = report_type;
  if (chart_type) body.chart_type = chart_type;
  if (chart_types?.length) body.chart_types = chart_types;
  if (columns?.length) body.columns = columns;

  const response = await requestJson(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  return response;
}
