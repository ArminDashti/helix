import { useEffect, useMemo, useState } from "react";
import { FileDown, LayoutTemplate } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import IconButton from "../components/IconButton.jsx";
import { useI18n } from "../context/I18nContext.jsx";
import { fetchBranding } from "../api/client.js";
import { assetUrl } from "../utils/assetUrl.js";
import { buildPdfHtml, exportResultPdf } from "../lib/exportResultPdf.js";
import {
  DEFAULT_PDF_DESIGN,
  FONT_OPTIONS,
  loadPdfDesign,
  savePdfDesign,
} from "../lib/pdfDesign.js";

const SAMPLE_GRID = {
  columns: ["Region", "Revenue", "Units"],
  rows: [
    { Region: "North", Revenue: 420, Units: 12 },
    { Region: "South", Revenue: 310, Units: 9 },
    { Region: "East", Revenue: 510, Units: 15 },
    { Region: "West", Revenue: 280, Units: 7 },
  ],
};

const SAMPLE_GRID_FA = {
  columns: ["منطقه", "درآمد", "واحد"],
  rows: [
    { منطقه: "شمال", درآمد: 420, واحد: 12 },
    { منطقه: "جنوب", درآمد: 310, واحد: 9 },
    { منطقه: "شرق", درآمد: 510, واحد: 15 },
    { منطقه: "غرب", درآمد: 280, واحد: 7 },
  ],
};

const TOGGLE_KEYS = [
  { key: "showHeader", labelKey: "canvas.showHeader" },
  { key: "showHelixLogo", labelKey: "canvas.showHelixLogo" },
  { key: "showCompanyLogo", labelKey: "canvas.showCompanyLogo" },
  { key: "showTitle", labelKey: "canvas.showTitle" },
  { key: "showCharts", labelKey: "canvas.showCharts" },
  { key: "showText", labelKey: "canvas.showText" },
  { key: "showGrid", labelKey: "canvas.showGrid" },
  { key: "showFooter", labelKey: "canvas.showFooter" },
];

const inputClass =
  "mt-1 w-full rounded-xl border border-line bg-fog/40 px-3 py-2 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/30";

