const EXACT_KEYS = {
  "Request rejected": "errors.http.badRequest",
  "Not authorized": "errors.http.unauthorized",
  "Not found": "errors.http.notFound",
  "Upstream provider error": "errors.http.upstream",
  "Server error": "errors.http.server",
  "API error": "errors.http.generic",
  "Cannot reach helix-api": "errors.network.title",
  "API host unreachable — is the server running?": "errors.network.message",
  "Failed to fetch": "errors.network.failedToFetch",
  "API misconfigured": "errors.parse.title",
  "Got HTML instead of JSON — check the API proxy or base URL.":
    "errors.parse.message",
  "Run stream failed": "errors.stream.title",
  "Run failed": "errors.stream.runFailed",
  "Stream ended without a result": "errors.stream.ended",
  "SSE error event": "errors.stream.sse",
  "Stream ended without result": "errors.stream.endedShort",
  "Your request is rejected": "errors.rejection.title",
  "Cannot reach the API": "errors.cannotReachApi",
  "Engine unreachable; database status unknown": "errors.engineUnreachableDb",
  "Engine unreachable; LLM status unknown": "errors.engineUnreachableLlm",
  "Cannot reach the API; LLM cannot be used.": "analysis.llmUnreachable",
  "API key is not set": "analysis.apiKeyMissing",
  "prompt is required": "api.promptRequired",
  "mode and language must be strings": "api.modeLanguageStrings",
  "language must be en or fa": "api.languageEnOrFa",
  "report_type must be low, medium, or high": "api.reportType",
  "chart_type is invalid": "api.chartTypeInvalid",
  "id is required": "api.idRequired",
  "name is required": "api.nameRequired",
  "name must be a string": "api.nameMustBeString",
  "content must be a string": "api.contentMustBeString",
  "agents must be a list": "api.agentsMustBeList",
  "assignments must be an object": "api.assignmentsObject",
  "Rule already exists": "api.ruleExists",
  "Skill already exists": "api.skillExists",
  "Rule not found": "api.ruleNotFound",
  "Skill not found": "api.skillNotFound",
  "Result not found": "api.resultNotFound",
  "Reference already exists": "api.referenceExists",
  "Reference not found": "api.referenceNotFound",
  "new_id is required": "api.newIdRequired",
  "A rule with that id already exists": "api.ruleIdExists",
  "A skill with that id already exists": "api.skillIdExists",
  "provider must be a string": "api.providerString",
  "column must be a string": "api.columnString",
  "description must be a string": "api.descriptionString",
  "sql_description must be a string": "api.sqlDescriptionString",
  "overview must be a string": "api.overviewString",
  "tables.md not found": "api.tablesMdNotFound",
  "archived is required": "api.archivedRequired",
  "archived must be a boolean": "api.archivedBoolean",
  "limit must be an integer": "api.limitInteger",
  "Bulk instruction updates are no longer supported": "api.bulkInstructionsGone",
  "Agents use rules and skills only; instructions are removed":
    "api.instructionsRemoved",
  "No report text was produced from the query results": "api.noReportText",
  "No chart could be built from the query results": "api.noChart",
  "Pipeline has no entry agent": "api.noEntryAgent",
  "pipeline_flow must be stages": "api.pipelineMustBeStages",
  "pipeline_flow must include at least one agent": "api.pipelineNeedsAgent",
  "Arrange uses one IF per stage.": "pipeline.validate.arrangeIf",
  "Add at least one stage.": "pipeline.validate.addStage",
  network: "errors.kind.network",
  parse: "errors.kind.parse",
  http: "errors.kind.http",
  server: "errors.kind.server",
  stream: "errors.kind.stream",
  rejection: "errors.kind.rejection",
};

