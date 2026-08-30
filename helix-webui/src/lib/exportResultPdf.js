import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { fetchBranding } from "../api/client.js";
import { formatDateTime } from "../i18n/format.js";
import { hasPersianScript } from "../utils/textDirection.js";
import { DEFAULT_PDF_DESIGN, loadPdfDesign, orderedGridColumns } from "./pdfDesign.js";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function resolveDir(language, text) {
  if (language === "fa") return "rtl";
  if (language === "en") return "ltr";
  return hasPersianScript(text) ? "rtl" : "ltr";
}

async function loadLogoDataUrl(url) {
  if (!url) return "";
  if (String(url).startsWith("data:")) return String(url);
  try {
    const response = await fetch(url);
    if (!response.ok) return "";
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () =>
        resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => resolve("");
      reader.readAsDataURL(blob);
    });
  } catch {
    return "";
  }
}

async function resolveCompanyLogoDataUrl(prefs, companyLogoUrl) {
  if (prefs?.companyLogoDataUrl) return prefs.companyLogoDataUrl;
  try {
    const data = await fetchBranding();
    const fromSettings = data?.branding?.company_logo_data_url;
    if (fromSettings) return fromSettings;
  } catch {
    /* fall through */
  }
  return loadLogoDataUrl(companyLogoUrl);
}

async function ensurePdfFonts() {
  try {
    const id = "helix-pdf-vazirmatn";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;600&display=swap";
      document.head.appendChild(link);
    }
    await (document.fonts?.ready || Promise.resolve());
    await new Promise((r) => setTimeout(r, 300));
  } catch {
    /* best-effort */
  }
}

function chartDataUrlFromInstance(instance) {
  if (!instance) return "";
  try {
    return instance.getDataURL({
      type: "png",
      pixelRatio: 2,
      backgroundColor: "#fafcfb",
    });
  } catch {
    return "";
  }
}

/**
 * Build HTML for PDF / design preview.
 * @param {object} opts
 * @param {string[]} [opts.chartImages] data URLs
 * @param {object} [opts.design] PDF design prefs
 */
