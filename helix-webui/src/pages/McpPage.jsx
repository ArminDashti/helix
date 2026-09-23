import { useCallback, useEffect, useState } from "react";
import { Plug, Power, Server } from "lucide-react";
import {
  configureSqlServerMcp,
  fetchMcps,
  toggleMcp,
} from "../api/client.js";
import IconButton from "../components/IconButton.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { useI18n } from "../context/I18nContext.jsx";
import { failMessage } from "../i18n/apiErrors.js";

const SQL_BUSY = "__sql__";

export default function McpPage() {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      const next = await fetchMcps();
      setData(next);
      setError(null);
    } catch (err) {
      setError(failMessage(err, t, "mcp.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleToggle(server) {
    setBusy(server.name);
    setError(null);
    setNotice(null);
    try {
      const next = await toggleMcp(server.name, !server.enabled);
      setData(next);
    } catch (err) {
      setError(failMessage(err, t, "mcp.toggleFailed"));
    } finally {
      setBusy("");
    }
  }

  async function handleConfigureSql() {
    setBusy(SQL_BUSY);
    setError(null);
    setNotice(null);
    try {
      const next = await configureSqlServerMcp();
      setData(next);
      setNotice(t("mcp.configured"));
    } catch (err) {
      setError(failMessage(err, t, "mcp.configureFailed"));
    } finally {
      setBusy("");
    }
  }

  if (loading) {
    return <p className="text-sm text-muted">{t("mcp.loading")}</p>;
  }

  const servers = data?.servers || [];
  const sqlServer = servers.find((s) => s.is_sql_server);

  return (
    <div className="hx-rise flex h-full min-h-0 flex-col gap-3">
      <PageHeader icon={Plug} title={t("nav.mcp")}>
        <p className="mt-1 text-sm text-muted">{t("mcp.subtitle")}</p>
      </PageHeader>

      {error ? (
        <p className="shrink-0 rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="shrink-0 rounded-xl border border-moss/40 bg-moss/10 px-4 py-2 text-sm text-moss">
          {notice}
        </p>
      ) : null}

      <section className="shrink-0 rounded-2xl border border-line/80 bg-paper/80 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Server className="size-4" aria-hidden="true" />
              {t("mcp.sqlTitle")}
            </h2>
            <p className="mt-1 text-xs text-muted">{t("mcp.sqlDesc")}</p>
            <p className="mt-1 text-xs text-muted">
              {t("mcp.configPath")}
              <code className="ms-1 rounded-lg bg-fog/60 px-1.5 py-0.5 font-mono text-[11px] text-ink">
                {data?.config_path || ""}
              </code>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {sqlServer ? (
              <span
                className={[
                  "rounded-lg border px-2 py-1 text-xs font-semibold",
                  sqlServer.enabled
                    ? "border-moss/40 bg-moss/10 text-moss"
                    : "border-line bg-fog/50 text-muted",
                ].join(" ")}
              >
                {sqlServer.enabled ? t("mcp.enabled") : t("mcp.disabled")}
              </span>
            ) : null}
            <IconButton
              type="button"
              icon={Server}
              disabled={busy === SQL_BUSY || !data?.exists}
              onClick={handleConfigureSql}
              className="h-10 shrink-0 rounded-xl bg-moss px-4 text-sm font-semibold text-white hover:bg-moss-deep disabled:opacity-50"
            >
              {busy === SQL_BUSY ? t("mcp.configuring") : t("mcp.configure")}
            </IconButton>
          </div>
        </div>
        {!data?.exists ? (
          <p className="mt-2 text-xs text-warn">{t("mcp.notFound")}</p>
        ) : null}
      </section>

      <section className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto rounded-2xl border border-line/80 bg-paper/80 p-4">
        <h2 className="shrink-0 text-sm font-semibold text-ink">
          {t("mcp.listTitle")}
        </h2>
        {servers.length === 0 ? (
          <p className="text-sm text-muted">{t("mcp.empty")}</p>
        ) : (
          <ul className="space-y-2">
            {servers.map((server) => (
              <li
                key={server.name}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-line/70 bg-fog/40 px-3 py-2"
              >
                <span className="min-w-[10rem] font-mono text-sm font-semibold text-ink">
                  {server.name}
                </span>
                <span className="rounded-lg border border-line bg-fog/60 px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide text-muted">
                  {server.transport === "http" ? "HTTP" : "stdio"}
                </span>
                <span className="min-w-0 max-w-[28rem] flex-1 truncate font-mono text-xs text-muted">
                  {server.transport === "http"
                    ? server.url
                    : [server.command, ...server.args].join(" ")}
                </span>
                {server.env_keys?.length ? (
                  <span className="max-w-[16rem] truncate text-[11px] text-muted">
                    {t("mcp.envKeys")}: {server.env_keys.join(", ")}
                  </span>
                ) : null}
                <span
                  className={[
                    "ms-auto shrink-0 rounded-lg border px-2 py-0.5 text-[11px] font-semibold",
                    server.enabled
                      ? "border-moss/40 bg-moss/10 text-moss"
                      : "border-line bg-fog/50 text-muted",
                  ].join(" ")}
                >
                  {server.enabled ? t("mcp.enabled") : t("mcp.disabled")}
                </span>
                <IconButton
                  type="button"
                  icon={Power}
                  disabled={busy === server.name || !data?.exists}
                  onClick={() => handleToggle(server)}
                  className={[
                    "h-10 shrink-0 rounded-xl px-3 text-xs font-semibold transition",
                    server.enabled
                      ? "border border-line bg-fog/60 text-ink hover:bg-fog"
                      : "border border-moss/40 bg-moss text-white hover:bg-moss-deep",
                  ].join(" ")}
                >
                  {busy === server.name
                    ? "…"
                    : server.enabled
                      ? t("mcp.disable")
                      : t("mcp.enable")}
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
