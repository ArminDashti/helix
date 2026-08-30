/** PDF / Canvas design prefs (localStorage). */

export const PDF_DESIGN_STORAGE_KEY = "helix-pdf-design";

export const FONT_OPTIONS = [
  { value: "Vazirmatn,system-ui,sans-serif", labelKey: "canvas.fontVazirmatn" },
  { value: "system-ui,sans-serif", labelKey: "canvas.fontSystem" },
  { value: "Georgia,serif", labelKey: "canvas.fontGeorgia" },
  { value: '"Times New Roman",Times,serif', labelKey: "canvas.fontTimes" },
  { value: "Arial,Helvetica,sans-serif", labelKey: "canvas.fontArial" },
];

export const DEFAULT_PDF_DESIGN = {
  showHeader: true,
  showHelixLogo: true,
  showCompanyLogo: true,
  showTitle: true,
  showCharts: true,
  showText: true,
  showGrid: true,
  showFooter: true,
  orientation: "landscape",
  borderWidthPx: 1,
  borderRadiusPx: 14,
  fontFamily: "Vazirmatn,system-ui,sans-serif",
  companyLogoDataUrl: "",
};

const MAX_LOGO_DATA_URL_CHARS = 400_000;

export function loadPdfDesign() {
  try {
    const raw = localStorage.getItem(PDF_DESIGN_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PDF_DESIGN };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PDF_DESIGN, ...parsed };
  } catch {
    return { ...DEFAULT_PDF_DESIGN };
  }
}

export function savePdfDesign(prefs) {
  const next = { ...DEFAULT_PDF_DESIGN, ...prefs };
  if (
    typeof next.companyLogoDataUrl === "string" &&
    next.companyLogoDataUrl.length > MAX_LOGO_DATA_URL_CHARS
  ) {
    next.companyLogoDataUrl = "";
  }
  const bw = Number(next.borderWidthPx);
  next.borderWidthPx = Number.isFinite(bw)
    ? Math.min(8, Math.max(0, Math.round(bw)))
    : DEFAULT_PDF_DESIGN.borderWidthPx;
  const br = Number(next.borderRadiusPx);
  next.borderRadiusPx = Number.isFinite(br)
    ? Math.min(24, Math.max(0, Math.round(br)))
    : DEFAULT_PDF_DESIGN.borderRadiusPx;
  localStorage.setItem(PDF_DESIGN_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function orderedGridColumns(columns, language) {
  const cols = Array.isArray(columns) ? [...columns] : [];
  if (language === "fa" || language === "rtl") {
    return cols.reverse();
  }
  return cols;
}
