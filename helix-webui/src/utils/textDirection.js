const PERSIAN_RE = /[\u0600-\u06FF]/;

export function hasPersianScript(text) {
  return PERSIAN_RE.test(String(text || ""));
}

export function textDirection(text) {
  return hasPersianScript(text) ? "rtl" : "ltr";
}

export function textLang(text) {
  return hasPersianScript(text) ? "fa" : "en";
}

/** Split grid column input on `/` or `,`. */
export function parseColumns(raw) {
  return String(raw || "")
    .split(/[/,\u060C]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
