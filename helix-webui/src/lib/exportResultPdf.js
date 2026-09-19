import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import * as echarts from "echarts";
import { fetchBranding } from "../api/client.js";
import { formatDateTime } from "../i18n/format.js";
import { hasPersianScript } from "../utils/textDirection.js";
import {
  DEFAULT_PDF_DESIGN,
  elementStyle,
  loadPdfDesign,
  normalizePdfDesign,
  orderedGridColumns,
} from "./pdfDesign.js";

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

/** Sample bar chart PNG for Canvas preview / sample PDF export. */
export function renderSampleChartDataUrl(language = "en") {
  const cats =
    language === "fa"
      ? ["شمال", "جنوب", "شرق", "غرب"]
      : ["North", "South", "East", "West"];
  const title =
    language === "fa" ? "درآمد بر اساس منطقه" : "Revenue by region";
  const seriesName = language === "fa" ? "درآمد" : "Revenue";
  const el = document.createElement("div");
  el.style.width = "640px";
  el.style.height = "320px";
  el.style.position = "absolute";
  el.style.left = "-9999px";
  el.style.top = "0";
  document.body.appendChild(el);
  let chart;
  try {
    chart = echarts.init(el, null, {
      renderer: "canvas",
      width: 640,
      height: 320,
    });
    chart.setOption({
      color: ["#3d9b82"],
      backgroundColor: "#fafcfb",
      title: {
        text: title,
        left: "center",
        textStyle: { color: "#111111", fontWeight: 600, fontSize: 14 },
      },
      grid: { left: 48, right: 24, top: 48, bottom: 36 },
      xAxis: {
        type: "category",
        data: cats,
        axisLabel: { color: "#445"},
      },
      yAxis: {
        type: "value",
        axisLabel: { color: "#445" },
        splitLine: { lineStyle: { color: "#e5eeea" } },
      },
      series: [
        {
          name: seriesName,
          type: "bar",
          data: [420, 310, 510, 280],
          barWidth: "48%",
          itemStyle: { borderRadius: [6, 6, 0, 0] },
        },
      ],
    });
    return chart.getDataURL({
      type: "png",
      pixelRatio: 2,
      backgroundColor: "#fafcfb",
    });
  } catch {
    return "";
  } finally {
    try {
      chart?.dispose();
    } catch {
      /* ignore */
    }
    el.remove();
  }
}