export default function CanvasPage() {
  const { t, locale } = useI18n();
  const [design, setDesign] = useState(() => loadPdfDesign());
  const [previewHtml, setPreviewHtml] = useState("");
  const [saving, setSaving] = useState(false);
  const [logoError, setLogoError] = useState(null);

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

  const samplePrompt = t("canvas.samplePrompt");
  const sampleReport = t("canvas.sampleReport");
  const sampleGrid = locale === "fa" ? SAMPLE_GRID_FA : SAMPLE_GRID;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const logoDataUrl = await fetch(assetUrl("helix-logo.png"))
        .then((r) => (r.ok ? r.blob() : null))
        .then(
          (blob) =>
            new Promise((resolve) => {
              if (!blob) return resolve("");
              const reader = new FileReader();
              reader.onloadend = () =>
                resolve(
                  typeof reader.result === "string" ? reader.result : "",
                );
              reader.readAsDataURL(blob);
            }),
        )
        .catch(() => "");

      let companyLogoDataUrl = design.companyLogoDataUrl || "";
      if (!companyLogoDataUrl) {
        try {
          const branding = await fetchBranding();
          companyLogoDataUrl =
            branding?.branding?.company_logo_data_url || "";
        } catch {
          companyLogoDataUrl = "";
        }
      }
      if (!companyLogoDataUrl) {
        companyLogoDataUrl = await fetch(assetUrl("company-logo.png"))
          .then((r) => (r.ok ? r.blob() : null))
          .then(
            (blob) =>
              new Promise((resolve) => {
                if (!blob) return resolve("");
                const reader = new FileReader();
                reader.onloadend = () =>
                  resolve(
                    typeof reader.result === "string" ? reader.result : "",
                  );
                reader.readAsDataURL(blob);
              }),
          )
          .catch(() => "");
      }
      if (cancelled) return;
      const { html } = buildPdfHtml({
        prompt: samplePrompt,
        textReport: sampleReport,
        grid: sampleGrid,
        chartImages: [],
        language: locale === "fa" ? "fa" : "en",
        labels: pdfLabels,
        logoDataUrl,
        companyLogoDataUrl,
        design,
      });
      setPreviewHtml(html);
    })();
    return () => {
      cancelled = true;
    };
  }, [design, locale, samplePrompt, sampleReport, sampleGrid, pdfLabels]);

  function updatePref(key, value) {
    setDesign((prev) => {
      const next = { ...prev, [key]: value };
      savePdfDesign(next);
      return next;
    });
  }

  function handleLogoFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setLogoError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLogoError(t("canvas.logoInvalid"));
      return;
    }
    if (file.size > 250_000) {
      setLogoError(t("canvas.logoTooLarge"));
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl =
        typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl) {
        setLogoError(t("canvas.logoInvalid"));
        return;
      }
      updatePref("companyLogoDataUrl", dataUrl);
    };
    reader.onerror = () => setLogoError(t("canvas.logoInvalid"));
    reader.readAsDataURL(file);
  }

  async function handleExportSample() {
    setSaving(true);
    try {
      await exportResultPdf({
        prompt: samplePrompt,
        textReport: sampleReport,
        grid: sampleGrid,
        chartImages: [],
        showChart: false,
        showText: true,
        showGrid: true,
        language: locale === "fa" ? "fa" : "en",
        labels: pdfLabels,
        logoUrl: assetUrl("helix-logo.png"),
        companyLogoUrl: design.companyLogoDataUrl
          ? ""
          : assetUrl("company-logo.png"),
        locale,
        design,
      });
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    const next = { ...DEFAULT_PDF_DESIGN };
    savePdfDesign(next);
    setDesign(next);
    setLogoError(null);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto">
      <PageHeader icon={LayoutTemplate} title={t("canvas.title")}>
        <p className="mt-0.5 text-sm text-muted">{t("canvas.subtitle")}</p>
      </PageHeader>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(16rem,22rem)_1fr]">
        <aside className="space-y-3 rounded-2xl border border-line/80 bg-paper/80 p-4">
          <h2 className="text-sm font-semibold text-ink">
            {t("canvas.options")}
          </h2>
          <ul className="space-y-2">
            {TOGGLE_KEYS.map((item) => (
              <li key={item.key}>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    className="accent-moss"
                    checked={Boolean(design[item.key])}
                    onChange={(e) => updatePref(item.key, e.target.checked)}
                  />
                  {t(item.labelKey)}
                </label>
              </li>
            ))}
          </ul>

          <div>
            <label
              htmlFor="pdf_orientation"
              className="block text-sm font-medium text-ink"
            >
              {t("canvas.orientation")}
            </label>
            <select
              id="pdf_orientation"
              value={design.orientation || "landscape"}
              onChange={(e) => updatePref("orientation", e.target.value)}
              className={inputClass}
            >
              <option value="landscape">{t("canvas.landscape")}</option>
              <option value="portrait">{t("canvas.portrait")}</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="pdf_border_width"
              className="block text-sm font-medium text-ink"
            >
              {t("canvas.borderThickness")}
            </label>
            <input
              id="pdf_border_width"
              type="number"
              min={0}
              max={8}
              value={design.borderWidthPx ?? 1}
              onChange={(e) =>
                updatePref("borderWidthPx", Number(e.target.value))
              }
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="pdf_border_radius"
              className="block text-sm font-medium text-ink"
            >
              {t("canvas.borderCorner")}
            </label>
            <input
              id="pdf_border_radius"
              type="number"
              min={0}
              max={24}
              value={design.borderRadiusPx ?? 14}
              onChange={(e) =>
                updatePref("borderRadiusPx", Number(e.target.value))
              }
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="pdf_font"
              className="block text-sm font-medium text-ink"
            >
              {t("canvas.font")}
            </label>
            <select
              id="pdf_font"
              value={design.fontFamily || DEFAULT_PDF_DESIGN.fontFamily}
              onChange={(e) => updatePref("fontFamily", e.target.value)}
              className={inputClass}
            >
              {FONT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="pdf_company_logo"
              className="block text-sm font-medium text-ink"
            >
              {t("canvas.changeLogo")}
            </label>
            <input
              id="pdf_company_logo"
              type="file"
              accept="image/*"
              onChange={handleLogoFile}
              className="mt-1 block w-full text-sm text-ink file:me-2 file:rounded-lg file:border-0 file:bg-moss file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
            />
            {design.companyLogoDataUrl ? (
              <button
                type="button"
                onClick={() => updatePref("companyLogoDataUrl", "")}
                className="mt-2 text-xs font-medium text-moss hover:underline"
              >
                {t("canvas.clearLogo")}
              </button>
            ) : null}
            {logoError ? (
              <p className="mt-1 text-xs text-warn">{logoError}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <IconButton
              type="button"
              icon={FileDown}
              disabled={saving}
              onClick={handleExportSample}
              className="rounded-xl bg-moss px-4 py-2 text-sm font-semibold text-white hover:bg-moss-deep disabled:opacity-60"
            >
              {t("canvas.exportSample")}
            </IconButton>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-xl border border-line bg-fog px-4 py-2 text-sm font-medium text-ink hover:bg-fog/80"
            >
              {t("canvas.reset")}
            </button>
          </div>
        </aside>

        <div className="min-h-0 overflow-auto rounded-2xl border border-line/80 bg-fog/30 p-3">
          <h2 className="mb-2 text-sm font-semibold text-ink">
            {t("canvas.preview")}
          </h2>
          <div
            className="overflow-auto rounded-xl border border-line bg-white p-2 shadow-sm"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </div>
      </div>
    </div>
  );
}
