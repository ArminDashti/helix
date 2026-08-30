/**
 * Prefer PRIMARY KEY, then *Id / id / *_id, then lowest ordinal.
 * @param {Array<{ name?: string, description?: string, ordinal?: number }>} columns
 * @returns {string}
 */
export function preferIdOrderColumn(columns) {
  const list = Array.isArray(columns) ? columns : [];
  if (!list.length) return "";

  const pk = list.find(
    (c) => String(c?.description || "").trim().toUpperCase() === "PRIMARY KEY",
  );
  if (pk?.name) return String(pk.name);

  const idLike = list.find((c) => {
    const name = String(c?.name || "").trim();
    if (!name) return false;
    const lower = name.toLowerCase();
    if (lower === "id") return true;
    if (lower.endsWith("_id")) return true;
    return name.length > 2 && (name.endsWith("Id") || name.endsWith("ID"));
  });
  if (idLike?.name) return String(idLike.name);

  const withOrdinal = list
    .filter((c) => c?.name && typeof c.ordinal === "number")
    .sort((a, b) => a.ordinal - b.ordinal);
  if (withOrdinal[0]?.name) return String(withOrdinal[0].name);

  return String(list[0]?.name || "");
}
