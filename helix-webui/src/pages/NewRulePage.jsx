import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Scale } from "lucide-react";
import { createRule } from "../api/client.js";
import IconButton from "../components/IconButton.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { useI18n } from "../context/I18nContext.jsx";
import { failMessage } from "../i18n/apiErrors.js";

const inputClass =
  "mt-1 w-full rounded-xl border border-line bg-fog/40 px-3 py-2 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/30";

export default function NewRulePage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const defaultContent = `${t("rules.defaultContent")}\n\n`;
  const [newId, setNewId] = useState("");
  const [name, setName] = useState("");
  const [content, setContent] = useState(defaultContent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleCreate(event) {
    event.preventDefault();
    const id = newId.trim();
    if (!id) {
      setError(t("rules.idRequired"));
      return;
    }
    if (!name.trim()) {
      setError(t("rules.nameRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createRule(id, {
        content: content || defaultContent,
        agents: [],
        name: name.trim(),
      });
      navigate("/rules");
    } catch (err) {
      setError(failMessage(err, t, "common.createFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <PageHeader icon={Scale} title={t("rules.newTitle")} backTo="/rules" />
      {error ? (
        <p className="rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
          {error}
        </p>
      ) : null}
      <form
        onSubmit={handleCreate}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-2xl border border-line/80 bg-paper/80 p-4"
      >
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-ink">{t("common.id")}</span>
            <input
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              className={inputClass}
              placeholder={t("rules.idPlaceholder")}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-ink">{t("common.name")}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder={t("rules.namePlaceholder")}
              required
            />
          </label>
        </div>
        <label className="flex min-h-0 flex-1 flex-col text-sm">
          <span className="font-medium text-ink">{t("rules.content")}</span>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="mt-1 min-h-[12rem] w-full flex-1 resize-y rounded-xl border border-line bg-fog/40 px-3 py-2 font-mono text-[13px] outline-none focus:border-moss focus:ring-2 focus:ring-moss/30"
            spellCheck={false}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <IconButton
            type="submit"
            icon={Plus}
            disabled={saving}
            className="rounded-xl bg-moss px-5 py-2.5 text-sm font-semibold text-white hover:bg-moss-deep disabled:opacity-50"
          >
            {saving ? t("common.creating") : t("rules.create")}
          </IconButton>
        </div>
      </form>
    </div>
  );
}
