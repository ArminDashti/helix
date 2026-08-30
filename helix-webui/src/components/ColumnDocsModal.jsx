import { useEffect, useState } from "react";
import { Save, X } from "lucide-react";
import { useI18n } from "../context/I18nContext.jsx";
import IconButton from "./IconButton.jsx";

const inputClass =
  "mt-1 w-full resize-y rounded-xl border border-line bg-fog/40 px-3 py-2 text-sm leading-relaxed text-ink outline-none focus:border-moss focus:ring-2 focus:ring-moss/30";

export default function ColumnDocsModal({
  column,
  saving,
  error,
  onClose,
  onSave,
}) {
  const { t } = useI18n();
  const [sqlDescription, setSqlDescription] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    setSqlDescription(column?.sql_description || "");
    setDescription(column?.description || "");
  }, [column]);

  if (!column) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="column-docs-title"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-line/80 px-4 py-3">
          <div>
            <h2 id="column-docs-title" className="font-display text-lg text-ink">
              {t("docs.editColumn")}
            </h2>
            <p className="mt-0.5 font-sans text-sm text-muted">{column.name}</p>
          </div>
          <IconButton
            type="button"
            icon={X}
            onClick={onClose}
            className="rounded-xl border border-line bg-fog px-3 py-1.5 text-sm font-medium text-ink hover:bg-fog/80"
          >
            {t("common.close")}
          </IconButton>
        </header>

        <form
          className="space-y-3 px-4 py-3"
          onSubmit={(event) => {
            event.preventDefault();
            onSave({
              sql_description: sqlDescription,
              description,
            });
          }}
        >
          {error ? (
            <p className="rounded-xl border border-warn-border bg-warn-bg px-3 py-2 text-sm text-warn">
              {error}
            </p>
          ) : null}
          <label className="block text-sm">
            <span className="font-medium text-ink">{t("docs.sqlDescription")}</span>
            <textarea
              value={sqlDescription}
              onChange={(e) => setSqlDescription(e.target.value)}
              rows={3}
              className={inputClass}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-ink">{t("docs.description")}</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className={inputClass}
            />
          </label>
          <footer className="flex justify-end gap-2 border-t border-line/80 pt-3">
            <IconButton
              type="submit"
              icon={Save}
              disabled={saving}
              className="rounded-xl bg-moss px-4 py-2 text-sm font-semibold text-white hover:bg-moss-deep disabled:opacity-50"
            >
              {saving ? t("common.saving") : t("common.save")}
            </IconButton>
          </footer>
        </form>
      </div>
    </div>
  );
}
