import { useI18n } from "../context/I18nContext.jsx";

export default function ItemAssignmentPicker({
  legend,
  items,
  selectedIds,
  onChange,
  emptyLabel,
}) {
  const { t } = useI18n();
  const resolvedEmpty = emptyLabel ?? t("common.noItems");

  function setEnabled(id, enabled) {
    if (enabled) {
      if (selectedIds.includes(id)) return;
      onChange([...selectedIds, id]);
      return;
    }
    onChange(selectedIds.filter((itemId) => itemId !== id));
  }

  return (
    <fieldset className="block text-sm">
      <legend className="font-medium text-ink">{legend}</legend>
      <div className="mt-2 flex flex-col gap-2">
        {items.length === 0 ? (
          <p className="rounded-xl border border-line bg-fog/40 px-3 py-2 text-sm text-muted">
            {resolvedEmpty}
          </p>
        ) : (
          items.map((item) => {
            const enabled = selectedIds.includes(item.id);
            return (
              <div
                key={item.id}
                className={[
                  "flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition",
                  enabled
                    ? "border-moss/40 bg-moss/10"
                    : "border-line bg-fog/40",
                ].join(" ")}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink" title={item.id}>
                    {item.label}
                  </p>
                  {item.subtitle ? (
                    <p className="truncate font-mono text-[11px] text-muted">
                      {item.subtitle}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setEnabled(item.id, !enabled)}
                  className={[
                    "shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                    enabled
                      ? "bg-moss text-white hover:bg-moss-deep"
                      : "border border-line bg-paper text-muted hover:bg-fog hover:text-ink",
                  ].join(" ")}
                >
                  {enabled ? t("common.disable") : t("common.enable")}
                </button>
              </div>
            );
          })
        )}
      </div>
    </fieldset>
  );
}
