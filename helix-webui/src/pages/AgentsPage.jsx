import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Ban, Bot, LayoutList, ListChecks, ListTree, Network, Pencil, Trash2 } from "lucide-react";
import {
  deleteAgent,
  fetchAgents,
  fetchRules,
  fetchSkills,
  setAgentDisabled,
} from "../api/client.js";
import PipelineDesigner from "../components/PipelineDesigner.jsx";
import DataGrid from "../components/DataGrid.jsx";
import FlashMessage from "../components/FlashMessage.jsx";
import IconButton from "../components/IconButton.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { useI18n } from "../context/I18nContext.jsx";
import { failMessage, translateKnownMessage } from "../i18n/apiErrors.js";
import useFlash from "../lib/useFlash.js";
import StackedNames from "../components/StackedNames.jsx";
import { sortByLabel } from "../utils/sortOptions.js";
import { agentCompanyLabel } from "../utils/agentLabel.js";

function namesForAgent(agentId, items, locale) {
  return sortByLabel(
    items
      .filter((item) => (item.agents || []).includes(agentId))
      .map((item) => item.name || item.id),
    (label) => label,
    locale,
  );
}

export default function AgentsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, locale } = useI18n();
  const [agents, setAgents] = useState([]);
  const [rules, setRules] = useState([]);
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useFlash();
  const [view, setView] = useState("list");

  async function reload() {
    const [a, r, s] = await Promise.all([
      fetchAgents(),
      fetchRules(),
      fetchSkills(),
    ]);
    setAgents(a || []);
    setRules(r || []);
    setSkills(s || []);
  }

  useEffect(() => {
    (async () => {
      try {
        await reload();
      } catch (err) {
        setError(
          err instanceof Error
            ? failMessage(err, t, "agents.loadFailed")
            : t("agents.loadFailed"),
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  useEffect(() => {
    const flash = location.state?.status;
    if (!flash) return;
    setStatus(translateKnownMessage(t, flash) || flash);
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.pathname, location.state, navigate, setStatus, t]);

  const rows = useMemo(
    () =>
      agents
        .filter((agent) => agent.id === "orchester")
        .map((agent) => ({ key: agent.id, item: agent })),
    [agents],
  );
  const pipelineAgents = useMemo(
    () => agents.filter((agent) => agent.id === "orchester"),
    [agents],
  );

  async function handleDisable(agent) {
    setError(null);
    try {
      const updated = await setAgentDisabled(agent.id, !agent.disabled);
      setAgents((prev) =>
        prev.map((a) => (a.id === agent.id ? { ...a, ...updated } : a)),
      );
      const label = agentCompanyLabel(updated);
      setStatus(
        updated.disabled
          ? t("common.disabledNamed", { name: label })
          : t("common.enabledNamed", { name: label }),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? failMessage(err, t, "common.updateFailed")
          : t("common.updateFailed"),
      );
    }
  }

  async function handleDelete(agent) {
    const label = agentCompanyLabel(agent);
    if (!window.confirm(t("agents.deleteConfirm", { name: label }))) return;
    setError(null);
    try {
      await deleteAgent(agent.id);
      await reload();
      setStatus(t("agents.deleted"));
    } catch (err) {
      setError(
        err instanceof Error
          ? failMessage(err, t, "agents.deleteFailed")
          : t("agents.deleteFailed"),
      );
    }
  }

  const columns = [
    {
      key: "id",
      label: t("common.idUpper"),
      render: (agent) => (
        <span className="font-sans text-[13px]" title={agent.id}>
          {agent.id}
        </span>
      ),
    },
    {
      key: "name",
      label: t("agents.colRole"),
      render: (agent) => agent.name || agent.id,
    },
    {
      key: "rules",
      label: t("agents.colRules"),
      render: (agent) => (
        <StackedNames items={namesForAgent(agent.id, rules, locale)} />
      ),
    },
    {
      key: "skills",
      label: t("agents.colSkills"),
      render: (agent) => (
        <StackedNames items={namesForAgent(agent.id, skills, locale)} />
      ),
    },
    {
      key: "assign",
      label: t("agents.colAssign"),
      render: (agent) => (
        <IconButton
          type="button"
          icon={ListChecks}
          onClick={() =>
            navigate(`/agents/${encodeURIComponent(agent.id)}/assignments`)
          }
          className="rounded-lg border border-line bg-fog px-2 py-1.5 text-xs font-medium hover:bg-fog/80"
        >
          {t("agents.assign")}
        </IconButton>
      ),
    },
    {
      key: "edit",
      label: t("common.edit"),
      render: (agent) => (
        <IconButton
          type="button"
          icon={Pencil}
          onClick={() => navigate(`/agents/${encodeURIComponent(agent.id)}`)}
          className="rounded-lg border border-line bg-fog px-2 py-1.5 text-xs font-medium hover:bg-fog/80"
        >
          {t("common.edit")}
        </IconButton>
      ),
    },
    {
      key: "disable",
      label: t("common.disable"),
      render: (agent) => (
        <IconButton
          type="button"
          icon={Ban}
          onClick={() => handleDisable(agent)}
          className="rounded-lg border border-line bg-fog px-2 py-1.5 text-xs font-medium hover:bg-fog/80"
        >
          {agent.disabled ? t("common.enable") : t("common.disable")}
        </IconButton>
      ),
    },
    {
      key: "delete",
      label: t("common.delete"),
      render: (agent) => (
        <IconButton
          type="button"
          icon={Trash2}
          onClick={() => handleDelete(agent)}
          className="rounded-lg border border-warn-border bg-warn-bg px-2 py-1.5 text-xs font-medium text-warn hover:opacity-90"
        >
          {t("common.delete")}
        </IconButton>
      ),
    },
  ];

  if (loading) {
    return <p className="text-sm text-muted">{t("agents.loading")}</p>;
  }

  return (
    <div className="hx-rise flex h-full min-h-0 flex-col gap-2">
      <PageHeader
        icon={Bot}
        title={t("agents.title")}
        actions={
          <>
            <div
              className="flex rounded-xl border border-line bg-fog/40 p-0.5"
              role="tablist"
              aria-label={t("agents.viewAria")}
            >
              {[
                { id: "list", label: t("agents.viewList"), icon: LayoutList },
                { id: "arrange", label: t("agents.viewArrange"), icon: ListTree },
                { id: "graph", label: t("agents.viewGraph"), icon: Network },
              ].map((tab) => (
                <IconButton
                  key={tab.id}
                  type="button"
                  role="tab"
                  icon={tab.icon}
                  aria-selected={view === tab.id}
                  onClick={() => setView(tab.id)}
                  className={[
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                    view === tab.id
                      ? "bg-moss text-white"
                      : "text-ink hover:bg-fog",
                  ].join(" ")}
                >
                  {tab.label}
                </IconButton>
              ))}
            </div>
          </>
        }
      />
      {error && view === "list" ? (
        <p className="shrink-0 rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
          {error}
        </p>
      ) : null}
      {view === "list" ? <FlashMessage message={status} /> : null}
      {view === "list" ? (
        <DataGrid columns={columns} rows={rows} emptyLabel={t("common.noAgents")} />
      ) : null}
      <div
        className={
          view === "list" ? "hidden" : "flex min-h-0 flex-1 flex-col"
        }
      >
        <PipelineDesigner
          agents={pipelineAgents}
          mode={view === "list" ? "arrange" : view}
        />
      </div>
    </div>
  );
}
