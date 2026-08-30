import { useI18n } from "../context/I18nContext.jsx";

export default function DataGrid({
  columns,
  rows,
  emptyLabel,
  onRowClick,
  dir,
}) {
  const { t } = useI18n();
  const emptyText = emptyLabel ?? t("common.none");
  const ordered =
    dir === "rtl" ? [...columns].reverse() : columns;
  return (
    <div
      className="min-h-0 flex-1 overflow-auto rounded-2xl border border-line/80 bg-paper/80"
      dir={dir || undefined}
    >
      <table className="min-w-full text-start font-sans text-sm">
        <thead className="sticky top-0 bg-fog/80 text-xs uppercase tracking-wide text-muted backdrop-blur">
          <tr>
            {ordered.map((col) => (
              <th key={col.key} className="whitespace-nowrap px-3 py-2 font-sans font-semibold">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                className="px-3 py-4 font-sans text-sm text-muted"
                colSpan={ordered.length}
              >
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row.key}
                className={[
                  "border-t border-line/70",
                  onRowClick ? "cursor-pointer hover:bg-fog/50" : "",
                ].join(" ")}
                onClick={onRowClick ? () => onRowClick(row.item) : undefined}
              >
                {ordered.map((col) => (
                  <td key={col.key} className="px-3 py-2 align-top font-sans">
                    {col.render(row.item)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
