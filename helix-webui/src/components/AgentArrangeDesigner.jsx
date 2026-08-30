import { useI18n } from "../context/I18nContext.jsx";
import {
  STAGE_ACTIONS,
  RESULT_OPS,
  THEN_ACTIONS,
  insertStage,
  newStage,
  patchStage,
  removeStage,
  validateFlow,
} from "../pipeline/pipelineFlow.js";
import { agentCompanyLabel } from "../utils/agentLabel.js";

const fieldClass =
  "mt-1 w-full rounded-xl border border-line bg-paper px-3 py-1.5 text-sm outline-none focus:border-moss";

export default function AgentArrangeDesigner({ agents, flow, onFlowChange }) {
  const { t } = useI18n();
  const children = flow?.type === "stages" ? flow.children || [] : [];
  const errors =
    flow?.type === "stages"
      ? validateFlow(flow, t)
      : [t("pipeline.validate.arrangeIf")];

  function addStage() {
    const last = children[children.length - 1];
    const startId =
      last?.next_agent_id || last?.agent_id || agents[0]?.id || "";
    const fallback = agents.find((a) => a.id !== startId);
    onFlowChange(
      insertStage(flow, children.length, newStage(startId, fallback?.id || "")),
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
      {errors.length ? (
        <p className="text-xs text-warn">{errors[0]}</p>
      ) : null}
      {children.map((stage, index) => (
        <StageRow
          key={`${stage.agent_id}-${index}`}
          index={index}
          stage={stage}
          agents={agents}
          onPatch={(patch) => onFlowChange(patchStage(flow, index, patch))}
          onRemove={() => onFlowChange(removeStage(flow, index))}
        />
      ))}
      <button
        type="button"
        onClick={addStage}
        className="self-start rounded-xl border border-line bg-fog px-3 py-1.5 text-xs font-medium hover:bg-fog/80"
      >
        {t("pipeline.addStage")}
      </button>
    </div>
  );
}

function StageRow({ index, stage, agents, onPatch, onRemove }) {
  const { t } = useI18n();
  const action = stage.action || "proceed";
  const thenAct = stage.then || (action === "proceed" ? "proceed" : "proceed");
  const showCondition = action === "if" || action === "if_not";
  const showNext = thenAct !== "stop";

  return (
    <div className="rounded-2xl border border-line/80 bg-paper/80 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          {t("pipeline.stageN", { n: index + 1 })}
        </p>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-warn hover:underline"
        >
          {t("pipeline.remove")}
        </button>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block min-w-[10rem] flex-1 text-xs">
          <span className="font-medium text-ink">{t("pipeline.agent")}</span>
          <select
            value={stage.agent_id || ""}
            onChange={(e) => onPatch({ agent_id: e.target.value })}
            className={fieldClass}
          >
            <option value="">{t("pipeline.choose")}</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id} title={a.id}>
                {agentCompanyLabel(a)}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-[8rem] text-xs">
          <span className="font-medium text-ink">{t("pipeline.actionLabel")}</span>
          <select
            value={action}
            onChange={(e) => onPatch({ action: e.target.value })}
            className={fieldClass}
          >
            {STAGE_ACTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(`pipeline.action.${opt.value}`)}
              </option>
            ))}
          </select>
        </label>
        {showCondition ? (
          <>
            <label className="block w-28 text-xs">
              <span className="font-medium text-ink">{t("pipeline.result")}</span>
              <select value="result" disabled className={fieldClass}>
                <option value="result">{t("pipeline.result")}</option>
              </select>
            </label>
            <label className="block min-w-[8rem] text-xs">
              <span className="font-medium text-ink">{t("pipeline.results")}</span>
              <select
                value={stage.result_op || "equal"}
                onChange={(e) => onPatch({ result_op: e.target.value })}
                className={fieldClass}
              >
                {RESULT_OPS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t(`pipeline.resultOp.${opt.value}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block min-w-[7rem] flex-1 text-xs">
              <span className="font-medium text-ink">{t("pipeline.value")}</span>
              <input
                value={stage.expected || ""}
                onChange={(e) => onPatch({ expected: e.target.value })}
                className={fieldClass}
                placeholder={t("pipeline.valuePlaceholder")}
              />
            </label>
            <span className="pb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              {t("pipeline.thenLabel")}
            </span>
            <label className="block min-w-[8rem] text-xs">
              <span className="font-medium text-ink">{t("pipeline.thenLabel")}</span>
              <select
                value={thenAct}
                onChange={(e) => onPatch({ then: e.target.value })}
                className={fieldClass}
              >
                {THEN_ACTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t(`pipeline.then.${opt.value}`)}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}
        {action === "proceed" || (showCondition && showNext) ? (
          showNext ? (
            <label className="block min-w-[10rem] flex-1 text-xs">
              <span className="font-medium text-ink">{t("pipeline.agent")}</span>
              <select
                value={stage.next_agent_id || ""}
                onChange={(e) => onPatch({ next_agent_id: e.target.value })}
                className={fieldClass}
              >
                <option value="">{t("pipeline.choose")}</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id} title={a.id}>
                    {agentCompanyLabel(a)}
                  </option>
                ))}
              </select>
            </label>
          ) : null
        ) : null}
      </div>
    </div>
  );
}
