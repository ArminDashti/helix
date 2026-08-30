import { useEffect, useState } from "react";
import { Code2, Eye, Pencil, Save, Trash2 } from "lucide-react";
import { useI18n } from "../context/I18nContext.jsx";
import { renderMarkdownToHtml } from "../lib/markdownPreview.js";
import { agentCompanyLabel } from "../utils/agentLabel.js";
import FlashMessage from "./FlashMessage.jsx";
import IconButton from "./IconButton.jsx";
import PageHeader from "./PageHeader.jsx";

/**
 * Shared three-pane shell: agents (+ Shared below) | item list | markdown editor.
 */
export default function AgentScopedMarkdownPage({
  pageTitle,
  pageIcon,
  headerActions,
  agents,
  selectedScope,
  onSelectScope,
  items,
  selectedId,
  onSelectItem,
  itemLabel = (item) => item.id,
  getItemId = (item) => item.id,
  itemsTitle,
  emptyItemsLabel,
  editorTitle,
  draft,
  onDraftChange,
  onSave,
  onDelete,
  onRenameItem,
  canDelete = true,
  canRename = true,
  showCreate = false,
  newId,
  onNewIdChange,
  onCreate,
  createPlaceholder,
  createLabel,
  createInputId = "scoped-new-id",
  createInputLabel = "",
  status,
  error,
  loading,
  loadingLabel,
}) {
  const { t } = useI18n();
  const resolvedItemsTitle = itemsTitle ?? t("markdown.items");
  const resolvedEmptyItemsLabel = emptyItemsLabel ?? t("markdown.empty");
  const resolvedLoadingLabel = loadingLabel ?? t("markdown.loading");
  const resolvedCreatePlaceholder = createPlaceholder ?? t("markdown.createPlaceholder");
  const resolvedCreateLabel = createLabel ?? t("markdown.create");
  const resolvedSelectItem = t("markdown.selectItem");

  const [viewMode, setViewMode] = useState("source");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  useEffect(() => {
    setEditingTitle(false);
    setTitleDraft(selectedId || "");
  }, [selectedId, selectedScope]);

  if (loading) {
    return <p className="text-sm text-muted">{resolvedLoadingLabel}</p>;
  }

  async function commitTitleRename() {
    const next = titleDraft.trim();
    setEditingTitle(false);
    if (!canRename || !onRenameItem || !selectedId) return;
    if (!next || next === selectedId) {
      setTitleDraft(selectedId);
      return;
    }
    await onRenameItem(next);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {pageTitle ? (
        <PageHeader
          icon={pageIcon}
          title={pageTitle}
          actions={headerActions}
        />
      ) : null}
      {error ? (
        <p className="shrink-0 rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
          {error}
        </p>
      ) : null}
      <FlashMessage message={status} />

      {showCreate ? (
        <form
          onSubmit={onCreate}
          className="flex shrink-0 flex-wrap items-end gap-2"
        >
          <div className="min-w-[14rem] flex-1">
            {createInputLabel ? (
              <label
                htmlFor={createInputId}
                className="block text-sm font-medium text-ink"
              >
                {createInputLabel}
              </label>
            ) : null}
            <input
              id={createInputId}
              value={newId}
              onChange={(e) => onNewIdChange(e.target.value)}
              placeholder={resolvedCreatePlaceholder}
              aria-label={createInputLabel || resolvedCreatePlaceholder || t("common.id")}
              className={[
                "w-full rounded-xl border border-line bg-fog/40 px-3 py-2 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/30",
                createInputLabel ? "mt-1" : "",
              ].join(" ")}
            />
          </div>
          <button
            type="submit"
            className="rounded-xl border border-line bg-fog px-4 py-2 text-sm font-medium hover:bg-fog/80"
          >
            {resolvedCreateLabel}
          </button>
        </form>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-2 lg:grid-cols-[200px_200px_1fr]">
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-line/80 bg-paper/80 p-2">
          <p className="shrink-0 px-2 text-xs font-semibold uppercase tracking-wide text-muted">
            {t("markdown.agents")}
          </p>
          <ul className="mt-1 min-h-0 flex-1 space-y-0.5 overflow-y-auto">
            {agents.map((agent) => (
              <li key={agent.id} className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => onSelectScope(agent.id)}
                  className={[
                    "w-full rounded-xl px-3 py-1.5 text-start text-sm transition",
                    selectedScope === agent.id
                      ? "bg-moss text-white"
                      : "hover:bg-fog text-ink",
                  ].join(" ")}
                >
                  {agentCompanyLabel(agent)}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-2 shrink-0 border-t border-line/60 pt-2">
            <button
              type="button"
              onClick={() => onSelectScope("shared")}
              className={[
                "w-full rounded-xl px-3 py-1.5 text-start text-sm transition",
                selectedScope === "shared"
                  ? "bg-moss text-white"
                  : "hover:bg-fog text-ink",
              ].join(" ")}
            >
              {t("markdown.shared")}
            </button>
          </div>
        </aside>

        <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-line/80 bg-paper/80 p-2">
          <p className="shrink-0 px-2 text-xs font-semibold uppercase tracking-wide text-muted">
            {resolvedItemsTitle}
          </p>
          <ul className="mt-1 min-h-0 flex-1 space-y-0.5 overflow-y-auto">
            {items.length === 0 ? (
              <li className="px-2 py-2 text-sm text-muted">{resolvedEmptyItemsLabel}</li>
            ) : (
              items.map((item) => {
                const id = getItemId(item);
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => onSelectItem(id)}
                      className={[
                        "w-full rounded-xl px-3 py-1.5 text-start text-sm transition",
                        selectedId === id
                          ? "bg-moss text-white"
                          : "hover:bg-fog text-ink",
                      ].join(" ")}
                    >
                      {itemLabel(item)}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </aside>

        <div className="flex min-h-0 flex-col gap-2 rounded-2xl border border-line/80 bg-paper/80 p-3 sm:p-4">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
            {editingTitle && canRename && selectedId && onRenameItem ? (
              <input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={() => {
                  void commitTitleRename();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void commitTitleRename();
                  }
                  if (e.key === "Escape") {
                    setEditingTitle(false);
                    setTitleDraft(selectedId);
                  }
                }}
                className="min-w-[12rem] flex-1 rounded-xl border border-line bg-fog/40 px-3 py-1.5 font-display text-xl text-ink outline-none focus:border-moss focus:ring-2 focus:ring-moss/30 sm:text-2xl"
                aria-label={t("markdown.renameAria")}
                autoFocus
              />
            ) : (
              <h2
                className={[
                  "font-display text-xl text-ink sm:text-2xl",
                  canRename && selectedId && onRenameItem
                    ? "cursor-text rounded-lg px-1 hover:bg-fog/60"
                    : "",
                ].join(" ")}
                title={
                  canRename && selectedId && onRenameItem
                    ? t("markdown.clickToRename")
                    : undefined
                }
                onClick={() => {
                  if (!canRename || !selectedId || !onRenameItem) return;
                  setTitleDraft(selectedId);
                  setEditingTitle(true);
                }}
              >
                {editorTitle || resolvedSelectItem}
              </h2>
            )}
            <div className="flex flex-wrap gap-2">
              <div
                className="flex rounded-xl border border-line bg-fog/40 p-0.5"
                role="tablist"
                aria-label={t("markdown.editorModeAria")}
              >
                <IconButton
                  type="button"
                  role="tab"
                  icon={Code2}
                  aria-selected={viewMode === "source"}
                  onClick={() => setViewMode("source")}
                  className={[
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                    viewMode === "source"
                      ? "bg-moss text-white"
                      : "text-ink hover:bg-fog",
                  ].join(" ")}
                >
                  {t("markdown.source")}
                </IconButton>
                <IconButton
                  type="button"
                  role="tab"
                  icon={Eye}
                  aria-selected={viewMode === "preview"}
                  onClick={() => setViewMode("preview")}
                  className={[
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                    viewMode === "preview"
                      ? "bg-moss text-white"
                      : "text-ink hover:bg-fog",
                  ].join(" ")}
                >
                  {t("markdown.preview")}
                </IconButton>
              </div>
              <IconButton
                type="button"
                icon={Save}
                onClick={onSave}
                disabled={!selectedId}
                className="rounded-xl bg-moss px-4 py-2 text-sm font-semibold text-white hover:bg-moss-deep disabled:opacity-50"
              >
                {t("markdown.save")}
              </IconButton>
              {canRename && onRenameItem ? (
                <IconButton
                  type="button"
                  icon={Pencil}
                  onClick={() => onRenameItem()}
                  disabled={!selectedId}
                  className="rounded-xl border border-line bg-fog px-4 py-2 text-sm hover:bg-fog/80 disabled:opacity-50"
                >
                  {t("markdown.rename")}
                </IconButton>
              ) : null}
              {canDelete ? (
                <IconButton
                  type="button"
                  icon={Trash2}
                  onClick={onDelete}
                  disabled={!selectedId}
                  className="rounded-xl border border-line bg-fog px-4 py-2 text-sm hover:bg-fog/80 disabled:opacity-50"
                >
                  {t("markdown.delete")}
                </IconButton>
              ) : null}
            </div>
          </div>

          {viewMode === "source" ? (
            <textarea
              value={draft}
              onChange={(e) => onDraftChange(e.target.value)}
              disabled={!selectedId}
              className="min-h-0 w-full flex-1 resize-none rounded-xl border border-line bg-fog/40 px-4 py-3 font-mono text-[13px] leading-relaxed text-ink outline-none focus:border-moss focus:ring-2 focus:ring-moss/30 disabled:opacity-50"
              spellCheck={false}
            />
          ) : (
            <div
              className="md-preview min-h-0 flex-1 overflow-y-auto rounded-xl border border-line bg-fog/40 px-4 py-3 text-[15px] leading-relaxed text-ink"
              dangerouslySetInnerHTML={{
                __html: selectedId
                  ? renderMarkdownToHtml(draft)
                  : `<p class='text-muted'>${resolvedSelectItem}</p>`,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
