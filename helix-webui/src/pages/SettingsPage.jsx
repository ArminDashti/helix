import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import {
  Activity,
  BookOpen,
  Building2,
  Database,
  Download,
  RefreshCw,
  Save,
  Settings as SettingsIcon,
} from "lucide-react";
import {
  fetchAgents,
  fetchBranding,
  fetchDatabaseSettings,
  fetchOpenRouterModels,
  fetchOpenRouterSettings,
  fetchProviderSettings,
  fetchSampleTiers,
  ensureSampleTier,
  saveBranding,
  saveDatabaseSettings,
  saveOpenRouterSettings,
  saveProvider,
} from "../api/client.js";
import FlashMessage from "../components/FlashMessage.jsx";
import IconButton from "../components/IconButton.jsx";
import LlmChatTester from "../components/LlmChatTester.jsx";
import ModelCombobox from "../components/ModelCombobox.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { useApiStatus } from "../context/ApiStatusContext.jsx";
import { useI18n } from "../context/I18nContext.jsx";
import { failMessage, translateKnownMessage } from "../i18n/apiErrors.js";
import { formatDateTime } from "../i18n/format.js";
import useFlash from "../lib/useFlash.js";
import { assetUrl } from "../utils/assetUrl.js";
import { compareAz, sortByLabel, sortStrings } from "../utils/sortOptions.js";
import { agentCompanyLabel } from "../utils/agentLabel.js";
import { useLiveSync } from "../context/LiveSyncContext.jsx";

const EMPTY_DB = {
  engine: "sqlite",
  host: "",
  port: 0,
  name: "helix-sample.sqlite",
  user: "",
  password: "",
  sslmode: "prefer",
  driver: "ODBC Driver 18 for SQL Server",
  trust_server_certificate: true,
  encrypt: true,
  path: "",
};

const SSL_MODES = ["disable", "prefer", "require", "verify-ca", "verify-full"];

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

const EMPTY_OPENROUTER = {
  token: "",
  base_url: OPENROUTER_BASE_URL,
  default_model: "composer-2.5",
  agents: {},
  token_configured: false,
  workspace: "",
  mode: "",
};

const LLM_AGENT_IDS = ["orchester", "web-searcher"];

const ADMIN_GUIDE_PDF = assetUrl("docs/fa/helix-admin-guide.pdf");

function AdminGuideDownloadCard({ t }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-moss/30 bg-moss/5 p-4">
      <div className="flex min-w-0 items-start gap-3">
        <BookOpen className="mt-0.5 size-5 shrink-0 text-moss" aria-hidden />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink">{t("guide.adminTitle")}</h2>
          <p className="mt-1 text-sm text-muted">{t("guide.adminDescription")}</p>
        </div>
      </div>
      <a
        href={ADMIN_GUIDE_PDF}
        download="helix-admin-guide-fa.pdf"
        aria-label={t("guide.downloadAria")}
        className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-moss/40 bg-paper px-4 py-2 text-sm font-medium text-moss hover:bg-moss/10"
      >
        <Download className="size-4" aria-hidden />
        {t("guide.downloadPdf")}
      </a>
    </div>
  );
}

const EMPTY_BRANDING = {
  company_name: "",
  company_logo_data_url: "",
};

const TAB_ALIASES = {
  provider: "llm",
  openrouter: "llm",
  sql: "database",
  connection: "llm",
  logs: "status",
};

function engineLabel(t, value) {
  if (value === "sqlite") return t("settings.engineSqlite");
  if (value === "postgresql") return t("settings.enginePostgresql");
  if (value === "sqlserver") return t("settings.engineSqlserver");
  return value;
}

function isSampleDbName(name) {
  const base = String(name || "")
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    ?.toLowerCase();
  return (
    base === "helix-sample.sqlite" ||
    base === "adventureworks-lt.sqlite" ||
    base === "sample.sqlite"
  );
}

function tabIcon(tabId) {
  if (tabId === "general") return Building2;
  if (tabId === "database") return Database;
  if (tabId === "status") return Activity;
  return SettingsIcon;
}

function isConnectedStatus(status) {
  return status === "connected" || status === "configured";
}

