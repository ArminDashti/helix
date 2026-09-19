import { useEffect, useRef, useState } from "react";
import { X, ChevronDown, ChevronUp, Clock, Layers, Database, AlertTriangle, CheckCircle2, Loader2, Copy } from "lucide-react";
import IconButton from "./IconButton.jsx";
import { useI18n } from "../context/I18nContext.jsx";
import { translateKnownMessage } from "../i18n/apiErrors.js";

function agentLabel(agentId, nameById, t) {
  if (nameById?.[agentId]) return nameById[agentId];
  if (agentId === "user") return t("runProgress.fallbackUser");
  if (agentId === "system") return t("runProgress.fallbackSystem");
  if (!agentId) return t("runProgress.fallbackAgent");
  return agentId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusBadge(status) {
  if (status === "running") return "bg-amber-100 text-amber-800 border-amber-200";
  if (status === "failed") return "bg-red-100 text-red-700 border-red-200";
  if (status === "done") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  return "bg-fog text-muted border-line";
}

function formatElapsed(s) {
  if (s == null || !Number.isFinite(s)) return "—";
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}m ${sec}s`;
}

export default function RunProgressModal({
  open,
  prompt,
  messages,
  running,
  error,
  onDismiss,
  nameById = {},
  meta = {},
  startedAt = null,
}) {
  const listRef = useRef(null);
  const { t } = useI18n();
  const [expanded, setExpanded] = useState({});
  const [showRaw, setShowRaw] = useState(false);
  const [now, setNow] = useState(Date.now());

  const list = Array.isArray(messages) ? messages : [];
  const runningStep = [...list].reverse().find((m) => m?.status === "running");
  const completedCount = list.filter((m) => m?.status === "done" || m?.status === "failed").length;
  const failedCount = list.filter((m) => m?.status === "failed").length;
  const seenAgents = new Set(list.map((m) => m?.agent_id).filter((id) => id && id !== "user"));
  const progressTotal = Math.max(completedCount + (runningStep ? 1 : 0), seenAgents.size, 1);
  const progressValue = Math.min(completedCount, progressTotal);
  const progressPct = Math.round((progressValue / progressTotal) * 100);
  const elapsedTotal = startedAt ? (now - startedAt) / 1000 : null;

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setNow(Date.now()), 700);
    return () => clearInterval(id);
  }, [open]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [open, messages]);

  if (!open) return null;

  const workingLabel = runningStep
    ? t("runProgress.workingAgent", { name: agentLabel(runningStep.agent_id, nameById, t) })
    : t("runProgress.working");

  const toggle = (i) => setExpanded((prev) => ({ ...prev, [i]: !prev[i] }));

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="run-progress-title">
      <div className="flex max-h-[min(94dvh,48rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]">
        <header className="shrink-0 border-b border-line/80 px-4 py-3 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <h2 id="run-progress-title" className="font-display text-lg text-ink">{t("runProgress.title")}</h2>
            <span className={["inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", running ? "bg-amber-50 border-amber-200 text-amber-700" : error ? "bg-red-50 border-red-200 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"].join(" ")}>
              {running ? <Loader2 className="size-3.5 animate-spin" /> : error ? <AlertTriangle className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
              {running ? (t("runProgress.running") || "Running") : error ? (t("runProgress.failed") || "Failed") : (t("runProgress.done") || "Done")}
            </span>
          </div>

          {prompt ? <p className="line-clamp-3 rounded-lg bg-fog/40 px-3 py-2 text-sm text-ink/90 border border-line/60">{prompt}</p> : null}

          <div className="flex flex-wrap gap-1.5 text-xs">
            {meta.mode ? <span className="rounded-full border border-line bg-fog px-2 py-1 font-medium text-ink">mode: {meta.mode}</span> : null}
            {meta.language ? <span className="rounded-full border border-line bg-fog px-2 py-1 font-medium text-ink">lang: {meta.language}</span> : null}
            {meta.report_type ? <span className="rounded-full border border-line bg-fog px-2 py-1 font-medium text-ink">report: {meta.report_type}</span> : null}
            {meta.chart_types?.length ? <span className="rounded-full border border-line bg-fog px-2 py-1 font-medium text-ink">charts: {meta.chart_types.join(", ")}</span> : meta.chart_type ? <span className="rounded-full border border-line bg-fog px-2 py-1 font-medium text-ink">chart: {meta.chart_type}</span> : null}
            <span className="inline-flex items-center gap-1 rounded-full border border-line bg-paper px-2 py-1 text-muted"><Layers className="size-3" /> {list.length} steps</span>
            {failedCount ? <span className="rounded-full bg-red-100 border border-red-200 px-2 py-1 font-medium text-red-700">{failedCount} failed</span> : null}
            <span className="inline-flex items-center gap-1 rounded-full border border-line bg-paper px-2 py-1 text-muted"><Clock className="size-3" /> {elapsedTotal != null ? formatElapsed(elapsedTotal) : "—"} total</span>
          </div>

          {running ? (
            <div className="h-1.5 overflow-hidden rounded-full bg-fog" role="progressbar" aria-valuemin={0} aria-valuemax={progressTotal} aria-valuenow={progressValue} aria-label={workingLabel}>
              <div className="h-full rounded-full bg-moss transition-[width] duration-300" style={{ width: `${Math.max(progressPct, running ? 8 : 0)}%` }} />
            </div>
          ) : null}
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted">{running ? workingLabel : error ? t("runProgress.errorHint") || "See error below" : t("runProgress.finished") || "Finished"}</p>
            <button type="button" onClick={() => setShowRaw((v) => !v)} className="text-xs text-muted underline hover:text-ink">{showRaw ? "Hide raw" : "Show raw"}</button>
          </div>
        </header>

        <ul ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3 text-sm bg-fog/20">
          {list.length === 0 && running ? <li className="text-muted">{t("runProgress.connecting")}</li> : null}
          {list.map((m, i) => {
            const isRunning = m.status === "running";
            const isExpanded = !!expanded[i];
            const hasDetails = !!(m.sql || m.handoff || m.elapsed_s != null || m.node_id || m.at || m.row_count != null);
            return (
              <li key={`${m.agent_id}-${i}-${m.at || i}`} className={["rounded-xl border px-3 py-2.5 animate-[fadeIn_0.4s_ease] bg-paper", isRunning ? "border-moss/50 bg-moss/5" : m.status === "failed" ? "border-red-200 bg-red-50/50" : "border-line/70"].join(" ")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-moss">{agentLabel(m.agent_id, nameById, t)}</span>
                      {m.node_id && m.node_id !== m.agent_id ? <span className="rounded bg-fog border border-line px-1.5 py-0.5 text-[11px] font-mono text-muted">node:{m.node_id}</span> : null}
                      <span className={["rounded-full border px-1.5 py-0.5 text-[11px] font-medium", statusBadge(m.status)].join(" ")}>{m.status || "—"}</span>
                      {m.elapsed_s != null ? <span className="inline-flex items-center gap-1 text-[11px] text-muted"><Clock className="size-3" />{formatElapsed(m.elapsed_s)}</span> : null}
                      {m.row_count != null ? <span className="inline-flex items-center gap-1 text-[11px] text-muted"><Database className="size-3" />{m.row_count} rows</span> : null}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-ink/90 leading-relaxed">{translateKnownMessage(t, m.message)}</p>
                    {m.result ? <p className="mt-1 text-xs font-mono text-muted">result: {m.result}</p> : null}
                  </div>
                  {hasDetails ? (
                    <button type="button" onClick={() => toggle(i)} className="shrink-0 rounded-lg border border-line bg-fog p-1 text-muted hover:bg-fog/80" aria-label={isExpanded ? "Collapse" : "Expand"}>
                      {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                    </button>
                  ) : null}
                </div>
                {isExpanded ? (
                  <div className="mt-2 space-y-2 rounded-lg border border-line/60 bg-fog/40 p-2 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div><span className="font-medium text-muted">agent_id:</span> <span className="font-mono text-ink break-all">{m.agent_id || "—"}</span></div>
                      <div><span className="font-medium text-muted">node_id:</span> <span className="font-mono text-ink break-all">{m.node_id || "—"}</span></div>
                      <div><span className="font-medium text-muted">status:</span> {m.status || "—"}</div>
                      <div><span className="font-medium text-muted">elapsed:</span> {m.elapsed_s != null ? `${m.elapsed_s}s` : "—"}</div>
                      <div><span className="font-medium text-muted">at:</span> {m.at ? new Date(m.at * 1000).toLocaleString() : "—"}</div>
                      <div><span className="font-medium text-muted">run_id:</span> <span className="font-mono text-ink break-all">{m.run_id || "—"}</span></div>
                    </div>
                    {m.sql ? (
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-muted">SQL</span>
                          <button type="button" onClick={() => copyText(m.sql)} className="inline-flex items-center gap-1 rounded border border-line bg-paper px-1.5 py-0.5 text-[11px] hover:bg-fog"><Copy className="size-3" /> Copy</button>
                        </div>
                        <pre className="mt-1 max-h-32 overflow-auto rounded border border-line bg-paper p-2 font-mono text-[11px] text-ink whitespace-pre-wrap break-words">{m.sql}</pre>
                      </div>
                    ) : null}
                    {m.handoff ? (
                      <div>
                        <p className="font-medium text-muted">validation handoff</p>
                        <div className="mt-1 space-y-1">
                          {Object.entries(m.handoff).map(([k, v]) => (
                            <div key={k}><span className="font-medium">{k}:</span> <span className="whitespace-pre-wrap break-words text-ink">{String(v).slice(0, 800)}</span></div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {showRaw ? <pre className="max-h-40 overflow-auto rounded border border-line bg-paper p-2 font-mono text-[11px] whitespace-pre-wrap break-words">{JSON.stringify(m, null, 2)}</pre> : null}
                  </div>
                ) : null}
              </li>
            );
          })}
          {showRaw && list.length === 0 ? <li className="text-xs font-mono text-muted">no steps yet</li> : null}
        </ul>

        <footer className="flex shrink-0 flex-col gap-2 border-t border-line/80 px-4 py-3 bg-paper">
          {running ? (
            <p className="text-xs font-medium text-moss animate-pulse">{workingLabel} · {list.length} steps</p>
          ) : error ? (
            typeof error === "object" && error.kind === "rejection" ? (
              <div className="min-w-0 flex-1 space-y-1" role="status">
                <p className="text-sm font-medium text-ink">{error.title || t("errors.rejection.title")}</p>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("errors.rejection.reasons")}</p>
                <p className="whitespace-pre-wrap text-sm text-ink/90">{translateKnownMessage(t, error.reasons || error.message || "")}</p>
              </div>
            ) : (
              <p className="text-sm text-warn" role="status">{translateKnownMessage(t, typeof error === "string" ? error : error.message || String(error))}</p>
            )
          ) : (
            <p className="text-xs text-muted">{t("runProgress.finished") || "Run finished — result will be saved."}</p>
          )}
          <div className="flex justify-end gap-2">
            {running ? <span className="text-xs text-muted self-center">Close is disabled while running</span> : null}
            <IconButton type="button" icon={X} onClick={onDismiss} disabled={running} className="rounded-xl border border-line bg-fog px-4 py-2 text-sm font-medium text-ink hover:bg-fog/80 disabled:opacity-50">
              {running ? t("runProgress.running") || "Running…" : t("common.close")}
            </IconButton>
          </div>
        </footer>
      </div>
    </div>
  );
}
