import { useEffect, useRef } from "react";
import { X } from "lucide-react";
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

/**
 * Full-screen progress modal for a live pipeline run.
 */
export default function RunProgressModal({
  open,
  prompt,
  messages,
  running,
  error,
  onDismiss,
  nameById = {},
}) {
  const listRef = useRef(null);
  const { t } = useI18n();

  const list = Array.isArray(messages) ? messages : [];
  const runningStep = [...list].reverse().find((m) => m?.status === "running");
  const completedCount = list.filter(
    (m) => m?.status === "done" || m?.status === "failed",
  ).length;
  const seenAgents = new Set(
    list.map((m) => m?.agent_id).filter((id) => id && id !== "user"),
  );
  const progressTotal = Math.max(completedCount + (runningStep ? 1 : 0), seenAgents.size, 1);
  const progressValue = Math.min(completedCount, progressTotal);
  const progressPct = Math.round((progressValue / progressTotal) * 100);

  useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [open, messages]);

  if (!open) return null;

  const workingLabel = runningStep
    ? t("runProgress.workingAgent", {
        name: agentLabel(runningStep.agent_id, nameById, t),
      })
    : t("runProgress.working");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="run-progress-title"
    >
      <div className="flex max-h-[min(90dvh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]">
        <header className="shrink-0 border-b border-line/80 px-4 py-3">
          <h2 id="run-progress-title" className="font-display text-lg text-ink">
            {t("runProgress.title")}
          </h2>
          {prompt ? (
            <p className="mt-1 line-clamp-2 text-sm text-muted">{prompt}</p>
          ) : null}
          {running ? (
            <div
              className="mt-3 h-1.5 overflow-hidden rounded-full bg-fog"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={progressTotal}
              aria-valuenow={progressValue}
              aria-label={workingLabel}
            >
              <div
                className="h-full rounded-full bg-moss transition-[width] duration-300"
                style={{ width: `${Math.max(progressPct, running ? 8 : 0)}%` }}
              />
            </div>
          ) : null}
        </header>

        <ul
          ref={listRef}
          className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3 text-sm"
        >
          {list.length === 0 && running ? (
            <li className="text-muted">{t("runProgress.connecting")}</li>
          ) : null}
          {list.map((m, i) => {
            const isRunning = m.status === "running";
            return (
              <li
                key={`${m.agent_id}-${i}`}
                className={[
                  "rounded-lg border px-3 py-2 animate-[fadeIn_0.4s_ease]",
                  isRunning
                    ? "border-moss/50 bg-moss/10"
                    : "border-line/60 bg-fog/60",
                ].join(" ")}
              >
                <span className="font-medium text-moss">
                  {agentLabel(m.agent_id, nameById, t)}
                </span>
                <p className="mt-0.5 text-ink/90">
                  {translateKnownMessage(t, m.message)}
                </p>
              </li>
            );
          })}
        </ul>

        <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-line/80 px-4 py-3">
          {running ? (
            <p className="text-xs font-medium text-moss animate-pulse">
              {workingLabel}
            </p>
          ) : error ? (
            typeof error === "object" && error.kind === "rejection" ? (
              <div className="min-w-0 flex-1 space-y-1" role="status">
                <p className="text-sm font-medium text-ink">
                  {error.title || t("errors.rejection.title")}
                </p>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {t("errors.rejection.reasons")}
                </p>
                <p className="whitespace-pre-wrap text-sm text-ink/90">
                  {translateKnownMessage(
                    t,
                    error.reasons || error.message || "",
                  )}
                </p>
              </div>
            ) : (
              <p className="text-sm text-warn" role="status">
                {translateKnownMessage(
                  t,
                  typeof error === "string" ? error : error.message || String(error),
                )}
              </p>
            )
          ) : (
            <span />
          )}
          {!running ? (
            <IconButton
              type="button"
              icon={X}
              onClick={onDismiss}
              className="rounded-xl border border-line bg-fog px-4 py-2 text-sm font-medium text-ink hover:bg-fog/80"
            >
              {t("common.close")}
            </IconButton>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
