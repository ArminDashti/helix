import { useI18n } from "../context/I18nContext.jsx";
import WhenChips from "./WhenChips.jsx";
import {
  DEFAULT_EDGE_LIMIT,
  EDGE_KINDS,
  fieldsForKind,
} from "../pipeline/pipelineFlow.js";
import { sortByLabel } from "../utils/sortOptions.js";
import { agentCompanyLabel } from "../utils/agentLabel.js";

export default function EdgeKindFields({
  kind,
  when,
  limit,
  target,
  agents = [],
  showKindSelect = false,
  onChange,
  idPrefix = "edge",
}) {
  const { t, locale } = useI18n();
  const fields = fieldsForKind(kind);
  const cap = limit != null ? limit : DEFAULT_EDGE_LIMIT;

  function patch(partial) {
    onChange(partial);
  }

  return (
    <div className="space-y-3 text-sm">
      {showKindSelect ? (
        <label className="block text-xs">
          <span className="font-medium text-ink">{t("pipeline.edgeLabel")}</span>
          <select
            id={`${idPrefix}-kind`}
            value={kind || "forward"}
            onChange={(e) => patch({ kind: e.target.value })}
            className="mt-1 w-full rounded-xl border border-line bg-fog/40 px-3 py-1.5 text-sm outline-none focus:border-moss"
          >
            {sortByLabel(EDGE_KINDS, (opt) => t(`pipeline.kind.${opt.value}`), locale).map(
              (opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(`pipeline.kind.${opt.value}`)}
                </option>
              ),
            )}
          </select>
        </label>
      ) : null}
      {fields.includes("when") ? (
        <WhenChips
          when={when}
          idPrefix={idPrefix}
          onChange={(next) => patch({ when: next })}
        />
      ) : null}
      {fields.includes("status") ? (
        <label className="block text-xs">
          <span className="font-medium text-ink">{t("pipeline.resultIs")}</span>
          <input
            id={`${idPrefix}-status`}
            value={when?.status || ""}
            onChange={(e) =>
              patch({ when: { type: "on_status", status: e.target.value } })
            }
            className="mt-1 w-full rounded-xl border border-line bg-fog/40 px-3 py-1.5 text-sm outline-none focus:border-moss"
            placeholder={t("pipeline.statusPlaceholder")}
          />
        </label>
      ) : null}
      {fields.includes("target") && agents.length ? (
        <label className="block text-xs">
          <span className="font-medium text-ink">{t("pipeline.agent")}</span>
          <select
            id={`${idPrefix}-target`}
            value={target || ""}
            onChange={(e) => patch({ target: e.target.value })}
            className="mt-1 w-full rounded-xl border border-line bg-fog/40 px-3 py-1.5 text-sm outline-none focus:border-moss"
          >
            {sortByLabel(agents, (a) => agentCompanyLabel(a), locale).map((a) => (
              <option key={a.id} value={a.id} title={a.id}>
                {agentCompanyLabel(a)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {fields.includes("limit") ? (
        <label className="block text-xs">
          <span className="font-medium text-ink">{t("pipeline.limit")}</span>
          <input
            id={`${idPrefix}-limit`}
            type="number"
            min={1}
            value={cap}
            onChange={(e) =>
              patch({ limit: Math.max(1, Number(e.target.value) || 1) })
            }
            className="mt-1 w-24 rounded-xl border border-line bg-fog/40 px-3 py-1.5 text-sm outline-none focus:border-moss"
          />
        </label>
      ) : null}
    </div>
  );
}
