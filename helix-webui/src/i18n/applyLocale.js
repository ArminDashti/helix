export const LOCALE_STORAGE_KEY = "helix-locale";

export function isLocale(value) {
  return value === "en" || value === "fa";
}

export function localeToDir(locale) {
  return locale === "fa" ? "rtl" : "ltr";
}

export function localeToHtmlLang(locale) {
  return locale === "fa" ? "fa" : "en";
}

export function applyLocale(locale) {
  const resolved = isLocale(locale) ? locale : "en";
  const root = document.documentElement;
  root.lang = localeToHtmlLang(resolved);
  root.dir = localeToDir(resolved);
}

export function readStoredLocale() {
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch {
    /* ignore */
  }
  return "en";
}

export function persistLocale(locale) {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* ignore */
  }
}