export function buildPdfHtml({
  prompt,
  textReport,
  grid,
  chartImages = [],
  language,
  labels,
  logoDataUrl = "",
  companyLogoDataUrl = "",
  design = DEFAULT_PDF_DESIGN,
}) {
  const prefs = { ...DEFAULT_PDF_DESIGN, ...design };
  const dir = resolveDir(language, textReport || prompt);
  const lang = dir === "rtl" ? "fa" : "en";
  const safeReport = escapeHtml(textReport);
  const safeLogoUrl = escapeHtml(logoDataUrl);
  const safeCompanyLogoUrl = escapeHtml(companyLogoDataUrl);
  const reportTitle = escapeHtml((prompt || "").trim() || labels.pdfHeading);

  const borderW = Math.min(
    8,
    Math.max(0, Number(prefs.borderWidthPx) || 0),
  );
  const radius = Math.min(
    24,
    Math.max(0, Number(prefs.borderRadiusPx) || 0),
  );
  const fontFamily =
    String(prefs.fontFamily || DEFAULT_PDF_DESIGN.fontFamily).trim() ||
    DEFAULT_PDF_DESIGN.fontFamily;
  const headerBorder = borderW > 0 ? `${borderW}px solid #1e3a5f` : "none";
  const accentBorder =
    borderW > 0 ? `${Math.max(borderW, 1)}px solid #3d9b82` : "none";
  const articleBorder =
    borderW > 0 ? `${Math.max(borderW + 1, 2)}px solid #3d9b82` : "none";
  const cellBorder = borderW > 0 ? `${borderW}px solid #cfe6dd` : "none";
  const thBorder = borderW > 0 ? `${borderW}px solid #1e3a5f` : "none";

  const S = {
    root: `font-family:${fontFamily};color:#111;background:#fff;padding:16px;box-sizing:border-box;`,
    header: `display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0 0 14px 0;padding:14px 12px;border:${headerBorder};background:transparent;direction:ltr;`,
    headerSide: `flex:0 0 168px;display:flex;align-items:center;`,
    headerCenter: `flex:1 1 auto;min-width:0;`,
    logo: `height:56px;width:auto;max-width:160px;object-fit:contain;`,
    title: `text-align:center;font-size:16px;font-weight:600;margin:0;color:#111;line-height:1.7;overflow:visible;white-space:normal;`,
    chartWrap: `margin-bottom:14px;`,
    chart: `max-width:100%;height:auto;border:${accentBorder};border-radius:${radius}px;display:block;`,
    article: `margin-bottom:14px;padding:14px 16px;border:${articleBorder};border-radius:${radius}px;background:#f6fbf9;white-space:pre-wrap;line-height:1.6;font-size:14px;`,
    table: `width:100%;border-collapse:collapse;margin-top:14px;font-size:13px;line-height:1.8;`,
    th: `border:${thBorder};padding:14px 10px;text-align:center;vertical-align:middle;background:transparent;color:#111;font-weight:600;line-height:1.8;overflow:visible;`,
    td: `border:${cellBorder};padding:12px 10px;text-align:center;vertical-align:middle;line-height:1.8;`,
    tdEven: `border:${cellBorder};padding:12px 10px;text-align:center;vertical-align:middle;line-height:1.8;background:#eef7f4;`,
  };

  const logoImgInline =
    prefs.showHeader && prefs.showHelixLogo && safeLogoUrl
      ? `<img style="${S.logo}" src="${safeLogoUrl}" alt="${escapeHtml(labels.pdfLogoAlt)}" />`
      : "";
  const companyLogoImgInline =
    prefs.showHeader && prefs.showCompanyLogo && safeCompanyLogoUrl
      ? `<img style="${S.logo}" src="${safeCompanyLogoUrl}" alt="${escapeHtml(labels.pdfCompanyLogoAlt)}" />`
      : "";
  const titleInline =
    prefs.showHeader && prefs.showTitle
      ? `<h1 style="${S.title}" dir="${dir}">${reportTitle}</h1>`
      : "";
  const headerInline = prefs.showHeader
    ? `<div style="${S.header}">
        <div style="${S.headerSide}justify-content:flex-start;">${logoImgInline}</div>
        <div style="${S.headerCenter}">${titleInline}</div>
        <div style="${S.headerSide}justify-content:flex-end;">${companyLogoImgInline}</div>
      </div>`
    : "";

  const chartImgInline =
    prefs.showCharts && chartImages.length
      ? chartImages
          .filter(Boolean)
          .map(
            (src) =>
              `<div style="${S.chartWrap}"><img style="${S.chart}" src="${src}" alt="${escapeHtml(labels.pdfChartAlt)}" /></div>`,
          )
          .join("")
      : "";

  const articleInline =
    prefs.showText && textReport
      ? `<div style="${S.article}" dir="${dir}">${safeReport}</div>`
      : "";

  let gridInline = "";
  if (prefs.showGrid && grid?.columns?.length) {
    const cols = orderedGridColumns(grid.columns, language === "fa" ? "fa" : dir);
    const rows = grid.rows || [];
    const headerCells = cols
      .map((c) => `<th style="${S.th}">${escapeHtml(c)}</th>`)
      .join("");
    const bodyRows = rows
      .map(
        (row, i) =>
          `<tr>${cols
            .map(
              (c) =>
                `<td style="${i % 2 === 1 ? S.tdEven : S.td}">${escapeHtml(row?.[c])}</td>`,
            )
            .join("")}</tr>`,
      )
      .join("");
    gridInline = `<table style="${S.table}" dir="${dir}"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
  }

  return {
    html: `<div style="${S.root}">${headerInline}${chartImgInline}${articleInline}${gridInline}</div>`,
    dir,
    lang,
  };
}

/**
 * Export a result to PDF using design prefs and optional chart images / instances.
 */
export async function exportResultPdf({
  prompt,
  chartInstance,
  chartInstances,
  chartImages: providedImages,
  textReport,
  grid,
  showChart,
  showText,
  showGrid,
  language,
  labels,
  logoUrl,
  companyLogoUrl,
  locale,
  design,
  openWindow = true,
}) {
  const prefs = { ...DEFAULT_PDF_DESIGN, ...(design || loadPdfDesign()) };
  if (showChart === false) prefs.showCharts = false;
  if (showText === false) prefs.showText = false;
  if (showGrid === false) prefs.showGrid = false;

  const instances = Array.isArray(chartInstances)
    ? chartInstances
    : chartInstance
      ? [chartInstance]
      : [];
  let chartImages = Array.isArray(providedImages) ? [...providedImages] : [];
  if (!chartImages.length && prefs.showCharts) {
    chartImages = instances.map(chartDataUrlFromInstance).filter(Boolean);
  }

  const exportedAt = formatDateTime(new Date(), locale || "en");
  const [logoDataUrl, companyLogoDataUrl] = await Promise.all([
    loadLogoDataUrl(logoUrl),
    resolveCompanyLogoDataUrl(prefs, companyLogoUrl),
  ]);

  await ensurePdfFonts();

  const { html, dir, lang } = buildPdfHtml({
    prompt,
    textReport,
    grid,
    chartImages,
    language,
    labels,
    logoDataUrl,
    companyLogoDataUrl,
    design: prefs,
  });

  const orientation =
    prefs.orientation === "portrait" ? "portrait" : "landscape";
  const element = document.createElement("div");
  element.style.position = "absolute";
  element.style.left = "-9999px";
  element.style.top = "0";
  element.style.width = orientation === "portrait" ? "794px" : "1123px";
  element.style.background = "#ffffff";
  element.setAttribute("dir", dir);
  element.setAttribute("lang", lang);
  element.innerHTML = html;
  document.body.appendChild(element);

  try {
    await new Promise((r) => requestAnimationFrame(r));
    await new Promise((r) => requestAnimationFrame(r));

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });

    const A4_W = orientation === "portrait" ? 210 : 297;
    const A4_H = orientation === "portrait" ? 297 : 210;
    const MARGIN = 12;
    const FOOTER_H = prefs.showFooter ? 10 : 0;
    const contentW = A4_W - MARGIN * 2;
    const contentH = A4_H - MARGIN - FOOTER_H - MARGIN;
    const imgW = canvas.width;
    const imgH = canvas.height;
    const mmPerPx = contentW / (imgW / 2);
    const totalImgH_mm = (imgH / 2) * mmPerPx;
    const pdf = new jsPDF({
      unit: "mm",
      format: "a4",
      orientation,
    });

    let yRemaining = totalImgH_mm;
    let srcY = 0;
    let pageNum = 0;
    const totalPages = Math.max(1, Math.ceil(totalImgH_mm / contentH));

    while (yRemaining > 0) {
      if (pageNum > 0) pdf.addPage();
      pageNum++;
      const sliceH_mm = Math.min(yRemaining, contentH);
      const sliceH_px = Math.round((sliceH_mm / mmPerPx) * 2);
      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = imgW;
      sliceCanvas.height = sliceH_px;
      const ctx = sliceCanvas.getContext("2d");
      ctx.drawImage(canvas, 0, srcY, imgW, sliceH_px, 0, 0, imgW, sliceH_px);
      const sliceDataUrl = sliceCanvas.toDataURL("image/jpeg", 0.95);
      pdf.addImage(sliceDataUrl, "JPEG", MARGIN, MARGIN, contentW, sliceH_mm);

      if (prefs.showFooter) {
        const barY = A4_H - FOOTER_H;
        const textY = barY + 6.5;
        pdf.setDrawColor(30, 58, 95);
        pdf.setLineWidth(0.3);
        pdf.line(MARGIN, barY, A4_W - MARGIN, barY);
        pdf.setTextColor(17, 17, 17);
        pdf.setFontSize(9);
        pdf.text(exportedAt, MARGIN, textY, { align: "left" });
        pdf.text(labels.pdfFooter, A4_W / 2, textY, { align: "center" });
        pdf.text(`${pageNum}/${totalPages}`, A4_W - MARGIN, textY, {
          align: "right",
        });
      }

      srcY += sliceH_px;
      yRemaining -= sliceH_mm;
    }

    const blobUrl = pdf.output("bloburl");
    if (openWindow) window.open(blobUrl, "_blank");
    return blobUrl;
  } catch (err) {
    console.error("PDF export failed:", err);
    if (labels?.pdfAlert) window.alert(labels.pdfAlert);
    throw err;
  } finally {
    element.remove();
  }
}

/** Resolve chart option list from a result payload. */
export function resultChartEntries(result) {
  if (!result) return [];
  if (Array.isArray(result.echarts_options) && result.echarts_options.length) {
    return result.echarts_options
      .map((item) => ({
        chart_type: item?.chart_type || "chart",
        option: item?.option,
      }))
      .filter((item) => item.option);
  }
  if (result.echarts_option) {
    return [
      {
        chart_type: result.chart_type || "chart",
        option: result.echarts_option,
      },
    ];
  }
  return [];
}