const HTTP_META = /^HTTP (\d+)$/;
const API_STATUS = /^API error (\d+)$/;
const STAGE_INVALID = /^Stage (\d+) is invalid\.$/;
const STAGE_NEEDS_AGENT = /^Stage (\d+) needs an agent\.$/;
const STAGE_ACTION = /^Stage (\d+) action must be IF, IF NOT, or Go to\.$/;
const STAGE_GOTO = /^Stage (\d+) Go to needs a next agent\.$/;
const STAGE_RESULT = /^Stage (\d+) needs a result value\.$/;
const STAGE_RESULT_OP = /^Stage (\d+) Results must be Equal or Not Equal\.$/;
const STAGE_THEN = /^Stage (\d+) THEN must be Go to or STOP\.$/;
const STAGE_THEN_GOTO = /^Stage (\d+) THEN Go to needs a next agent\.$/;
const CIRCUIT = /^Circuit open: edge (.+) limit (.+)$/;
const RUNNING = /^Running (.+)…$/;
const RECEIVED = /^Received prompt \((.+)\/(.+)\) via (.+): (.*)$/;
const FETCHED = /^Fetched (\d+) rows$/;
const COMPLETE = /^(.+) complete$/;

export function translateKnownMessage(t, text) {
  if (text == null || text === "") return text;
  const raw = String(text);
  const exact = EXACT_KEYS[raw];
  if (exact) return t(exact);

  let match = HTTP_META.exec(raw);
  if (match) return t("errors.httpMeta", { status: match[1] });
  match = API_STATUS.exec(raw);
  if (match) return t("errors.http.status", { status: match[1] });
  match = STAGE_INVALID.exec(raw);
  if (match) return t("pipeline.validate.stageInvalid", { n: match[1] });
  match = STAGE_NEEDS_AGENT.exec(raw);
  if (match) return t("pipeline.validate.stageNeedsAgent", { n: match[1] });
  match = STAGE_ACTION.exec(raw);
  if (match) return t("pipeline.validate.stageAction", { n: match[1] });
  match = STAGE_GOTO.exec(raw);
  if (match) return t("pipeline.validate.goToNeedsAgent", { n: match[1] });
  match = STAGE_RESULT.exec(raw);
  if (match) return t("pipeline.validate.needsResult", { n: match[1] });
  match = STAGE_RESULT_OP.exec(raw);
  if (match) return t("pipeline.validate.resultOp", { n: match[1] });
  match = STAGE_THEN.exec(raw);
  if (match) return t("pipeline.validate.then", { n: match[1] });
  match = STAGE_THEN_GOTO.exec(raw);
  if (match) return t("pipeline.validate.thenGoTo", { n: match[1] });
  match = CIRCUIT.exec(raw);
  if (match) {
    return t("pipeline.circuitOpen", { id: match[1], cap: match[2] });
  }
  match = RUNNING.exec(raw);
  if (match) return t("sse.running", { name: match[1] });
  match = RECEIVED.exec(raw);
  if (match) {
    return t("sse.received", {
      mode: match[1],
      language: match[2],
      provider: match[3],
      prompt: match[4],
    });
  }
  match = FETCHED.exec(raw);
  if (match) return t("sse.fetched", { count: match[1] });
  if (raw === "Blueprint matched") return t("sse.blueprintMatched");
  if (raw === "Blueprint not matched") return t("sse.blueprintNotMatched");
  match = COMPLETE.exec(raw);
  if (match && !raw.includes(".")) {
    return t("sse.complete", { name: match[1] });
  }
  return raw;
}

export function failMessage(err, t, fallbackKey) {
  if (err instanceof Error) return translateKnownMessage(t, err.message);
  return t(fallbackKey);
}

export function translateApiError(t, error) {
  if (!error) return error;
  return {
    ...error,
    kind: error.kind ? translateKnownMessage(t, error.kind) : error.kind,
    title: translateKnownMessage(t, error.title) || t("errors.title"),
    message: translateKnownMessage(t, error.message) || t("errors.generic"),
    detail: error.detail ? translateKnownMessage(t, error.detail) : error.detail,
    reasons: error.reasons
      ? translateKnownMessage(t, error.reasons)
      : error.reasons,
  };
}
