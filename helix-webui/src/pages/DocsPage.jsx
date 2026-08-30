import { useEffect, useMemo, useState } from "react";
import { Save, Table2 } from "lucide-react";
import { fetchDocsTable, fetchDocsTables, saveDocsColumn, saveDocsTableOverview } from "../api/client.js";
import ColumnDocsModal from "../components/ColumnDocsModal.jsx";
import DataGrid from "../components/DataGrid.jsx";
import IconButton from "../components/IconButton.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { useI18n } from "../context/I18nContext.jsx";
import { failMessage, translateKnownMessage } from "../i18n/apiErrors.js";

export default function DocsPage() {
  const { t } = useI18n();
  const [tables, setTables] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState(null);
  const [listError, setListError] = useState(null);
  const [tableFilter, setTableFilter] = useState("");
  const [overviewDraft, setOverviewDraft] = useState("");
  const [overviewDirty, setOverviewDirty] = useState(false);
  const [savingOverview, setSavingOverview] = useState(false);
  const [editingColumn, setEditingColumn] = useState(null);
  const [savingColumn, setSavingColumn] = useState(false);
  const [columnError, setColumnError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchDocsTables();
        setTables(data.tables || []);
        setListError(data.error || null);
        const first = data.tables?.[0]?.full_name;
        if (first) setSelected(first);
      } catch (err) {
        setError(failMessage(err, t, "docs.loadFailed"));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setDetailLoading(true);
      setError(null);
      try {
        const data = await fetchDocsTable(selected);
        if (!cancelled) {
          setDetail(data);
          setOverviewDraft(data.overview || "");
          setOverviewDirty(false);
        }
      } catch (err) {
        if (!cancelled) {
          setDetail(null);
          setError(failMessage(err, t, "docs.loadTableFailed"));
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected, t]);

  const filteredTables = useMemo(() => {
    const q = tableFilter.trim().toLowerCase();
    if (!q) return tables;
    return tables.filter((t) =>
      String(t.full_name || "")
        .toLowerCase()
        .includes(q),
    );
  }, [tables, tableFilter]);

  const columnRows = useMemo(
    () =>
      (detail?.columns || []).map((col) => ({
        key: col.name,
        item: col,
      })),
    [detail],
  );

  const columnGrid = useMemo(
    () => [
      {
        key: "name",
        label: t("docs.colColumn"),
        render: (col) => (
          <span className="font-sans text-[13px]">{col.name}</span>
        ),
      },
      {
        key: "data_type",
        label: t("docs.colType"),
        render: (col) => (
          <span className="text-muted">{col.data_type || t("common.noneDash")}</span>
        ),
      },
      {
        key: "nullable",
        label: t("docs.colNull"),
        render: (col) => (
          <span className="text-muted">
            {col.nullable ? t("docs.nullableYes") : t("docs.nullableNo")}
          </span>
        ),
      },
      {
        key: "sql_description",
        label: t("docs.colSqlDescription"),
        render: (col) =>
          col.sql_description || (
            <span className="text-muted">{t("docs.noSqlDescription")}</span>
          ),
      },
      {
        key: "description",
        label: t("docs.colDescription"),
        render: (col) =>
          col.description || (
            <span className="text-muted">{t("docs.noDescription")}</span>
          ),
      },
    ],
    [t],
  );

  if (loading) {
    return <p className="text-sm text-muted">{t("docs.loading")}</p>;
  }

  return (
    <div className="hx-rise flex h-full min-h-0 flex-col gap-2">
      <PageHeader icon={Table2} title={t("docs.title")} />

      {listError ? (
        <p className="shrink-0 rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
          {t("docs.liveSchemaUnavailable", {
            error: translateKnownMessage(t, listError),
          })}
        </p>
      ) : null}
      {error ? (
        <p className="shrink-0 rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
          {error}
        </p>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-2 lg:grid-cols-[minmax(22rem,32rem)_1fr]">
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-line/80 bg-paper/80 p-2">
          <label className="block px-1">
            <span className="sr-only">{t("docs.filterSr")}</span>
            <input
              type="search"
              value={tableFilter}
              onChange={(e) => setTableFilter(e.target.value)}
              placeholder={t("docs.filterPlaceholder")}
              className="w-full rounded-lg border border-line bg-fog/40 px-2 py-1.5 text-sm outline-none focus:border-moss"
            />
          </label>
          <ul className="mt-1 min-h-0 flex-1 space-y-0.5 overflow-y-auto">
            {tables.length === 0 ? (
              <li className="px-2 py-2 text-sm text-muted">{t("docs.noTables")}</li>
            ) : filteredTables.length === 0 ? (
              <li className="px-2 py-2 text-sm text-muted">{t("docs.noMatching")}</li>
            ) : (
              filteredTables.map((tbl) => (
                <li key={tbl.full_name}>
                  <button
                    type="button"
                    onClick={() => setSelected(tbl.full_name)}
                    className={[
                      "w-full rounded-xl px-3 py-1.5 text-start text-sm transition",
                      selected === tbl.full_name
                        ? "bg-moss text-white"
                        : "text-ink hover:bg-fog",
                    ].join(" ")}
                  >
                    <span className="block break-all whitespace-normal font-medium">
                      {tbl.full_name}
                    </span>
                    <span
                      className={[
                        "block text-[11px]",
                        selected === tbl.full_name ? "text-white/80" : "text-muted",
                      ].join(" ")}
                    >
                      {tbl.kind || t("docs.kindFallback")}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </aside>

        <section className="min-h-0 overflow-y-auto rounded-2xl border border-line/80 bg-paper/80 p-4">
          {detailLoading ? (
            <p className="text-sm text-muted">{t("docs.loadingTable")}</p>
          ) : !detail ? (
            <p className="text-sm text-muted">{t("docs.selectTable")}</p>
          ) : (
            <div className="space-y-4">
              <div>
                <h3 className="mb-1 text-sm font-semibold text-ink">{t("docs.overview")}</h3>
                <textarea
                  value={overviewDraft}
                  onChange={(e) => {
                    setOverviewDraft(e.target.value);
                    setOverviewDirty(true);
                  }}
                  rows={5}
                  placeholder={t("docs.overviewPlaceholder")}
                  className="w-full resize-y rounded-xl border border-line bg-fog/40 px-3 py-2 text-sm leading-relaxed text-ink outline-none focus:border-moss focus:ring-2 focus:ring-moss/30"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <IconButton
                    type="button"
                    icon={Save}
                    disabled={savingOverview || !overviewDirty}
                    onClick={async () => {
                      if (!selected) return;
                      setSavingOverview(true);
                      setError(null);
                      try {
                        const data = await saveDocsTableOverview(
                          selected,
                          overviewDraft,
                        );
                        setDetail(data);
                        setOverviewDraft(data.overview || "");
                        setOverviewDirty(false);
                      } catch (err) {
                        setError(failMessage(err, t, "docs.saveExplanationFailed"));
                      } finally {
                        setSavingOverview(false);
                      }
                    }}
                    className="rounded-xl bg-moss px-4 py-2 text-sm font-semibold text-white hover:bg-moss-deep disabled:opacity-50"
                  >
                    {savingOverview ? t("common.saving") : t("docs.saveExplanation")}
                  </IconButton>
                  {overviewDirty ? (
                    <span className="text-xs text-muted">{t("docs.unsaved")}</span>
                  ) : null}
                </div>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-ink">{t("docs.columns")}</h3>
                <DataGrid
                  columns={columnGrid}
                  rows={columnRows}
                  emptyLabel={t("docs.noColumns")}
                  onRowClick={(col) => {
                    setColumnError(null);
                    setEditingColumn(col);
                  }}
                />
              </div>
            </div>
          )}
        </section>
      </div>
      <ColumnDocsModal
        column={editingColumn}
        saving={savingColumn}
        error={columnError}
        onClose={() => {
          if (savingColumn) return;
          setEditingColumn(null);
          setColumnError(null);
        }}
        onSave={async ({ sql_description, description }) => {
          if (!selected || !editingColumn) return;
          setSavingColumn(true);
          setColumnError(null);
          try {
            const data = await saveDocsColumn(selected, {
              column: editingColumn.name,
              description,
              sql_description,
            });
            setDetail(data);
            setEditingColumn(null);
          } catch (err) {
            setColumnError(failMessage(err, t, "docs.saveColumnFailed"));
          } finally {
            setSavingColumn(false);
          }
        }}
      />
    </div>
  );
}
