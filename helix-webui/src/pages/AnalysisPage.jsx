import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AreaChart,
  BarChart3,
  ChartColumn,
  ChartLine,
  ChartPie,
  ChartScatter,
  CircleDot,
  Play,
} from "lucide-react";
import { fetchAgents, streamRun, createResult } from "../api/client.js";
import ErrorModal from "../components/ErrorModal.jsx";
import IconButton from "../components/IconButton.jsx";
import PageHeader from "../components/PageHeader.jsx";
import RunProgressModal from "../components/RunProgressModal.jsx";
import { useApiStatus } from "../context/ApiStatusContext.jsx";
import { useI18n } from "../context/I18nContext.jsx";
import { translateKnownMessage } from "../i18n/apiErrors.js";
import { readStoredLocale } from "../i18n/applyLocale.js";
import { translate } from "../i18n/messages.js";
import { agentCompanyLabel } from "../utils/agentLabel.js";
import { textDirection, textLang } from "../utils/textDirection.js";
import { sortByLabel } from "../utils/sortOptions.js";

const selectClass =
  "w-full min-w-[8.5rem] rounded-xl border border-line bg-paper px-3 py-2.5 text-[15px] text-ink outline-none ring-moss/30 focus:border-moss focus:ring-2";

const CHART_TYPE_META = [
  { value: "bar", icon: BarChart3, labelKey: "analysis.chartBar" },
  { value: "line", icon: ChartLine, labelKey: "analysis.chartLine" },
  { value: "area", icon: AreaChart, labelKey: "analysis.chartArea" },
  { value: "pie", icon: ChartPie, labelKey: "analysis.chartPie" },
  { value: "donut", icon: CircleDot, labelKey: "analysis.chartDonut" },
  { value: "scatter", icon: ChartScatter, labelKey: "analysis.chartScatter" },
  { value: "stacked_bar", icon: ChartColumn, labelKey: "analysis.chartStackedBar" },
  {
    value: "horizontal_bar",
    icon: BarChart3,
    labelKey: "analysis.chartHorizontalBar",
  },
];

function needsType(mode) {
  return mode === "research";
}

function needsChart(mode) {
  return mode === "chart";
}

function llmUnavailableMessage(health, t) {
  if (!health) {
    return t("analysis.llmUnreachable");
  }
  const block = health.llm;
  if (block?.status === "configured") return null;
  return translateKnownMessage(t, block?.detail) || t("analysis.apiKeyMissing");
}

