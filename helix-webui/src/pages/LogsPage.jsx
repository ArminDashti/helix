import { Children, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Copy, Eye, ScrollText, Trash2 } from "lucide-react";
import { deleteLog, fetchLog, fetchLogs } from "../api/client.js";
import DataGrid from "../components/DataGrid.jsx";
import IconButton from "../components/IconButton.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { useI18n } from "../context/I18nContext.jsx";
import { useLiveSync } from "../context/LiveSyncContext.jsx";
import { failMessage } from "../i18n/apiErrors.js";
import { formatDateTime } from "../i18n/format.js";

const LOG_KIND_FILTERS = ["all", "pipeline", "llm", "sql", "database", "api"];

function truncateText(value, max = 120) {
  const text = String(value || "");
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

function kindLabel(t, kind) {
  const key = `logs.kind.${kind}`;
  const label = t(key);
  return label === key ? kind : label;
}

function agentDefinitionId(agentId) {
  const text = String(agentId || "").trim();
  if (!text || text === "user") return "";
  const idx = text.lastIndexOf("__");
  return idx > 0 ? text.slice(0, idx) : text;
}

function hasText(value) {
  return String(value ?? "").trim().length > 0;
}

function formatDuration(t, durationS) {
  if (durationS == null || !Number.isFinite(durationS)) return "";
  return t("logs.durationValue", { seconds: durationS });
}

async function copyText(value) {
  const text = String(value ?? "");
  if (!text) return;
  await navigator.clipboard.writeText(text);
}

function CopyButton({ value, label, className = "" }) {
  const { t } = useI18n();
  if (!hasText(value)) return null;
  return (
    <button
      type="button"
      onClick={() => copyText(value)}
      className={[
        "inline-flex items-center gap-1 rounded-lg border border-line bg-fog/60 px-2 py-1 text-xs font-medium text-muted hover:bg-fog",
        className,
      ].join(" ")}
      aria-label={label}
      title={label}
    >
      <Copy className="size-3.5 shrink-0" aria-hidden="true" />
      {t("logs.copy")}
    </button>
  );
}

function DetailField({ label, value, mono = false, copyValue }) {
  if (!hasText(value)) return null;
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
          {label}
        </dt>
        <CopyButton value={copyValue ?? value} label={`${label} — ${value}`} />
      </div>
      <dd
        className={[
          "mt-1 break-words text-sm text-ink",
          mono ? "overflow-x-auto rounded-xl border border-line bg-fog/40 p-3 font-mono text-xs whitespace-pre-wrap" : "whitespace-pre-wrap",
        ].join(" ")}
      >
        {value}
      </dd>
    </div>
  );
}

function DetailSection({ title, children }) {
  const visible = Children.toArray(children).filter(Boolean);
  if (!visible.length) return null;
  return (
    <section className="rounded-2xl border border-line/80 bg-paper/80 p-4">
      <h3 className="mb-3 text-sm font-semibold text-ink">{title}</h3>
      <dl className="space-y-3">{visible}</dl>
    </section>
  );
}