function cssBox(el) {
  const bw = el.borderWidthPx || 0;
  const border =
    bw > 0 ? `${bw}px solid ${el.color === "#111111" ? "#3d9b82" : el.color}` : "none";
  return `padding:${el.paddingPx}px;border:${border};border-radius:${el.borderRadiusPx}px;background:${el.backgroundColor};color:${el.color};font-family:${el.fontFamily};font-size:${el.fontSizePx}px;box-sizing:border-box;`;
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
  footerSampleText = "",
}) {
  const prefs = normalizePdfDesign(design);
  const dir = resolveDir(language, textReport || prompt);
  const lang = dir === "rtl" ? "fa" : "en";
  const safeReport = escapeHtml(textReport);
  const safeLogoUrl = escapeHtml(logoDataUrl);
  const safeCompanyLogoUrl = escapeHtml(companyLogoDataUrl);
  const reportTitle = escapeHtml((prompt || "").trim() || labels.pdfHeading);

  const headerEl = elementStyle(prefs, "header");
  const helixEl = elementStyle(prefs, "helixLogo");
  const companyEl = elementStyle(prefs, "companyLogo");
  const titleEl = elementStyle(prefs, "title");
  const chartsEl = elementStyle(prefs, "charts");
  const textEl = elementStyle(prefs, "text");
  const gridEl = elementStyle(prefs, "grid");
  const footerEl = elementStyle(prefs, "footer");

  const logoImgInline =
    headerEl.visible && helixEl.visible && safeLogoUrl
      ? `<div data-canvas-element="helixLogo" style="${cssBox(helixEl)}display:flex;align-items:center;"><img style="height:56px;width:auto;max-width:160px;object-fit:contain;" src="${safeLogoUrl}" alt="${escapeHtml(labels.pdfLogoAlt)}" /></div>`
      : "";
  const companyLogoImgInline =
    headerEl.visible && companyEl.visible && safeCompanyLogoUrl
      ? `<div data-canvas-element="companyLogo" style="${cssBox(companyEl)}display:flex;align-items:center;justify-content:flex-end;"><img style="height:56px;width:auto;max-width:160px;object-fit:contain;" src="${safeCompanyLogoUrl}" alt="${escapeHtml(labels.pdfCompanyLogoAlt)}" /></div>`
      : "";
  const titleInline =
    headerEl.visible && titleEl.visible
      ? `<div data-canvas-element="title" style="${cssBox(titleEl)}flex:1;text-align:center;font-weight:600;line-height:1.7;white-space:normal;" dir="${dir}"><h1 style="margin:0;font:inherit;font-size:inherit;font-weight:inherit;">${reportTitle}</h1></div>`
      : "";

  const headerInner = [logoImgInline, titleInline, companyLogoImgInline]
    .filter(Boolean)
    .join("");
  const headerInline =
    headerEl.visible && headerInner
      ? `<div data-canvas-element="header" style="${cssBox(headerEl)}display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0 0 14px 0;direction:ltr;">${headerInner}</div>`
      : headerEl.visible
        ? `<div data-canvas-element="header" style="${cssBox(headerEl)}display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0 0 14px 0;direction:ltr;min-height:1px;"></div>`
        : "";

  const chartImgInline =
    chartsEl.visible && chartImages.length
      ? `<div data-canvas-element="charts" style="${cssBox(chartsEl)}">${chartImages
          .filter(Boolean)
          .map(
            (src) =>
              `<div style="margin-bottom:14px;"><img style="max-width:100%;height:auto;display:block;border-radius:${chartsEl.borderRadiusPx}px;" src="${src}" alt="${escapeHtml(labels.pdfChartAlt)}" /></div>`,
          )
          .join("")}</div>`
      : chartsEl.visible
        ? `<div data-canvas-element="charts" style="${cssBox(chartsEl)}min-height:8px;"></div>`
        : "";

  const articleInline =
    textEl.visible && textReport
      ? `<div data-canvas-element="text" style="${cssBox(textEl)}white-space:pre-wrap;line-height:1.6;margin-bottom:14px;" dir="${dir}">${safeReport}</div>`
      : textEl.visible
        ? `<div data-canvas-element="text" style="${cssBox(textEl)}min-height:8px;margin-bottom:14px;"></div>`
        : "";

  let gridInline = "";
  if (gridEl.visible && grid?.columns?.length) {
    const cols = orderedGridColumns(grid.columns, language === "fa" ? "fa" : dir);
    const rows = grid.rows || [];
    const thBorder =
      gridEl.borderWidthPx > 0
        ? `${gridEl.borderWidthPx}px solid #1e3a5f`
        : "none";
    const tdBorder =
      gridEl.borderWidthPx > 0
        ? `${gridEl.borderWidthPx}px solid #cfe6dd`
        : "none";
    const headerCells = cols
      .map(
        (c) =>
          `<th style="border:${thBorder};padding:${gridEl.paddingPx}px;text-align:center;font-weight:600;">${escapeHtml(c)}</th>`,
      )
      .join("");
    const bodyRows = rows
      .map(
        (row, i) =>
          `<tr>${cols
            .map(
              (c) =>
                `<td style="border:${tdBorder};padding:${gridEl.paddingPx}px;text-align:center;${i % 2 === 1 ? "background:#eef7f4;" : ""}">${escapeHtml(row?.[c])}</td>`,
            )
            .join("")}</tr>`,
      )
      .join("");
    gridInline = `<div data-canvas-element="grid" style="${cssBox(gridEl)}"><table style="width:100%;border-collapse:collapse;font-family:${gridEl.fontFamily};font-size:${gridEl.fontSizePx}px;color:${gridEl.color};" dir="${dir}"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table></div>`;
  } else if (gridEl.visible) {
    gridInline = `<div data-canvas-element="grid" style="${cssBox(gridEl)}min-height:8px;"></div>`;
  }

  const footerText = escapeHtml(
    (typeof prefs.footerText === "string" && prefs.footerText.trim()) ||
      footerSampleText ||
      labels.pdfFooter ||
      "",
  );
  const footerBorder =
    footerEl.borderWidthPx > 0
      ? `${footerEl.borderWidthPx}px solid #1e3a5f`
      : "none";
  const footerInline = footerEl.visible
    ? `<div data-canvas-element="footer" style="${cssBox(footerEl)}margin-top:14px;border-top:${footerBorder};text-align:center;">${footerText}</div>`
    : "";

  const rootFont = elementStyle(prefs, "text");
  return {
    html: `<div style="font-family:${rootFont.fontFamily};color:#111;background:#fff;padding:16px;box-sizing:border-box;">${headerInline}${chartImgInline}${articleInline}${gridInline}${footerInline}</div>`,
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
  const prefs = normalizePdfDesign(design || loadPdfDesign());
  if (showChart === false) {
    prefs.elements.charts = { ...prefs.elements.charts, visible: false };
  }
  if (showText === false) {
    prefs.elements.text = { ...prefs.elements.text, visible: false };
  }
  if (showGrid === false) {
    prefs.elements.grid = { ...prefs.elements.grid, visible: false };
  }

  const instances = Array.isArray(chartInstances)
    ? chartInstances
    : chartInstance
      ? [chartInstance]
      : [];
  let chartImages = Array.isArray(providedImages) ? [...providedImages] : [];
  if (!chartImages.length && elementStyle(prefs, "charts").visible) {
    chartImages = instances.map(chartDataUrlFromInstance).filter(Boolean);
  }

  const exportedAt = formatDateTime(new Date(), locale || "en");
  const [logoDataUrl, companyLogoDataUrl] = await Promise.all([
    loadLogoDataUrl(logoUrl),
    resolveCompanyLogoDataUrl(prefs, companyLogoUrl),
  ]);

  await ensurePdfFonts();

  const footerLabel =
    (typeof prefs.footerText === "string" && prefs.footerText.trim()) ||
    labels.pdfFooter ||
    "";

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
    footerSampleText: footerLabel,
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

  const footerVisible = elementStyle(prefs, "footer").visible;

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
    const FOOTER_H = footerVisible ? 10 : 0;
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

      if (footerVisible) {
        const footerStyle = elementStyle(prefs, "footer");
        const barY = A4_H - FOOTER_H;
        const textY = barY + 6.5;
        if (footerStyle.borderWidthPx > 0) {
          pdf.setDrawColor(30, 58, 95);
          pdf.setLineWidth(Math.min(0.8, footerStyle.borderWidthPx * 0.25));
          pdf.line(MARGIN, barY, A4_W - MARGIN, barY);
        }
        pdf.setTextColor(17, 17, 17);
        pdf.setFontSize(footerStyle.fontSizePx || 9);
        pdf.text(exportedAt, MARGIN, textY, { align: "left" });
        pdf.text(footerLabel, A4_W / 2, textY, { align: "center" });
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
