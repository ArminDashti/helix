import { intlLocale } from "../i18n/format.js";

export function compareAz(a, b, locale) {
  const tag = locale ? intlLocale(locale) : undefined;
  return String(a ?? "").localeCompare(String(b ?? ""), tag, {
    numeric: true,
    sensitivity: "base",
  });
}

export function sortByLabel(
  items,
  getLabel = (item) => item?.label ?? item?.name ?? "",
  locale,
) {
  return [...items].sort((a, b) => compareAz(getLabel(a), getLabel(b), locale));
}

export function sortStrings(items, locale) {
  return [...items].sort((a, b) => compareAz(a, b, locale));
}
