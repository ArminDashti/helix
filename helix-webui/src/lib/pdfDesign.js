/** PDF / Canvas design prefs (localStorage). */

export const PDF_DESIGN_STORAGE_KEY = "helix-pdf-design";

export const FONT_OPTIONS = [
  { value: "Vazirmatn,system-ui,sans-serif", labelKey: "canvas.fontVazirmatn" },
  { value: "system-ui,sans-serif", labelKey: "canvas.fontSystem" },
  { value: "Georgia,serif", labelKey: "canvas.fontGeorgia" },
  { value: '"Times New Roman",Times,serif', labelKey: "canvas.fontTimes" },
  { value: "Arial,Helvetica,sans-serif", labelKey: "canvas.fontArial" },
];

export const PDF_ELEMENT_IDS = [
  "header",
  "helixLogo",
  "companyLogo",
  "title",
  "charts",
  "text",
  "grid",
  "footer",
];

const BASE_FONT = "Vazirmatn,system-ui,sans-serif";

function createElementStyle(overrides = {}) {
  return {
    visible: true,
    fontFamily: BASE_FONT,
    fontSizePx: 14,
    color: "#111111",
    backgroundColor: "transparent",
    borderWidthPx: 1,
    borderRadiusPx: 14,
    paddingPx: 14,
    ...overrides,
  };
}

export function defaultElements() {
  return {
    header: createElementStyle({ paddingPx: 14, borderWidthPx: 1 }),
    helixLogo: createElementStyle({ paddingPx: 8, fontSizePx: 14 }),
    companyLogo: createElementStyle({ paddingPx: 8, fontSizePx: 14 }),
    title: createElementStyle({
      fontSizePx: 16,
      paddingPx: 8,
      backgroundColor: "transparent",
    }),
    charts: createElementStyle({ paddingPx: 0, borderRadiusPx: 14 }),
    text: createElementStyle({
      fontSizePx: 14,
      backgroundColor: "#f6fbf9",
      borderRadiusPx: 14,
      paddingPx: 16,
    }),
    grid: createElementStyle({ fontSizePx: 13, paddingPx: 8 }),
    footer: createElementStyle({
      fontSizePx: 9,
      paddingPx: 4,
      borderWidthPx: 0,
    }),
  };
}

export const DEFAULT_PDF_DESIGN = {
  orientation: "landscape",
  companyLogoDataUrl: "",
  elements: defaultElements(),
};

const MAX_LOGO_DATA_URL_CHARS = 400_000;

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function mergeElement(id, partial) {
  const base = defaultElements()[id] || createElementStyle();
  if (!partial || typeof partial !== "object") return { ...base };
  return {
    ...base,
    ...partial,
    visible:
      partial.visible !== undefined ? Boolean(partial.visible) : base.visible,
    fontFamily: String(partial.fontFamily ?? base.fontFamily).trim() || base.fontFamily,
    fontSizePx: clampInt(partial.fontSizePx, 8, 48, base.fontSizePx),
    color: String(partial.color ?? base.color),
    backgroundColor: String(partial.backgroundColor ?? base.backgroundColor),
    borderWidthPx: clampInt(partial.borderWidthPx, 0, 8, base.borderWidthPx),
    borderRadiusPx: clampInt(partial.borderRadiusPx, 0, 24, base.borderRadiusPx),
    paddingPx: clampInt(partial.paddingPx, 0, 48, base.paddingPx),
  };
}

/** Normalize stored / partial design (legacy show* flags → elements). */
export function normalizePdfDesign(raw = {}) {
  const next = {
    orientation:
      raw.orientation === "portrait" ? "portrait" : DEFAULT_PDF_DESIGN.orientation,
    companyLogoDataUrl:
      typeof raw.companyLogoDataUrl === "string" ? raw.companyLogoDataUrl : "",
    elements: defaultElements(),
  };

  if (raw.elements && typeof raw.elements === "object") {
    for (const id of PDF_ELEMENT_IDS) {
      next.elements[id] = mergeElement(id, raw.elements[id]);
    }
  } else {
    const legacy = (key, fallback = true) =>
      raw[key] !== undefined ? Boolean(raw[key]) : fallback;
    next.elements.header.visible = legacy("showHeader", true);
    next.elements.helixLogo.visible =
      legacy("showHeader", true) && legacy("showHelixLogo", true);
    next.elements.companyLogo.visible =
      legacy("showHeader", true) && legacy("showCompanyLogo", true);
    next.elements.title.visible =
      legacy("showHeader", true) && legacy("showTitle", true);
    next.elements.charts.visible = legacy("showCharts", true);
    next.elements.text.visible = legacy("showText", true);
    next.elements.grid.visible = legacy("showGrid", true);
    next.elements.footer.visible = legacy("showFooter", true);

    const legacyFont = String(raw.fontFamily || "").trim();
    if (legacyFont) {
      for (const id of PDF_ELEMENT_IDS) {
        next.elements[id].fontFamily = legacyFont;
      }
    }
    const legacyBw = raw.borderWidthPx;
    const legacyBr = raw.borderRadiusPx;
    if (legacyBw !== undefined) {
      for (const id of PDF_ELEMENT_IDS) {
        next.elements[id].borderWidthPx = clampInt(
          legacyBw,
          0,
          8,
          next.elements[id].borderWidthPx,
        );
      }
    }
    if (legacyBr !== undefined) {
      for (const id of ["charts", "text", "grid"]) {
        next.elements[id].borderRadiusPx = clampInt(
          legacyBr,
          0,
          24,
          next.elements[id].borderRadiusPx,
        );
      }
    }
  }

  if (
    typeof next.companyLogoDataUrl === "string" &&
    next.companyLogoDataUrl.length > MAX_LOGO_DATA_URL_CHARS
  ) {
    next.companyLogoDataUrl = "";
  }

  return next;
}

export function loadPdfDesign() {
  try {
    const raw = localStorage.getItem(PDF_DESIGN_STORAGE_KEY);
    if (!raw) return normalizePdfDesign({});
    return normalizePdfDesign(JSON.parse(raw));
  } catch {
    return normalizePdfDesign({});
  }
}

export function savePdfDesign(prefs) {
  const next = normalizePdfDesign(prefs);
  localStorage.setItem(PDF_DESIGN_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function elementStyle(prefs, id) {
  const elements = prefs?.elements || defaultElements();
  return mergeElement(id, elements[id]);
}

export function orderedGridColumns(columns, language) {
  const cols = Array.isArray(columns) ? [...columns] : [];
  if (language === "fa" || language === "rtl") {
    return cols.reverse();
  }
  return cols;
}
