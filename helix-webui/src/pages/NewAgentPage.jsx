import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, Plus } from "lucide-react";
import { createAgent } from "../api/client.js";
import IconButton from "../components/IconButton.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { useI18n } from "../context/I18nContext.jsx";
import { failMessage } from "../i18n/apiErrors.js";

const PIPELINE_DESIGNER_HINT = {
  id: "pipeline_designer",
  name: "Pipeline Designer",
  description: "Designs and documents analysis pipelines",
};

const inputClass =
  "mt-1 w-full rounded-xl border border-line bg-fog/40 px-3 py-2 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/30";

export default function NewAgentPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [newId, setNewId] = useState(PIPELINE_DESIGNER_HINT.id);
  const [newName, setNewName] = useState(PIPELINE_DESIGNER_HINT.name);
  const [newDescription, setNewDescription] = useState(
    PIPELINE_DESIGNER_HINT.description,
  );

  function fillPipelineDesigner() {
    setNewId(PIPELINE_DESIGNER_HINT.id);
    setNewName(t("agents.templateRole"));
    setNewDescription(t("agents.templateDescription"));
  }

  async function handleCreateAgent(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createAgent({
        id: newId.trim(),
        name: newName.trim(),
        description: newDescription.trim(),
      });
      navigate("/agents");
    } catch (err) {
      setError(
        err instanceof Error
          ? failMessage(err, t, "agents.createFailed")
          : t("agents.createFailed"),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <PageHeader icon={Bot} title={t("agents.newTitle")} backTo="/agents" />
      {error ? (
        <p className="rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
          {error}
        </p>
      ) : null}
      <form
        onSubmit={handleCreateAgent}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-2xl border border-line/80 bg-paper/80 p-4"
      >
        <div className="flex justify-end">
          <IconButton
            type="button"
            icon={Plus}
            onClick={fillPipelineDesigner}
            className="rounded-lg border border-line px-3 py-1 text-xs font-medium text-ink hover:bg-fog"
          >
            {t("agents.templateButton")}
          </IconButton>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-ink">{t("common.id")}</span>
            <input
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              className={inputClass}
              placeholder={t("agents.idPlaceholder")}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-ink">{t("agents.colRole")}</span>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className={inputClass}
              placeholder={t("agents.rolePlaceholder")}
              required
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="font-medium text-ink">{t("agents.description")}</span>
          <input
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            className={inputClass}
          />
        </label>
        <p className="text-sm text-muted">{t("agents.assignedOnlyHint")}</p>
        <div className="flex flex-wrap gap-2">
          <IconButton
            type="submit"
            icon={Plus}
            disabled={saving}
            className="rounded-xl bg-moss px-5 py-2.5 text-sm font-semibold text-white hover:bg-moss-deep disabled:opacity-50"
          >
            {saving ? t("common.creating") : t("agents.create")}
          </IconButton>
        </div>
      </form>
    </div>
  );
}
