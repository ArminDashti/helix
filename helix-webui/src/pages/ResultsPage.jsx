import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ReactECharts from "echarts-for-react";
import {
  ArrowLeft,
  Eye,
  FileDown,
  History,
  Pencil,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import {
  deleteResult,
  fetchResult,
  fetchResults,
} from "../api/client.js";
import DataGrid from "../components/DataGrid.jsx";
import IconButton from "../components/IconButton.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { useI18n } from "../context/I18nContext.jsx";
import { failMessage } from "../i18n/apiErrors.js";
import { formatDateTime, formatDurationSeconds } from "../i18n/format.js";
import { assetUrl } from "../utils/assetUrl.js";
import {
  exportResultPdf,
  resolveDir,
  resultChartEntries,
} from "../lib/exportResultPdf.js";
import { loadPdfDesign, orderedGridColumns } from "../lib/pdfDesign.js";

const DARK_CHART_DEFAULTS = {
  backgroundColor: "transparent",
  textStyle: { color: "#e8e8e8" },
};

function withDarkChartColors(option) {
  if (!option || typeof option !== "object") return option;
  return {
    ...DARK_CHART_DEFAULTS,
    ...option,
    color: option.color || ["#3d9b82", "#5cb89a", "#7ab89f"],
    backgroundColor: option.backgroundColor ?? "transparent",
    title: option.title
      ? {
          ...option.title,
          textStyle: {
            color: "#e8e8e8",
            fontWeight: 600,
            ...(option.title.textStyle || {}),
          },
        }
      : option.title,
  };
}

function normalizeMode(mode) {
  if (mode === "analysis" || mode === "research") return "analytical_report";
  if (mode === "both") return "analytical_report_chart";
  return mode || "auto";
}

function ResultsList() {
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const pdfLabels = useMemo(
    () => ({
      pdfAlert: t("results.pdfAlert"),
      pdfTitle: t("results.pdfTitle"),
      pdfHeading: t("results.pdfHeading"),
      pdfChartAlt: t("results.pdfChartAlt"),
      pdfLogoAlt: t("results.pdfLogoAlt"),
      pdfCompanyLogoAlt: t("results.pdfCompanyLogoAlt"),
      pdfFooter: t("results.pdfFooter"),
    }),
    [t],
  );

  async function load() {
    const data = await fetchResults();
    setItems(data || []);
  }

  useEffect(() => {
    (async () => {
      try {
        await load();
      } catch (err) {
        setError(failMessage(err, t, "results.loadFailed"));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  async function handleExport(item) {
    setError(null);
    try {
      const record = await fetchResult(item.id);
      const result = record?.payload;
      if (!result) {
        setError(t("results.noPayload"));
        return;
      }
      const charts = resultChartEntries(result);
      const showChart = charts.length > 0;
      const showText = Boolean(result.text_report);
      const showGrid = Boolean(result.grid?.columns?.length);
      await exportResultPdf({
        prompt: record.prompt || "",
        chartImages: [],
        textReport: result.text_report || "",
        grid: result.grid,
        showChart,
        showText,
        showGrid,
        language: result.language || record.language || "en",
        labels: pdfLabels,
        logoUrl: assetUrl("helix-logo.png"),
        companyLogoUrl: assetUrl("company-logo.png"),
        locale,
        design: loadPdfDesign(),
      });
    } catch (err) {
      setError(failMessage(err, t, "results.exportFailed"));
    }
  }

  async function handleDelete(item) {
    if (!window.confirm(t("results.deleteConfirm"))) return;
    setError(null);
    try {
      await deleteResult(item.id);
      await load();
    } catch (err) {
      setError(failMessage(err, t, "results.deleteFailed"));
    }
  }

  const rows = useMemo(
    () => items.map((item) => ({ key: item.id, item })),
    [items],
  );

  const columns = useMemo(
    () => [
      {
        key: "title",
        label: t("results.colTitle"),
        render: (item) => item.prompt || t("results.noPrompt"),
      },
      {
        key: "mode",
        label: t("results.colMode"),
        render: (item) => item.mode || t("common.noneDash"),
      },
      {
        key: "datetime",
        label: t("results.colDatetime"),
        render: (item) => (
          <span className="whitespace-nowrap font-sans text-[13px]">
            {formatDateTime(item.created_at, locale)}
          </span>
        ),
      },
      {
        key: "duration",
        label: t("results.colDuration"),
        render: (item) => (
          <span className="whitespace-nowrap font-sans text-[13px]">
            {formatDurationSeconds(item.duration_s) || t("common.noneDash")}
          </span>
        ),
      },
      {
        key: "show",
        label: t("results.colShow"),
        render: (item) => (
          <IconButton
            type="button"
            icon={Eye}
            onClick={() => navigate(`/results/${item.id}`)}
            className="rounded-lg border border-line bg-fog px-2 py-1.5 text-xs font-medium hover:bg-fog/80"
          >
            {t("results.show")}
          </IconButton>
        ),
      },
      {
        key: "export",
        label: t("results.colExport"),
        render: (item) => (
          <IconButton
            type="button"
            icon={FileDown}
            onClick={() => handleExport(item)}
            className="rounded-lg border border-line bg-fog px-2 py-1.5 text-xs font-medium hover:bg-fog/80"
          >
            {t("results.export")}
          </IconButton>
        ),
      },
      {
        key: "delete",
        label: t("results.colDelete"),
        render: (item) => (
          <IconButton
            type="button"
            icon={Trash2}
            onClick={() => handleDelete(item)}
            className="rounded-lg border border-warn-border bg-warn-bg px-2 py-1.5 text-xs font-medium text-warn hover:opacity-90"
          >
            {t("results.delete")}
          </IconButton>
        ),
      },
    ],
    [t, locale, navigate],
  );

  if (loading) {
    return <p className="text-sm text-muted">{t("results.loadingList")}</p>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <PageHeader icon={Play} title={t("results.title")}>
        <p className="mt-0.5 text-sm text-muted">{t("results.subtitle")}</p>
      </PageHeader>
      {error ? (
        <p className="rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
          {error}
        </p>
      ) : null}
      <DataGrid columns={columns} rows={rows} emptyLabel={t("results.empty")} />
    </div>
  );
}

function ResultDetail({ resultId }) {
  const chartRefs = useRef([]);
  const { t, locale } = useI18n();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState("");
  const [editedReport, setEditedReport] = useState("");

  const pdfLabels = useMemo(
    () => ({
      pdfAlert: t("results.pdfAlert"),
      pdfTitle: t("results.pdfTitle"),
      pdfHeading: t("results.pdfHeading"),
      pdfChartAlt: t("results.pdfChartAlt"),
      pdfLogoAlt: t("results.pdfLogoAlt"),
      pdfCompanyLogoAlt: t("results.pdfCompanyLogoAlt"),
      pdfFooter: t("results.pdfFooter"),
    }),
    [t],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchResult(resultId);
        if (cancelled) return;
        setRecord(data);
        setEditedPrompt(data.prompt || "");
        setEditedReport(data.payload?.text_report || "");
        setEditing(false);
      } catch (err) {
        if (!cancelled) {
          setRecord(null);
          setError(failMessage(err, t, "results.loadOneFailed"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resultId, t]);

  const result = record?.payload;
  const mode = record?.mode;
  const language = result?.language || record?.language || "en";

  const effectiveMode = normalizeMode(result?.mode || mode);
  const chartEntries = useMemo(() => resultChartEntries(result), [result]);
  const showChart =
    Boolean(result) &&
    (effectiveMode === "chart" ||
      effectiveMode === "analytical_report_chart" ||
      effectiveMode === "auto") &&
    chartEntries.length > 0;
  const showText =
    Boolean(result) &&
    (effectiveMode === "analytical_report" ||
      effectiveMode === "analytical_report_chart" ||
      effectiveMode === "auto") &&
    Boolean(result.text_report || editedReport);
  const showGrid =
    Boolean(result) &&
    effectiveMode === "grid" &&
    Boolean(result.grid?.columns?.length);

  const reportDir = resolveDir(language, editedReport || result?.text_report);
  const reportLang = reportDir === "rtl" ? "fa" : "en";
  const gridColumns = useMemo(
    () =>
      showGrid
        ? orderedGridColumns(result.grid.columns, language === "fa" ? "fa" : "en")
        : [],
    [showGrid, result, language],
  );

  if (loading) {
    return <p className="text-sm text-muted">{t("results.loadingDetail")}</p>;
  }

  if (error || !record || !result) {
    return (
      <div className="space-y-3">
        <PageHeader icon={Play} title={t("results.title")} backTo="/results" />
        <p className="rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
          {error || t("results.notFound")}
        </p>
        <Link
          to="/results"
          className="inline-flex items-center gap-2 rounded-xl border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-fog"
        >
          <ArrowLeft
            className="size-4 shrink-0 rtl:rotate-180"
            aria-hidden="true"
          />
          {t("results.backToList")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto">
      <PageHeader
        icon={Play}
        title={t("results.title")}
        backTo="/results"
        actions={
          <>
            {showText ? (
              <IconButton
                type="button"
                icon={Pencil}
                onClick={() => setEditing((v) => !v)}
                className="rounded-xl border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-fog"
              >
                {editing ? t("results.done") : t("results.edit")}
              </IconButton>
            ) : null}
            {showChart || showText || showGrid ? (
              <IconButton
                type="button"
                icon={FileDown}
                onClick={async () => {
                  const instances = (chartRefs.current || [])
                    .map((ref) => ref?.getEchartsInstance?.())
                    .filter(Boolean);
                  await exportResultPdf({
                    prompt: editedPrompt,
                    chartInstances: instances,
                    textReport: editedReport,
                    grid: result.grid,
                    showChart,
                    showText,
                    showGrid,
                    language,
                    labels: pdfLabels,
                    logoUrl: assetUrl("helix-logo.png"),
                    companyLogoUrl: assetUrl("company-logo.png"),
                    locale,
                    design: loadPdfDesign(),
                  });
                }}
                className="rounded-xl border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-fog"
              >
                {t("results.exportPdf")}
              </IconButton>
            ) : null}
            <Link
              to="/results"
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-fog"
            >
              <History className="size-4 shrink-0" aria-hidden="true" />
              {t("results.history")}
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-fog"
            >
              <Plus className="size-4 shrink-0" aria-hidden="true" />
              {t("results.newPrompt")}
            </Link>
          </>
        }
      >
        {editing ? (
          <textarea
            value={editedPrompt}
            onChange={(e) => setEditedPrompt(e.target.value)}
            rows={2}
            className="mt-1 w-full max-w-2xl resize-y rounded-xl border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-moss focus:ring-2 focus:ring-moss/30"
          />
        ) : (
          <p className="mt-0.5 max-w-2xl text-sm text-muted line-clamp-2">
            {editedPrompt}
          </p>
        )}
      </PageHeader>

      <section className="space-y-3" aria-live="polite">
        {showChart
          ? chartEntries.map((entry, index) => (
              <div
                key={`${entry.chart_type}-${index}`}
                className="overflow-hidden rounded-2xl border border-line bg-paper/80 p-3 sm:p-4"
              >
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
                  {t("results.sectionChart")}
                  {chartEntries.length > 1
                    ? ` · ${entry.chart_type}`
                    : ""}
                </h2>
                <div dir="ltr">
                  <ReactECharts
                    ref={(el) => {
                      chartRefs.current[index] = el;
                    }}
                    option={withDarkChartColors(entry.option)}
                    style={{ height: 360, width: "100%" }}
                    notMerge
                    lazyUpdate
                  />
                </div>
              </div>
            ))
          : null}

        {showText ? (
          <article
            className="rounded-2xl border border-line bg-paper/80 px-5 py-4 text-[15px] leading-relaxed text-ink"
            dir={reportDir}
            lang={reportLang}
          >
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
              {t("results.sectionReport")}
            </h2>
            {editing ? (
              <textarea
                value={editedReport}
                onChange={(e) => setEditedReport(e.target.value)}
                rows={10}
                dir={reportDir}
                lang={reportLang}
                className="w-full resize-y rounded-xl border border-line bg-fog/40 px-3 py-2 text-[15px] leading-relaxed text-ink outline-none focus:border-moss focus:ring-2 focus:ring-moss/30"
              />
            ) : (
              <div className="whitespace-pre-wrap">{editedReport}</div>
            )}
          </article>
        ) : null}

        {showGrid ? (
          <div
            className="overflow-x-auto rounded-2xl border border-line bg-paper/80 p-3 sm:p-4"
            dir={language === "fa" ? "rtl" : "ltr"}
            lang={language === "fa" ? "fa" : "en"}
          >
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
              {t("results.sectionGrid")}
            </h2>
            <table className="w-full min-w-[20rem] border-collapse font-sans text-sm">
              <thead>
                <tr>
                  {gridColumns.map((col) => (
                    <th
                      key={col}
                      className="border border-line bg-fog/50 px-3 py-2 text-start font-semibold text-ink"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(result.grid.rows || []).map((row, idx) => (
                  <tr key={idx}>
                    {gridColumns.map((col) => (
                      <td
                        key={col}
                        className="border border-line px-3 py-1.5 text-ink"
                      >
                        {row?.[col] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {!showChart && !showText && !showGrid ? (
          <p className="rounded-xl border border-line bg-paper/80 px-4 py-3 text-sm text-muted">
            {t("results.emptyPayload")}
          </p>
        ) : null}
      </section>
    </div>
  );
}

export default function ResultsPage() {
  const { resultId } = useParams();
  if (resultId) return <ResultDetail resultId={resultId} />;
  return <ResultsList />;
}