export default function AnalysisPage() {
  const navigate = useNavigate();
  const { health, checkConnection } = useApiStatus();
  const { t, locale } = useI18n();
  const [prompt, setPrompt] = useState(() =>
    translate(readStoredLocale(), "analysis.promptDefault"),
  );
  const [mode, setMode] = useState("chart");
  const [reportType, setReportType] = useState("medium");
  const [chartTypesSelected, setChartTypesSelected] = useState(["bar"]);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState(null);
  const [activePrompt, setActivePrompt] = useState("");
  const [runMessages, setRunMessages] = useState([]);
  const [nameById, setNameById] = useState({});
  const [llmError, setLlmError] = useState(null);
  const abortRef = useRef(null);

  const modes = useMemo(
    () =>
      sortByLabel(
        [
          { value: "chart", label: t("analysis.modeChart") },
          { value: "research", label: t("analysis.modeResearch") },
        ],
        (item) => item.label,
        locale,
      ),
    [t, locale],
  );

  const researchLevels = useMemo(
    () => [
      { value: "low", label: t("analysis.researchLow") },
      { value: "medium", label: t("analysis.researchMedium") },
      { value: "high", label: t("analysis.researchHigh") },
    ],
    [t],
  );

  const chartTypes = useMemo(
    () =>
      sortByLabel(
        CHART_TYPE_META.map((item) => ({
          ...item,
          label: t(item.labelKey),
        })),
        (item) => item.label,
        locale,
      ),
    [t, locale],
  );

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const agents = await fetchAgents();
        if (cancelled) return;
        const map = {};
        for (const a of agents || []) {
          if (a?.id) map[a.id] = agentCompanyLabel(a);
        }
        setNameById(map);
      } catch {
        /* keep empty map */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRun(event) {
    event.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed) {
      setError(t("analysis.promptRequired"));
      return;
    }
    const latest = (await checkConnection({ silent: true })) || health;
    const llmMessage = llmUnavailableMessage(latest, t);
    if (llmMessage) {
      setError(llmMessage);
      setLlmError({ title: t("analysis.cannotRun"), message: llmMessage });
      return;
    }
    setError(null);
    setLlmError(null);
    setRunError(null);
    setRunMessages([]);
    setActivePrompt(trimmed);
    setModalOpen(true);
    setRunning(true);

    const selectedCharts = needsChart(mode)
      ? chartTypesSelected.slice(0, 4)
      : undefined;
    if (needsChart(mode) && (!selectedCharts || selectedCharts.length === 0)) {
      setError(t("analysis.chartRequired"));
      setRunning(false);
      setModalOpen(false);
      return;
    }
    const payload = {
      prompt: trimmed,
      mode,
      language: locale,
      report_type: needsType(mode) ? reportType : undefined,
      chart_type: selectedCharts?.[0],
      chart_types: selectedCharts,
    };

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    try {
      const startedAt = performance.now();
      const final = await streamRun(payload, (event) => {
        if (event?.event === "step") {
          setRunMessages((prev) => [
            ...prev,
            {
              agent_id: event.agent_id,
              node_id: event.node_id,
              message: event.message,
              status: event.status,
            },
          ]);
        } else if (event?.event === "error" && event.error) {
          const body = translateKnownMessage(t, String(event.error));
          if (
            event.kind === "rejection" ||
            event.agent_id === "guardian" ||
            event.agent_id === "task_validator"
          ) {
            setRunError({
              kind: "rejection",
              title: t("errors.rejection.title"),
              message: body,
              reasons: body,
            });
          } else {
            setRunError(body);
          }
        }
      }, controller.signal);
      const clientDurationS = (performance.now() - startedAt) / 1000;
      const durationS =
        typeof final?.duration_s === "number" && Number.isFinite(final.duration_s)
          ? final.duration_s
          : clientDurationS;
      setModalOpen(false);
      setRunning(false);
      await createResult({
        prompt: trimmed,
        mode,
        language: locale,
        payload: final,
        duration_s: durationS,
      });
      navigate("/results");
    } catch (err) {
      if (err?.name === "AbortError") return;
      setRunning(false);
      if (err?.kind === "rejection") {
        const body = translateKnownMessage(
          t,
          err.reasons || err.message || t("analysis.runFailed"),
        );
        setRunError({
          kind: "rejection",
          title: t("errors.rejection.title"),
          message: body,
          reasons: body,
        });
      } else {
        setRunError(
          err instanceof Error
            ? translateKnownMessage(t, err.message)
            : t("analysis.runFailed"),
        );
      }
    }
  }

  function dismissModal() {
    if (running) {
      abortRef.current?.abort();
      setRunning(false);
    }
    setModalOpen(false);
    setRunError(null);
  }

  function toggleChartType(value) {
    setChartTypesSelected((prev) => {
      if (prev.includes(value)) {
        return prev.filter((v) => v !== value);
      }
      if (prev.length >= 4) return prev;
      return [...prev, value];
    });
  }

  const promptDir = textDirection(prompt);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <PageHeader icon={BarChart3} title={t("analysis.title")} />
      <form
        onSubmit={handleRun}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-2xl border border-line/80 bg-paper/80 p-4 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:p-5"
      >
        <label htmlFor="prompt" className="block text-sm font-medium text-ink">
          {t("analysis.prompt")}
        </label>
        <textarea
          id="prompt"
          value={prompt}
          dir={promptDir}
          lang={textLang(prompt)}
          onChange={(e) => setPrompt(e.target.value)}
          className="min-h-[8rem] w-full flex-1 resize-y rounded-xl border border-line bg-paper px-4 py-3 text-[15px] leading-relaxed text-ink outline-none ring-moss/30 transition focus:border-moss focus:ring-2"
          placeholder={t("analysis.promptPlaceholder")}
        />

        <div className="flex flex-wrap items-end gap-3 overflow-x-auto">
          <div className="min-w-[8.5rem] shrink-0">
            <label htmlFor="mode" className="block text-sm font-medium text-ink">
              {t("analysis.mode")}
            </label>
            <select
              id="mode"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className={selectClass}
            >
              {modes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          {needsType(mode) ? (
            <div className="min-w-[8.5rem] shrink-0">
              <label
                htmlFor="research_level"
                className="block text-sm font-medium text-ink"
              >
                {t("analysis.research")}
              </label>
              <select
                id="research_level"
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className={selectClass}
              >
                {researchLevels.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {needsChart(mode) ? (
            <div className="min-w-0 shrink-0">
              <span className="block text-sm font-medium text-ink">
                {t("analysis.chart")}
              </span>
              <div
                className="mt-1 flex flex-wrap gap-1.5"
                role="group"
                aria-label={t("analysis.chart")}
              >
                {chartTypes.map((item) => {
                  const pressed = chartTypesSelected.includes(item.value);
                  const atCap = !pressed && chartTypesSelected.length >= 4;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      title={item.label}
                      aria-label={item.label}
                      aria-pressed={pressed}
                      disabled={atCap}
                      onClick={() => toggleChartType(item.value)}
                      className={[
                        "inline-flex size-10 items-center justify-center rounded-xl border transition",
                        pressed
                          ? "border-moss bg-moss/15 text-ink"
                          : "border-line bg-paper text-muted hover:bg-fog",
                        atCap ? "cursor-not-allowed opacity-50" : "",
                      ].join(" ")}
                    >
                      <Icon className="size-5" aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <IconButton
            type="submit"
            icon={Play}
            disabled={running}
            className="shrink-0 rounded-xl bg-moss px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-moss-deep disabled:opacity-60"
          >
            {t("analysis.run")}
          </IconButton>
        </div>
      </form>

      {error ? (
        <p
          className="mt-3 rounded-xl border border-warn-border bg-warn-bg px-4 py-3 text-sm text-warn"
          role="status"
        >
          {error}
        </p>
      ) : null}

      <ErrorModal error={llmError} onDismiss={() => setLlmError(null)} />

      <RunProgressModal
        open={modalOpen}
        prompt={activePrompt}
        messages={runMessages}
        running={running}
        error={runError}
        onDismiss={dismissModal}
        nameById={nameById}
      />
    </div>
  );
}
