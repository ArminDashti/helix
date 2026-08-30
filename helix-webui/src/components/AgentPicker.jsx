import { useI18n } from "../context/I18nContext.jsx";
import { agentCompanyLabel } from "../utils/agentLabel.js";

export default function AgentPicker({ agents, selectedIds, onChange }) {
  const { t } = useI18n();

  function setEnabled(id, enabled) {
    if (enabled) {
      if (selectedIds.includes(id)) return;
      onChange([...selectedIds, id]);
      return;
    }
    onChange(selectedIds.filter((item) => item !== id));
  }

  return (
    <fieldset className="block text-sm">
      <legend className="font-medium text-ink">{t("common.agents")}</legend>
      <div className="mt-2 flex flex-col gap-2">
        {agents.length === 0 ? (
          <p className="rounded-xl border border-line bg-fog/40 px-3 py-2 text-sm text-muted">
            {t("common.noAgents")}
          </p>
        ) : (
          agents.map((agent) => {
            const enabled = selectedIds.includes(agent.id);
            return (
              <div
                key={agent.id}
                className={[
                  "flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition",
                  enabled
                    ? "border-moss/40 bg-moss/10"
                    : "border-line bg-fog/40",
                ].join(" ")}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink" title={agent.id}>
                    {agentCompanyLabel(agent)}
                  </p>
                  <p className="truncate font-mono text-[11px] text-muted">
                    {agent.id}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEnabled(agent.id, !enabled)}
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