function StepStatusBadge({ status, t }) {
  const normalized = String(status || "").toLowerCase();
  const tone =
    normalized === "failed"
      ? "border-warn-border bg-warn-bg text-warn"
      : normalized === "running"
        ? "border-line bg-fog text-muted"
        : "border-moss/30 bg-moss/10 text-moss";
  const labelKey = `logs.stepStatus.${normalized}`;
  const label = t(labelKey);
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${tone}`}>
      {label === labelKey ? status || t("common.noneDash") : label}
    </span>
  );
}

function LogsList() {
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [kindFilter, setKindFilter] = useState("all");

  async function load() {
    const records = await fetchLogs();
    setItems(records);
  }

  useEffect(() => {
    (async () => {
      try {
        await load();
      } catch (err) {
        setError(failMessage(err, t, "logs.loadFailed"));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  useLiveSync("logs", () => load().catch(() => {}));
  useEffect(() => {
    function onFocusVis() { if (document.visibilityState !== "hidden") load().catch(() => {}); }
    window.addEventListener("focus", onFocusVis);
    document.addEventListener("visibilitychange", onFocusVis);
    return () => { window.removeEventListener("focus", onFocusVis); document.removeEventListener("visibilitychange", onFocusVis); };
  }, []);

  async function handleDelete(item) {
    if (!window.confirm(t("logs.deleteConfirm"))) return;
    setError(null);
    try {
      await deleteLog(item.id);
      await load();
    } catch (err) {
      setError(failMessage(err, t, "logs.deleteFailed"));
    }
  }

  const filtered = useMemo(
    () =>
      kindFilter === "all"
        ? items
        : items.filter((item) => item.kind === kindFilter),
    [items, kindFilter],
  );

  const rows = useMemo(
    () => filtered.map((item) => ({ key: item.id, item })),
    [filtered],
  );

  const columns = useMemo(
    () => [
      {
        key: "datetime",
        label: t("logs.colDatetime"),
        render: (item) => (
          <span className="whitespace-nowrap font-sans text-[13px]">
            {formatDateTime(item.created_at, locale)}
          </span>
        ),
      },
      {
        key: "kind",
        label: t("logs.colKind"),
        render: (item) => (
          <span className="rounded-full border border-warn-border bg-warn-bg px-2 py-0.5 text-xs font-medium text-warn">
            {kindLabel(t, item.kind)}
          </span>
        ),
      },
      {
        key: "message",
        label: t("logs.colMessage"),
        render: (item) => truncateText(item.message),
      },
      {
        key: "prompt",
        label: t("logs.colPrompt"),
        render: (item) =>
          item.prompt ? truncateText(item.prompt, 80) : t("logs.noPrompt"),
      },
      {
        key: "show",
        label: t("logs.colShow"),
        render: (item) => (
          <IconButton
            type="button"
            icon={Eye}
            onClick={() => navigate(`/logs/${item.id}`)}
            className="rounded-lg border border-line bg-fog px-2 py-1.5 text-xs font-medium hover:bg-fog/80"
          >
            {t("logs.show")}
          </IconButton>
        ),
      },
      {
        key: "delete",
        label: t("logs.colDelete"),
        render: (item) => (
          <IconButton
            type="button"
            icon={Trash2}
            onClick={() => handleDelete(item)}
            className="rounded-lg border border-warn-border bg-warn-bg px-2 py-1.5 text-xs font-medium text-warn hover:opacity-90"
          >
            {t("logs.delete")}
          </IconButton>
        ),
      },
    ],
    [t, locale, navigate],
  );

  if (loading) {
    return <p className="text-sm text-muted">{t("logs.loadingList")}</p>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <PageHeader icon={ScrollText} title={t("logs.title")}>
        <p className="mt-0.5 text-sm text-muted">{t("logs.subtitle")}</p>
      </PageHeader>
      {error ? (
        <p className="rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
          {error}
        </p>
      ) : null}
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label={t("logs.filterAria")}
      >
        {LOG_KIND_FILTERS.map((kind) => {
          const isActive = kindFilter === kind;
          return (
            <button
              key={kind}
              type="button"
              onClick={() => setKindFilter(kind)}
              className={[
                "rounded-full border px-3 py-1 text-xs font-medium",
                isActive
                  ? "border-ink bg-ink text-paper"
                  : "border-line bg-fog/40 text-muted hover:bg-fog",
              ].join(" ")}
            >
              {kind === "all" ? t("logs.filterAll") : kindLabel(t, kind)}
            </button>
          );
        })}
      </div>
      <DataGrid columns={columns} rows={rows} emptyLabel={t("logs.empty")} />
    </div>
  );
}

function LogDetail({ logId }) {
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const item = await fetchLog(logId);
        if (!cancelled) setRecord(item);
      } catch (err) {
        if (!cancelled) {
          setRecord(null);
          setError(failMessage(err, t, "logs.loadOneFailed"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [logId, t]);

  async function handleDelete() {
    if (!record || !window.confirm(t("logs.deleteConfirm"))) return;
    setActionError(null);
    try {
      await deleteLog(record.id);
      navigate("/logs");
    } catch (err) {
      setActionError(failMessage(err, t, "logs.deleteFailed"));
    }
  }

  if (loading) {
    return <p className="text-sm text-muted">{t("logs.loadingDetail")}</p>;
  }

  if (error || !record) {
    return (
      <div className="space-y-3">
        <PageHeader icon={ScrollText} title={t("logs.title")} backTo="/logs" />
        <p className="rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
          {error || t("logs.notFound")}
        </p>
        <Link
          to="/logs"
          className="inline-flex items-center gap-2 rounded-xl border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-fog"
        >
          <ArrowLeft
            className="size-4 shrink-0 rtl:rotate-180"
            aria-hidden="true"
          />
          {t("logs.backToList")}
        </Link>
      </div>
    );
  }

  const agentLinkId = agentDefinitionId(record.agent_id);
  const duration = formatDuration(t, record.duration_s);
  const steps = Array.isArray(record.steps) ? record.steps : [];
  const sqlValue = hasText(record.sql) ? record.sql : t("common.noneDash");

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto">
      <PageHeader
        icon={ScrollText}
        title={t("logs.title")}
        backTo="/logs"
        actions={
          <IconButton
            type="button"
            icon={Trash2}
            onClick={handleDelete}
            className="rounded-xl border border-warn-border bg-warn-bg px-3 py-1.5 text-xs font-medium text-warn hover:opacity-90"
          >
            {t("logs.delete")}
          </IconButton>
        }
      />

      {actionError ? (
        <p className="rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
          {actionError}
        </p>
      ) : null}

      <div className="space-y-3 pb-4">
        <DetailSection title={t("logs.sectionOverview")}>
          <DetailField label={t("logs.fieldId")} value={record.id} />
          <DetailField
            label={t("logs.fieldDatetime")}
            value={formatDateTime(record.created_at, locale)}
          />
          <DetailField
            label={t("logs.fieldKind")}
            value={kindLabel(t, record.kind)}
          />
          <DetailField label={t("logs.fieldRunId")} value={record.run_id} />
          <DetailField label={t("logs.fieldDuration")} value={duration} />
        </DetailSection>

        <DetailSection title={t("logs.sectionRequest")}>
          <DetailField label={t("logs.fieldPrompt")} value={record.prompt} />
          <DetailField label={t("logs.fieldMode")} value={record.mode} />
          <DetailField label={t("logs.fieldLanguage")} value={record.language} />
          <DetailField
            label={t("logs.fieldReportType")}
            value={record.report_type}
          />
          <DetailField
            label={t("logs.fieldChartType")}
            value={record.chart_type}
          />
        </DetailSection>

        <DetailSection title={t("logs.sectionError")}>
          <DetailField label={t("logs.fieldMessage")} value={record.message} />
          <DetailField label={t("logs.fieldDetail")} value={record.detail} />
          <DetailField label={t("logs.fieldPath")} value={record.path} />
          <DetailField
            label={t("logs.fieldStatus")}
            value={
              record.status_code != null ? String(record.status_code) : ""
            }
          />
        </DetailSection>

        {(hasText(record.agent_id) || hasText(record.node_id) || steps.length > 0) ? (
          <section className="rounded-2xl border border-line/80 bg-paper/80 p-4">
            <h3 className="mb-3 text-sm font-semibold text-ink">
              {t("logs.sectionPipeline")}
            </h3>
            <dl className="space-y-3">
              {hasText(record.agent_id) ? (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {t("logs.fieldAgent")}
                  </dt>
                  <dd className="mt-1 text-sm text-ink">
                    {agentLinkId ? (
                      <Link
                        to={`/agents/${encodeURIComponent(agentLinkId)}`}
                        className="underline decoration-line underline-offset-2 hover:text-moss"
                      >
                        {record.agent_id}
                      </Link>
                    ) : (
                      record.agent_id
                    )}
                  </dd>
                </div>
              ) : null}
              <DetailField label={t("logs.fieldNodeId")} value={record.node_id} />
            </dl>
            {steps.length > 0 ? (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                      <th className="px-2 py-2 font-semibold">
                        {t("logs.colStepAgent")}
                      </th>
                      <th className="px-2 py-2 font-semibold">
                        {t("logs.colStepStatus")}
                      </th>
                      <th className="px-2 py-2 font-semibold">
                        {t("logs.colStepMessage")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {steps.map((step, index) => (
                      <tr
                        key={`${step.node_id || step.agent_id || "step"}-${index}`}
                        className="border-b border-line/60 align-top"
                      >
                        <td className="px-2 py-2 font-mono text-xs text-ink">
                          {step.node_id || step.agent_id || t("common.noneDash")}
                        </td>
                        <td className="px-2 py-2">
                          <StepStatusBadge status={step.status} t={t} />
                        </td>
                        <td className="px-2 py-2 whitespace-pre-wrap text-ink">
                          {step.message || t("common.noneDash")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        ) : null}

        <DetailSection title={t("logs.sectionTechnical")}>
          <div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                {t("logs.fieldSql")}
              </dt>
              {hasText(record.sql) ? (
                <CopyButton
                  value={record.sql}
                  label={t("logs.copySql")}
                />
              ) : null}
            </div>
            <dd className="mt-1 overflow-x-auto rounded-xl border border-line bg-fog/40 p-3 font-mono text-xs text-ink whitespace-pre-wrap">
              {sqlValue}
            </dd>
          </div>
        </DetailSection>
      </div>
    </div>
  );
}

export default function LogsPage() {
  const { logId } = useParams();
  if (logId) return <LogDetail logId={logId} />;
  return <LogsList />;
}
