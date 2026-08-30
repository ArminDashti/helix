import { useI18n } from "../context/I18nContext.jsx";
import { WHEN_OPTIONS } from "../pipeline/pipelineFlow.js";

export default function WhenChips({ when, onChange, idPrefix = "when" }) {
  const { t } = useI18n();
  const type = when?.type || "always";
  return (
    <div className="space-y-2">
      <div
        className="flex flex-wrap gap-1"
        role="group"
        aria-label={t("pipeline.conditionAria")}
      >
        {WHEN_OPTIONS.map((opt) => {
          const selected = type === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              id={`${idPrefix}-${opt.value}`}
              aria-pressed={selected}
              onClick={() =>
                onChange({
                  type: opt.value,
                  ...(opt.value === "on_status"
                    ? { status: when?.status || "" }
                    : {}),
                })
              }
              className={[
                "rounded-lg border px-2 py-1 text-xs font-medium transition",
                selected
                  ? "border-moss bg-moss text-white"
                  : "border-line bg-fog/40 text-ink hover:bg-fog",
              ].join(" ")}
            >
              {t(`pipeline.when.${opt.value}`)}
            </button>
          );
        })}
      </div>
      {type === "on_status" ? (
        <label className="block text-xs">
          <span className="font-medium text-ink">{t("pipeline.resultIs")}</span>
          <input
            value={when?.status || ""}
            onChange={(e) =>
              onChange({ type: "on_status", status: e.target.value })
            }
            className="mt-1 w-full rounded-xl border border-line bg-fog/40 px-3 py-1.5 text-sm outline-none focus:border-moss"
            placeholder={t("pipeline.statusPlaceholder")}
          />
        </label>
      ) : null}
    </div>
  );
}
