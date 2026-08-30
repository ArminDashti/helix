/** Resolve a public asset path under Vite's configured base (e.g. /helix/). */
export function assetUrl(path) {
  const base = import.meta.env.BASE_URL || "/";
  const clean = String(path || "").replace(/^\//, "");
  return `${base}${clean}`.replace(/\/{2,}/g, "/");
}