function StatusLogsSection() {
  const { t, locale } = useI18n();
  const { health, checking, lastFetchError, statusLog, checkConnection } =
    useApiStatus();
  const providerKey = "llm";
  const current = {
    llm: {
      status: health?.[providerKey]?.status,
      detail: health
        ? health[providerKey]?.detail || ""
        : lastFetchError
          ? [lastFetchError.message, lastFetchError.detail]
              .filter(Boolean)
              .map((part) => translateKnownMessage(t, part))
              .join(" — ")
          : t("settings.cannotReach"),
      checked_at: health?.[providerKey]?.checked_at,
    },
    engine: {
      status: health?.api?.status,
      detail: health
        ? health.api?.detail || ""
        : lastFetchError
          ? [lastFetchError.message, lastFetchError.detail]
              .filter(Boolean)
              .map((part) => translateKnownMessage(t, part))
              .join(" — ")
          : t("settings.cannotReach"),
      checked_at: health?.api?.checked_at,
    },
    database: {
      status: health?.database?.status,
      detail: health
        ? health.database?.detail || ""
        : t("settings.engineUnreachableDb"),
      checked_at: health?.database?.checked_at,
    },
  };

  const services = [
    { id: "llm", label: t("layout.status.llm") },
    { id: "engine", label: t("layout.status.engine") },
    { id: "database", label: t("layout.status.database") },
  ];

  return (
    <section className="space-y-3 rounded-2xl border border-line/80 bg-paper/80 p-4 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            {t("settings.tabStatus")}
          </h2>
          <p className="mt-1 text-sm text-muted">{t("settings.statusIntro")}</p>
          <p className="mt-1 text-sm text-muted">
            <Link to="/logs" className="underline decoration-line underline-offset-2 hover:text-ink">
              {t("settings.statusLogsLink")}
            </Link>
          </p>
        </div>
        <IconButton
          type="button"
          icon={RefreshCw}
          onClick={() => checkConnection({ silent: false })}
          className="rounded-xl border border-line bg-fog/40 px-3 py-2 text-sm font-medium text-ink hover:bg-fog"
        >
          {checking ? t("settings.checking") : t("settings.checkNow")}
        </IconButton>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {services.map((svc) => {
          const block = current[svc.id];
          const connected = isConnectedStatus(block.status);
          const stateLabel =
            checking && !block.status
              ? t("settings.checking")
              : connected
                ? t("settings.connected")
                : block.status
                  ? t("settings.disconnectedWithRaw", { status: block.status })
                  : t("settings.disconnected");
          const events = [...statusLog]
            .filter((evt) => evt.service === svc.id)
            .reverse();
          return (
            <div
              key={svc.id}
              className="flex min-h-0 flex-col rounded-xl border border-line/80 bg-fog/30 p-3"
            >
              <p className="text-sm font-semibold text-ink">{svc.label}</p>
              <p
                className={`mt-1 text-sm font-medium ${
                  connected ? "text-moss" : "text-danger"
                }`}
              >
                {stateLabel}
              </p>
              <p className="mt-1 text-xs text-muted">
                {t("settings.checkedAt", {
                  time: formatDateTime(block.checked_at, locale) || t("common.noneDash"),
                })}
              </p>
              <p className="mt-2 text-sm text-ink">
                {translateKnownMessage(t, block.detail) || t("settings.noReason")}
              </p>
              <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-xs">
                {events.length === 0 ? (
                  <li className="text-muted">{t("settings.noEvents")}</li>
                ) : (
                  events.map((evt, index) => (
                    <li
                      key={`${evt.at}-${evt.status}-${index}`}
                      className="rounded-lg border border-line/70 bg-paper/80 px-2 py-1.5"
                    >
                      <p className="text-muted">{formatDateTime(evt.at, locale)}</p>
                      <p className="font-medium text-ink">{evt.status}</p>
                      {evt.detail ? (
                        <p className="mt-0.5 break-words text-ink">
                          {translateKnownMessage(t, evt.detail)}
                        </p>
                      ) : null}
                    </li>
                  ))
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function SettingsPage() {
  const { t, locale } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const requestedTab = TAB_ALIASES[tabParam] || tabParam;

  const tabs = useMemo(
    () => [
      { id: "general", label: t("settings.tabGeneral") },
      { id: "llm", label: t("settings.tabLlm") },
      { id: "database", label: t("settings.tabDatabase") },
      { id: "status", label: t("settings.tabStatus") },
    ],
    [t],
  );

  const activeSection = tabs.some((tab) => tab.id === requestedTab)
    ? requestedTab
    : "general";

  const dbEngines = useMemo(
    () =>
      sortByLabel(
        [
          { value: "sqlite", label: t("settings.engineSqlite") },
          { value: "postgresql", label: t("settings.enginePostgresql") },
          { value: "sqlserver", label: t("settings.engineSqlserver") },
        ],
        (item) => item.label,
        locale,
      ),
    [t, locale],
  );

  const sslModes = useMemo(
    () => sortStrings(SSL_MODES, locale),
    [locale],
  );

  const apiOptions = useMemo(
    () => [
      { value: "openrouter", label: t("settings.apiOpenrouter") },
      { value: "openai_compatible", label: t("settings.apiOpenaiCompatible") },
    ],
    [t],
  );

  const [dbForm, setDbForm] = useState(EMPTY_DB);
  const [connectionString, setConnectionString] = useState("");
  const [connectionStringDirty, setConnectionStringDirty] = useState(false);
  const [brandingForm, setBrandingForm] = useState(EMPTY_BRANDING);
  const [logoError, setLogoError] = useState(null);
  const [provider, setProvider] = useState("openrouter");
  const [orForm, setOrForm] = useState(EMPTY_OPENROUTER);
  const [models, setModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState(null);
  const [status, setStatus] = useFlash();
  const [error, setError] = useState(null);
  const [sectionErrors, setSectionErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [agentNameById, setAgentNameById] = useState({});
  const [sampleTiers, setSampleTiers] = useState([]);
  const [tierBusy, setTierBusy] = useState(null);
  const { checkConnection } = useApiStatus();

  const activeTokenConfigured = Boolean(orForm.token_configured);

  async function reloadSampleTiers() {
    try {
      const tiers = await fetchSampleTiers();
      setSampleTiers(tiers);
    } catch {
      setSampleTiers([]);
    }
  }

  async function handleEnsureTier(tierId) {
    setError(null);
    setTierBusy(tierId);
    try {
      await ensureSampleTier(tierId);
      await reloadSampleTiers();
      setStatus(t("settings.tierDownloaded"));
    } catch (err) {
      setError(failMessage(err, t, "settings.tierDownloadFailed"));
    } finally {
      setTierBusy(null);
    }
  }

  async function handleUseTier(tier) {
    setError(null);
    setTierBusy(tier.id);
    try {
      if (!tier.exists) {
        await ensureSampleTier(tier.id);
      }
      const next = {
        ...dbForm,
        engine: "sqlite",
        name: tier.filename,
        path: "",
      };
      setDbForm(next);
      setConnectionStringDirty(false);
      await saveDatabaseSettings(next);
      await reloadSampleTiers();
      setStatus(t("settings.tierActive"));
      await checkConnection({ silent: true });
    } catch (err) {
      setError(failMessage(err, t, "settings.tierUseFailed"));
    } finally {
      setTierBusy(null);
    }
  }

  function agentLabel(agentId) {
    return agentNameById[agentId] || agentId.replace(/_/g, " ");
  }

  function setActiveSection(id) {
    setSearchParams(id === "general" ? {} : { tab: id }, { replace: true });
  }

  useEffect(() => {
    (async () => {
      const failures = [];
      let anyOk = false;
      try {
        try {
          const agents = await fetchAgents();
          const map = {};
          for (const a of agents || []) {
            if (a?.id) map[a.id] = agentCompanyLabel(a);
          }
          setAgentNameById(map);
          anyOk = true;
        } catch (err) {
          failures.push({
            key: "settings.sectionAgentsFail",
            message: err instanceof Error ? err.message : "",
          });
        }

        try {
          const brandingData = await fetchBranding();
          setBrandingForm({
            ...EMPTY_BRANDING,
            ...(brandingData.branding || {}),
          });
          anyOk = true;
        } catch (err) {
          failures.push({
            key: "settings.sectionBrandingFail",
            message: err instanceof Error ? err.message : "",
          });
        }

        try {
          const dbData = await fetchDatabaseSettings();
          setDbForm({ ...EMPTY_DB, ...dbData.database });
          setConnectionString(dbData.connection_string || "");
          anyOk = true;
        } catch (err) {
          failures.push({
            key: "settings.sectionDatabaseFail",
            message: err instanceof Error ? err.message : "",
          });
        }

        try {
          await reloadSampleTiers();
        } catch {
          /* optional */
        }

        try {
          const orData = await fetchOpenRouterSettings();
          setOrForm({ ...EMPTY_OPENROUTER, ...orData.openrouter, token: "" });
          anyOk = true;
        } catch (err) {
          failures.push({
            key: "settings.sectionLlmFail",
            message: err instanceof Error ? err.message : "",
          });
        }

        try {
          const providerData = await fetchProviderSettings();
          const raw = providerData.provider;
          const nextProvider =
            raw === "openai_compatible" ? raw : "openrouter";
          setProvider(nextProvider);
          anyOk = true;
        } catch (err) {
          failures.push({
            key: "settings.sectionApiFail",
            message: err instanceof Error ? err.message : "",
          });
        }

        setSectionErrors(failures);
        if (!anyOk && failures.length) {
          setError(t("settings.allUnreachable"));
        } else if (failures.length) {
          setError(null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  // Live UI: any backend change to config/branding/users must reflect immediately
  useLiveSync(["config", "branding", "database", "pipeline_graph"], () => {
    // soft reload relevant sections without full loading flicker
    (async () => {
      try { const d = await fetchBranding(); setBrandingForm((p) => ({ ...p, ...(d.branding || {}) })); } catch {}
      try { const d = await fetchDatabaseSettings(); setDbForm(d.database || EMPTY_DB); } catch {}
      try { const d = await fetchProviderSettings(); setProviderForm(d.provider || {}); } catch {}
      try { const d = await fetchOpenRouterSettings(); setOpenRouterForm(d.openrouter || EMPTY_OPENROUTER); } catch {}
    })();
  });
  useEffect(() => {
    function onFocusVis() {
      if (document.visibilityState !== "hidden") {
        (async () => {
          try { const d = await fetchBranding(); setBrandingForm((p) => ({ ...p, ...(d.branding || {}) })); } catch {}
        })();
      }
    }
    window.addEventListener("focus", onFocusVis);
    document.addEventListener("visibilitychange", onFocusVis);
    return () => { window.removeEventListener("focus", onFocusVis); document.removeEventListener("visibilitychange", onFocusVis); };
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!activeTokenConfigured) {
      setModels([]);
      setModelsError(null);
      setModelsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setModelsLoading(true);
      setModelsError(null);
      try {
        const data = await fetchOpenRouterModels({ silent: true });
        if (!cancelled) setModels(data.models || []);
      } catch (err) {
        if (!cancelled) {
          setModelsError(
            err instanceof Error ? err.message : t("settings.modelsFail"),
          );
          setModels([]);
        }
      } finally {
        if (!cancelled) setModelsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, activeTokenConfigured, t]);

  function defaultPortForEngine(engine) {
    if (engine === "sqlserver") return 1433;
    if (engine === "sqlite") return 0;
    return 5432;
  }

  function updateDbField(key, value) {
    setDbForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "engine") {
        next.port = defaultPortForEngine(value);
        if (value === "sqlite") {
          next.name = "helix-sample.sqlite";
          next.host = "";
          next.path = "";
        } else {
          if (isSampleDbName(next.name) || isSampleDbName(next.path)) {
            next.name = "";
          }
          next.path = "";
        }
      }
      return next;
    });
    setConnectionStringDirty(false);
    if (key === "engine") {
      setConnectionString("");
    }
  }

  function updateOrField(key, value) {
    setOrForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateAgentModel(agentId, model) {
    setOrForm((prev) => ({
      ...prev,
      agents: {
        ...prev.agents,
        [agentId]: { ...(prev.agents?.[agentId] || {}), model },
      },
    }));
  }

  function handleApiChange(next) {
    setProvider(next);
    if (next === "openrouter") {
      setOrForm((prev) => {
        const current = (prev.base_url || "").trim();
        if (!current || current === OPENROUTER_BASE_URL) {
          return { ...prev, base_url: OPENROUTER_BASE_URL };
        }
        return prev;
      });
    }
  }

  async function handleSaveGeneral(event) {
    event.preventDefault();
    setError(null);
    setLogoError(null);
    setStatus(null);
    try {
      const data = await saveBranding({
        company_name: brandingForm.company_name || "",
        company_logo_data_url: brandingForm.company_logo_data_url || "",
      });
      setBrandingForm({ ...EMPTY_BRANDING, ...(data.branding || {}) });
      setStatus(t("settings.savedGeneral"));
      window.dispatchEvent(new CustomEvent("helix-branding-changed"));
    } catch (err) {
      setError(failMessage(err, t, "common.saveFailed"));
    }
  }

  function handleCompanyLogoFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setLogoError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLogoError(t("settings.companyLogoInvalid"));
      return;
    }
    if (file.size > 250_000) {
      setLogoError(t("settings.companyLogoTooLarge"));
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl) {
        setLogoError(t("settings.companyLogoInvalid"));
        return;
      }
      setBrandingForm((prev) => ({
        ...prev,
        company_logo_data_url: dataUrl,
      }));
    };
    reader.onerror = () => setLogoError(t("settings.companyLogoInvalid"));
    reader.readAsDataURL(file);
  }

  async function handleSaveDatabase(event) {
    event.preventDefault();
    setError(null);
    setStatus(null);
    try {
      const engine = dbForm.engine || "sqlite";
      const trimmedConn = (connectionString || "").trim();
      const staleSqliteConn = trimmedConn.toLowerCase().startsWith("file:");
      const payload =
        connectionStringDirty && trimmedConn && !(engine !== "sqlite" && staleSqliteConn)
          ? { connection_string: trimmedConn, engine }
          : engine === "sqlite"
            ? { engine: "sqlite", name: "helix-sample.sqlite" }
            : {
                engine,
                host: dbForm.host,
                port: Number(dbForm.port) || defaultPortForEngine(engine),
                name: dbForm.name,
                user: dbForm.user,
                password: dbForm.password,
                driver: dbForm.driver,
                sslmode: dbForm.sslmode,
                encrypt: dbForm.encrypt,
                trust_server_certificate: dbForm.trust_server_certificate,
              };
      const data = await saveDatabaseSettings(payload);
      setDbForm({ ...EMPTY_DB, ...data.database });
      setConnectionString(data.connection_string || "");
      setConnectionStringDirty(false);
      setStatus(t("settings.dbSaved"));
      checkConnection({ silent: true });
    } catch (err) {
      setError(failMessage(err, t, "common.saveFailed"));
    }
  }

  async function handleSaveLlm(event) {
    event.preventDefault();
    setError(null);
    setStatus(null);
    try {
      const payload = {
        base_url: (orForm.base_url || "").trim(),
        default_model: orForm.default_model,
        agents: orForm.agents,
        workspace: (orForm.workspace || "").trim(),
        mode: (orForm.mode || "").trim(),
      };
      if (orForm.token?.trim()) {
        payload.token = orForm.token.trim();
      }
      const data = await saveOpenRouterSettings(payload);
      const providerData = await saveProvider(provider);
      setProvider(providerData.provider || provider);
      setOrForm({ ...EMPTY_OPENROUTER, ...data.openrouter, token: "" });
      setStatus(t("settings.llmSaved"));
      checkConnection({ silent: true });
      if (data.openrouter?.token_configured) {
        await refreshModels({ tokenConfigured: true });
      }
    } catch (err) {
      setError(failMessage(err, t, "common.saveFailed"));
    }
  }

  async function refreshModels({
    tokenConfigured = activeTokenConfigured,
  } = {}) {
    if (!tokenConfigured && !(orForm.token || "").trim()) {
      setModels([]);
      setModelsError(null);
      setModelsLoading(false);
      return;
    }
    setModelsLoading(true);
    setModelsError(null);
    try {
      const data = await fetchOpenRouterModels({ force: true, silent: true });
      setModels(data.models || []);
    } catch (err) {
      setModelsError(
        err instanceof Error ? err.message : t("settings.modelsFail"),
      );
    } finally {
      setModelsLoading(false);
    }
  }

  if (tabParam === "agents") {
    return <Navigate to="/agents" replace />;
  }

  if (loading) {
    return <p className="text-sm text-muted">{t("settings.loading")}</p>;
  }

  const agentSource = orForm.agents;
  const agentIdPool = Object.keys(agentSource || {}).length
    ? Object.keys(agentSource)
    : Object.keys(agentNameById);
  const filteredLlmAgents = LLM_AGENT_IDS.filter(
    (id) => id === "orchester" || agentIdPool.includes(id),
  );
  const agentIds = sortStrings(filteredLlmAgents, locale).sort((a, b) =>
    compareAz(agentLabel(a), agentLabel(b), locale),
  );

  const modelPlaceholder =
    provider === "openai_compatible"
      ? t("settings.modelsSearch")
      : t("settings.modelsSearchOpenRouter");

  function sectionErrorMessage(failure) {
    const message =
      translateKnownMessage(t, failure.message) || t("common.failedToLoad");
    return t(failure.key, { message });
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <PageHeader icon={SettingsIcon} title={t("settings.title")} />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
      <aside className="flex shrink-0 flex-col gap-2 border-b border-line/80 bg-paper/50 p-2 md:w-1/4 md:min-w-[10rem] md:max-w-[16rem] md:border-b-0 md:border-e">
        <nav
          className="flex gap-1 overflow-x-auto md:min-h-0 md:flex-1 md:flex-col md:overflow-y-auto md:overflow-x-hidden"
          role="tablist"
          aria-label={t("settings.categoriesAria")}
        >
          {tabs.map((tab) => (
            <IconButton
              key={tab.id}
              type="button"
              role="tab"
              icon={tabIcon(tab.id)}
              aria-selected={activeSection === tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={[
                "shrink-0 rounded-xl px-3 py-2 text-start text-sm font-medium transition md:w-full",
                activeSection === tab.id
                  ? "bg-moss text-white"
                  : "border border-line bg-fog/40 text-ink hover:bg-fog",
              ].join(" ")}
            >
              {tab.label}
            </IconButton>
          ))}
        </nav>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto p-2 sm:p-3">
        {error ? (
          <p className="shrink-0 rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
            {translateKnownMessage(t, error) || error}
          </p>
        ) : null}
        {sectionErrors.length ? (
          <div className="shrink-0 space-y-1 rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
            <p className="font-medium">{t("settings.sectionLoadFailed")}</p>
            <ul className="list-disc ps-5">
              {sectionErrors.map((failure) => (
                <li key={failure.key}>{sectionErrorMessage(failure)}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <FlashMessage message={status} />

      {activeSection === "general" ? (
        <div className="space-y-3">
          <AdminGuideDownloadCard t={t} />
        <form
          onSubmit={handleSaveGeneral}
          className="space-y-3 rounded-2xl border border-line/80 bg-paper/80 p-4 backdrop-blur-sm"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            {t("settings.tabGeneral")}
          </h2>
          <p className="text-sm text-muted">{t("settings.generalIntro")}</p>
          <Field label={t("settings.companyName")} id="company_name">
            <input
              id="company_name"
              value={brandingForm.company_name || ""}
              onChange={(e) =>
                setBrandingForm((prev) => ({
                  ...prev,
                  company_name: e.target.value,
                }))
              }
              className={inputClass}
              placeholder={t("settings.companyNamePlaceholder")}
            />
          </Field>
          <Field label={t("settings.companyLogo")} id="company_logo">
            <div className="space-y-2">
              {brandingForm.company_logo_data_url ? (
                <div className="flex items-center gap-3">
                  <img
                    src={brandingForm.company_logo_data_url}
                    alt={t("layout.companyLogoAlt")}
                    className="h-14 w-auto max-w-[8rem] rounded-lg border border-line/80 object-contain bg-fog/40 p-1"
                  />
                  <IconButton
                    type="button"
                    onClick={() =>
                      setBrandingForm((prev) => ({
                        ...prev,
                        company_logo_data_url: "",
                      }))
                    }
                    className="rounded-lg border border-line bg-fog px-3 py-1.5 text-xs font-medium hover:bg-fog/80"
                  >
                    {t("settings.companyLogoClear")}
                  </IconButton>
                </div>
              ) : null}
              <input
                id="company_logo"
                type="file"
                accept="image/*"
                onChange={handleCompanyLogoFile}
                className="block w-full text-sm text-ink file:me-3 file:rounded-lg file:border-0 file:bg-fog file:px-3 file:py-1.5 file:text-sm file:font-medium"
              />
              <p className="text-xs text-muted">{t("settings.companyLogoHint")}</p>
              {logoError ? (
                <p className="text-sm text-warn" role="alert">
                  {logoError}
                </p>
              ) : null}
            </div>
          </Field>
          <div className="flex justify-end pt-1">
            <IconButton
              type="submit"
              icon={Save}
              className="rounded-xl bg-moss px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              {t("common.save")}
            </IconButton>
          </div>
        </form>
        </div>
      ) : null}

      {activeSection === "status" ? <StatusLogsSection /> : null}

      {activeSection === "llm" ? (
        <>
        <form
          onSubmit={handleSaveLlm}
          className="space-y-3 rounded-2xl border border-line/80 bg-paper/80 p-4 backdrop-blur-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              {t("settings.tabLlm")}
            </h2>
            <IconButton
              type="button"
              icon={RefreshCw}
              onClick={() => refreshModels()}
              disabled={modelsLoading || !activeTokenConfigured}
              className="rounded-lg border border-line bg-fog px-3 py-1.5 text-xs font-medium hover:bg-fog/80 disabled:opacity-50"
            >
              {t("settings.refreshModels")}
            </IconButton>
          </div>
          <p className="text-sm text-muted">{t("settings.llmIntro")}</p>

          <Field label={t("settings.api")} id="llm_api">
            <select
              id="llm_api"
              value={provider}
              onChange={(e) => handleApiChange(e.target.value)}
              className={inputClass}
            >
              {apiOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t("settings.baseUrl")} id="llm_base_url">
            <input
              id="llm_base_url"
              value={orForm.base_url || ""}
              onChange={(e) => updateOrField("base_url", e.target.value)}
              className={inputClass}
              placeholder={
                provider === "openrouter"
                  ? OPENROUTER_BASE_URL
                  : t("settings.baseUrlPlaceholder")
              }
              spellCheck={false}
            />
          </Field>

          <Field label={t("settings.workspace")} id="llm_workspace">
            <input
              id="llm_workspace"
              value={orForm.workspace || ""}
              onChange={(e) => updateOrField("workspace", e.target.value)}
              className={inputClass}
              placeholder={t("settings.workspacePlaceholder")}
              spellCheck={false}
            />
          </Field>
          <p className="text-xs text-muted">{t("settings.workspaceHint")}</p>

          <Field label={t("settings.apiKey")} id="llm_token">
            <input
              id="llm_token"
              type="password"
              autoComplete="off"
              value={orForm.token || ""}
              onChange={(e) => updateOrField("token", e.target.value)}
              className={inputClass}
              placeholder={
                activeTokenConfigured
                  ? t("settings.apiKeySavedPlaceholder")
                  : t("settings.apiKeyPastePlaceholder")
              }
              spellCheck={false}
            />
          </Field>
          <p className="text-xs text-muted">
            {activeTokenConfigured
              ? t("settings.apiKeySavedHint")
              : t("settings.apiKeyPasteHint")}
          </p>

          {modelsError ? (
            <p className="rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
              {t("settings.modelsError", {
                message: translateKnownMessage(t, modelsError),
              })}
            </p>
          ) : null}

          <Field label={t("settings.defaultModel")} id="default_model">
            <ModelCombobox
              id="default_model"
              value={orForm.default_model}
              onChange={(v) => updateOrField("default_model", v)}
              models={models}
              loading={modelsLoading}
              placeholder={modelPlaceholder}
            />
          </Field>

          <div>
            <h3 className="mb-2 text-sm font-medium text-ink">{t("settings.perAgent")}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {agentIds.map((agentId) => (
                <Field
                  key={agentId}
                  label={agentLabel(agentId)}
                  id={`agent-${agentId}`}
                >
                  <ModelCombobox
                    id={`agent-${agentId}`}
                    value={orForm.agents?.[agentId]?.model || "composer-2.5"}
                    onChange={(v) => updateAgentModel(agentId, v)}
                    models={models}
                    loading={modelsLoading}
                    placeholder={modelPlaceholder}
                  />
                </Field>
              ))}
            </div>
          </div>

          <IconButton
            type="submit"
            icon={Save}
            className="rounded-xl bg-moss px-5 py-2.5 text-sm font-semibold text-white hover:bg-moss-deep"
          >
            {t("settings.saveLlm")}
          </IconButton>
        </form>
        <div className="mt-3">
          <LlmChatTester
            models={models}
            defaultModel={orForm.default_model}
            orForm={orForm}
          />
        </div>
        </>
      ) : null}

      {activeSection === "database" ? (
        <form
          onSubmit={handleSaveDatabase}
          className="space-y-3 rounded-2xl border border-line/80 bg-paper/80 p-4 backdrop-blur-sm"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            {t("settings.tabDatabase")}
          </h2>

          <Field label={t("settings.dbEngine")} id="engine">
            <select
              id="engine"
              value={dbForm.engine || "sqlite"}
              onChange={(e) => updateDbField("engine", e.target.value)}
              className={inputClass}
            >
              {dbEngines.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {engineLabel(t, opt.value)}
                </option>
              ))}
            </select>
          </Field>

          {dbForm.engine === "sqlite" ? (
            <div className="space-y-3">
              <p className="text-sm text-muted">{t("settings.sqliteHint")}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {(sampleTiers.length
                  ? sampleTiers
                  : [
                      { id: "small", label: "Small", size_label: "~1.2 MB", exists: false, filename: "helix-sample-small.sqlite" },
                      { id: "medium", label: "Medium", size_label: "~2.8 MB", exists: false, filename: "helix-sample-medium.sqlite" },
                      { id: "big", label: "Big", size_label: "~55 MB", exists: false, filename: "helix-sample-big.sqlite" },
                    ]
                ).map((tier) => {
                  const active =
                    (dbForm.name || "").toLowerCase() ===
                    String(tier.filename || "").toLowerCase();
                  const busy = tierBusy === tier.id;
                  return (
                    <div
                      key={tier.id}
                      className={[
                        "rounded-xl border p-3",
                        active
                          ? "border-moss bg-moss/10"
                          : "border-line bg-fog/40",
                      ].join(" ")}
                    >
                      <p className="text-sm font-semibold text-ink">
                        {t(`settings.tier.${tier.id}`)}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {tier.size_label}
                        {tier.size_hint ? ` (${t("settings.tierApprox")})` : ""}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-muted">
                        {tier.filename}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {!tier.exists ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleEnsureTier(tier.id)}
                            className="rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-fog disabled:opacity-60"
                          >
                            {busy
                              ? t("settings.tierWorking")
                              : t("settings.tierDownload")}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busy || active}
                            onClick={() => handleUseTier(tier)}
                            className="rounded-lg bg-moss px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-moss-deep disabled:opacity-60"
                          >
                            {active
                              ? t("settings.tierInUse")
                              : busy
                                ? t("settings.tierWorking")
                                : t("settings.tierUse")}
                          </button>
                        )}
                        {tier.exists && !active ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleEnsureTier(tier.id)}
                            className="rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-fog disabled:opacity-60"
                          >
                            {t("settings.tierRedownload")}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t("settings.host")} id="host">
                  <input
                    id="host"
                    value={dbForm.host}
                    onChange={(e) => updateDbField("host", e.target.value)}
                    className={inputClass}
                    placeholder={
                      dbForm.engine === "postgresql"
                        ? "127.0.0.1"
                        : "sql.example.com"
                    }
                  />
                </Field>
                <Field label={t("settings.port")} id="port">
                  <input
                    id="port"
                    type="number"
                    value={dbForm.port}
                    onChange={(e) => updateDbField("port", e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label={t("settings.name")} id="name">
                  <input
                    id="name"
                    value={dbForm.name}
                    onChange={(e) => updateDbField("name", e.target.value)}
                    className={inputClass}
                  />
                </Field>
                {dbForm.engine === "postgresql" ? (
                  <Field label={t("settings.sslMode")} id="sslmode">
                    <select
                      id="sslmode"
                      value={dbForm.sslmode || "prefer"}
                      onChange={(e) => updateDbField("sslmode", e.target.value)}
                      className={inputClass}
                    >
                      {sslModes.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : (
                  <Field label={t("settings.driver")} id="driver">
                    <input
                      id="driver"
                      value={dbForm.driver}
                      onChange={(e) => updateDbField("driver", e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                )}
                <Field label={t("settings.user")} id="user">
                  <input
                    id="user"
                    value={dbForm.user}
                    onChange={(e) => updateDbField("user", e.target.value)}
                    className={inputClass}
                    autoComplete="off"
                  />
                </Field>
                <Field label={t("settings.password")} id="password">
                  <input
                    id="password"
                    type="password"
                    value={dbForm.password}
                    onChange={(e) => updateDbField("password", e.target.value)}
                    className={inputClass}
                    autoComplete="new-password"
                  />
                </Field>
              </div>

              {dbForm.engine === "sqlserver" ? (
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={Boolean(dbForm.encrypt)}
                      onChange={(e) => updateDbField("encrypt", e.target.checked)}
                      className="size-4 rounded border-line text-moss"
                    />
                    {t("settings.encrypt")}
                  </label>
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={Boolean(dbForm.trust_server_certificate)}
                      onChange={(e) =>
                        updateDbField("trust_server_certificate", e.target.checked)
                      }
                      className="size-4 rounded border-line text-moss"
                    />
                    {t("settings.trustCert")}
                  </label>
                </div>
              ) : null}
            </>
          )}

          <div>
            <label htmlFor="conn" className="block text-sm font-medium text-ink">
              {t("settings.connectionString")}
            </label>
            <textarea
              id="conn"
              rows={3}
              value={connectionString}
              onChange={(e) => {
                setConnectionString(e.target.value);
                setConnectionStringDirty(true);
              }}
              className="mt-1 w-full resize-y rounded-xl border border-line bg-fog/40 px-3 py-2 font-mono text-[12px] text-ink outline-none focus:border-moss focus:ring-2 focus:ring-moss/30"
              spellCheck={false}
            />
            <p className="mt-1 text-xs text-muted">{t("settings.connectionHint")}</p>
          </div>

          <IconButton
            type="submit"
            icon={Save}
            className="rounded-xl bg-moss px-5 py-2.5 text-sm font-semibold text-white hover:bg-moss-deep"
          >
            {t("settings.saveDatabase")}
          </IconButton>
        </form>
      ) : null}
      </div>
      </div>
    </div>
  );
}

const inputClass =
  "mt-1 w-full rounded-xl border border-line bg-fog/40 px-3 py-2 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/30";

function Field({ label, id, children }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
    </div>
  );
}
