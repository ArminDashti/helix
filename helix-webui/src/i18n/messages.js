import en from "./en.json";
import fa from "./fa.json";

export const CATALOGS = { en, fa };

export function lookupPath(catalog, key) {
  const parts = String(key || "").split(".");
  let current = catalog;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = current[part];
  }
  return typeof current === "string" ? current : undefined;
}

export function interpolate(template, vars = {}) {
  return String(template).replace(/\{\{(\w+)\}\}/g, (_, name) =>
    vars[name] == null ? "" : String(vars[name]),
  );
}

export function translate(locale, key, vars) {
  const catalog = CATALOGS[locale] || CATALOGS.en;
  const template =
    lookupPath(catalog, key) ?? lookupPath(CATALOGS.en, key) ?? key;
  return interpolate(template, vars);
}
