import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Ban, Pencil, Plus, Scale, Trash2 } from "lucide-react";
import {
  deleteRule,
  fetchAgents,
  fetchRules,
  updateRule,
} from "../api/client.js";
import DataGrid from "../components/DataGrid.jsx";
import FlashMessage from "../components/FlashMessage.jsx";
import IconButton from "../components/IconButton.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StackedNames from "../components/StackedNames.jsx";
import { useI18n } from "../context/I18nContext.jsx";
import { failMessage } from "../i18n/apiErrors.js";
import useFlash from "../lib/useFlash.js";
import { useLiveSync } from "../context/LiveSyncContext.jsx";
import { agentCompanyLabel } from "../utils/agentLabel.js";
import { sortByLabel } from "../utils/sortOptions.js";

export default function RulesPage() {
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const [rules, setRules] = useState([]);
  const [agents, setAgents] = useState([]);
  const [status, setStatus] = useFlash();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const agentLabelById = useMemo(() => {
    const map = {};
    for (const agent of agents) {
      if (agent?.id) map[agent.id] = agentCompanyLabel(agent);
    }
    return map;
  }, [agents]);

  async function reload() {
    const [r, a] = await Promise.all([fetchRules(), fetchAgents()]);
    setRules(r || []);
    setAgents(a || []);
  }

  useEffect(() => {
    (async () => {
      try {
        await reload();
      } catch (err) {
        setError(failMessage(err, t, "common.failedToLoad"));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  useLiveSync(["rules", "agents"], () => reload().catch(() => {}));
  useEffect(() => {
    function onFocusVis() { if (document.visibilityState !== "hidden") reload().catch(() => {}); }
    window.addEventListener("focus", onFocusVis);
    document.addEventListener("visibilitychange", onFocusVis);
    return () => { window.removeEventListener("focus", onFocusVis); document.removeEventListener("visibilitychange", onFocusVis); };
  }, []);

  const rows = useMemo(
    () => rules.map((rule) => ({ key: rule.id, item: rule })),
    [rules],
  );

  async function handleDisable(rule) {
    setError(null);
    try {
      const updated = await updateRule(rule.id, { disabled: !rule.disabled });
      setRules((prev) => prev.map((r) => (r.id === rule.id ? updated : r)));
      setStatus(
        updated.disabled
          ? t("common.disabledNamed", { name: updated.id })
          : t("common.enabledNamed", { name: updated.id }),
      );
    } catch (err) {
      setError(failMessage(err, t, "common.updateFailed"));
    }
  }

  async function handleDelete(rule) {
    if (!window.confirm(t("rules.deleteConfirm", { id: rule.id }))) return;
    setError(null);
    try {
      await deleteRule(rule.id);
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
      setStatus(t("rules.deleted"));
    } catch (err) {
      setError(failMessage(err, t, "common.deleteFailed"));
    }
  }

  const columns = useMemo(
    () => [
      {
        key: "name",
        label: t("common.name"),
        render: (rule) => rule.name || rule.id,
      },
      {
        key: "agents",
        label: t("common.agents"),
        render: (rule) => (
          <StackedNames
            items={sortByLabel(
              (rule.agents || []).map((id) => agentLabelById[id] || id),
              (label) => label,
              locale,
            )}
          />
        ),
      },
      {
        key: "actions",
        label: t("common.actions"),
        render: (rule) => (
          <div className="flex flex-wrap gap-1.5">
            <IconButton
              type="button"
              icon={Pencil}
              onClick={() => navigate(`/rules/${encodeURIComponent(rule.id)}`)}
              className="rounded-lg border border-line bg-fog px-2 py-1.5 text-xs font-medium hover:bg-fog/80"
            >
              {t("common.edit")}
            </IconButton>
            <IconButton
              type="button"
              icon={Ban}
              onClick={() => handleDisable(rule)}
              className="rounded-lg border border-line bg-fog px-2 py-1.5 text-xs font-medium hover:bg-fog/80"
            >
              {rule.disabled ? t("common.enable") : t("common.disable")}
            </IconButton>
            <IconButton
              type="button"
              icon={Trash2}
              onClick={() => handleDelete(rule)}
              className="rounded-lg border border-warn-border bg-warn-bg px-2 py-1.5 text-xs font-medium text-warn hover:opacity-90"
            >
              {t("common.delete")}
            </IconButton>
          </div>
        ),
      },
    ],
    [t, navigate, agentLabelById, locale],
  );

  if (loading) {
    return <p className="text-sm text-muted">{t("rules.loading")}</p>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <PageHeader
        icon={Scale}
        title={t("rules.title")}
        actions={
          <Link
            to="/rules/new"
            className="inline-flex items-center gap-2 rounded-xl bg-moss px-4 py-2 text-sm font-semibold text-white hover:bg-moss-deep"
          >
            <Plus className="size-4 shrink-0" aria-hidden="true" />
            {t("rules.new")}
          </Link>
        }
      />
      {error ? (
        <p className="shrink-0 rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
          {error}
        </p>
      ) : null}
      <FlashMessage message={status} />
      <DataGrid columns={columns} rows={rows} emptyLabel={t("common.noRules")} />
    </div>
  );
}
