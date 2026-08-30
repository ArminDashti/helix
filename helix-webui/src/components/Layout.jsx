import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  BarChart3,
  Bot,
  Database,
  LayoutTemplate,
  Monitor,
  Moon,
  Play,
  Scale,
  ScrollText,
  Settings,
  Shield,
  Sparkles,
  Sun,
  Table2,
  User,
} from "lucide-react";
import { useApiStatus } from "../context/ApiStatusContext.jsx";
import { useI18n } from "../context/I18nContext.jsx";
import { fetchBranding } from "../api/client.js";
import { assetUrl } from "../utils/assetUrl.js";
import pkg from "../../package.json";

const THEME_STORAGE_KEY = "helix-theme";

const THEME_OPTIONS = [
  { value: "light", labelKey: "layout.theme.light", icon: Sun },
  { value: "dark", labelKey: "layout.theme.dark", icon: Moon },
  { value: "system", labelKey: "layout.theme.system", icon: Monitor },
];

function isConnectedStatus(status) {
  return status === "connected" || status === "configured";
}

function formatLinkStatus(status, checking, t) {
  if (checking && !status) return t("layout.status.checking");
  return isConnectedStatus(status)
    ? t("layout.status.connected")
    : t("layout.status.disconnected");
}

function StatusLine({ status, label, checking, t }) {
  const state = formatLinkStatus(status, checking, t);
  const connected = isConnectedStatus(status);
  const title = t("layout.status.lineTitle", { label, state });
  return (
    <>
      <span className="text-start text-muted" title={title}>
        {label}
      </span>
      <span
        className={`text-start ${connected ? "text-moss" : "text-danger"}`}
        title={title}
      >
        {state}
      </span>
    </>
  );
}

function systemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolveTheme(preference) {
  if (preference === "light") return "light";
  if (preference === "system") return systemPrefersDark() ? "dark" : "light";
  return "dark";
}

function readThemePreference() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") return saved;
  } catch {
    /* ignore */
  }
  return "dark";
}

function applyTheme(preference) {
  document.documentElement.setAttribute("data-theme", resolveTheme(preference));
}

function NavItem({ link }) {
  const Icon = link.icon;
  return (
    <NavLink
      to={link.to}
      end={link.end}
      title={link.label}
      className={({ isActive }) =>
        [
          "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition",
          isActive
            ? "bg-moss text-white"
            : "border border-line/80 bg-paper/80 text-ink hover:bg-fog",
        ].join(" ")
      }
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span>{link.label}</span>
    </NavLink>
  );
}

export default function Layout() {
  const { health, checking } = useApiStatus();
  const { t, locale, setLocale } = useI18n();
  const [theme, setTheme] = useState(readThemePreference);
  const [branding, setBranding] = useState({
    company_name: "",
    company_logo_data_url: "",
  });

  const mainLinks = [
    { to: "/", label: t("nav.analysis"), icon: BarChart3, end: true },
    { to: "/results", label: t("nav.results"), icon: Play },
    { to: "/canvas", label: t("nav.canvas"), icon: LayoutTemplate },
    { to: "/rules", label: t("nav.rules"), icon: Scale },
    { to: "/skills", label: t("nav.skills"), icon: Sparkles },
    { to: "/agents", label: t("nav.agents"), icon: Bot },
    { to: "/docs", label: t("nav.tableDocs"), icon: Table2 },
    { to: "/db-explorer", label: t("nav.dbExplorer"), icon: Database },
  ];

  const footerLinks = [
    { to: "/admin", label: t("nav.admin"), icon: Shield },
    { to: "/settings", label: t("nav.settings"), icon: Settings },
    { to: "/logs", label: t("nav.logs"), icon: ScrollText },
    { to: "/about-me", label: t("nav.aboutMe"), icon: User },
  ];

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    async function loadBranding() {
      try {
        const data = await fetchBranding();
        if (cancelled) return;
        setBranding({
          company_name: data?.branding?.company_name || "",
          company_logo_data_url: data?.branding?.company_logo_data_url || "",
        });
      } catch {
        if (!cancelled) {
          setBranding({ company_name: "", company_logo_data_url: "" });
        }
      }
    }
    loadBranding();
    const onChanged = () => loadBranding();
    window.addEventListener("helix-branding-changed", onChanged);
    return () => {
      cancelled = true;
      window.removeEventListener("helix-branding-changed", onChanged);
    };
  }, []);

  useEffect(() => {
    if (theme !== "system") return undefined;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const engineStatus = health?.api?.status;
  const dbStatus = health?.database?.status;
  const llmStatus = health?.llm?.status;

  return (
    <div className="flex h-dvh overflow-hidden">
      <nav
        className="flex w-[20%] min-w-[10rem] max-w-[14rem] shrink-0 flex-col gap-1 border-e border-line/80 bg-paper/60 px-2 py-2 sm:px-3"
        aria-label={t("layout.navAria")}
      >
        <div className="mb-2 flex items-center gap-2 rounded-xl border border-line/80 bg-fog/30 px-2 py-2">
          <div
            className="flex h-12 w-[4.75rem] shrink-0 items-center justify-center overflow-hidden"
            aria-label={t("layout.logoAria")}
            title={t("layout.logoTitle")}
          >
            <img
              src={assetUrl("helix-logo.png")}
              alt={t("layout.logoAlt")}
              className="h-12 w-auto max-w-[4.75rem] object-contain"
              width={76}
              height={48}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-semibold tracking-wide text-ink">
              {t("layout.brand")}
            </p>
            <p className="truncate text-[11px] text-muted">{t("layout.tagline")}</p>
          </div>
          {branding.company_logo_data_url || branding.company_name ? (
            <div className="flex min-w-0 max-w-[45%] shrink-0 flex-col items-end gap-0.5 border-s border-line/60 ps-2">
              {branding.company_logo_data_url ? (
                <img
                  src={branding.company_logo_data_url}
                  alt={
                    branding.company_name || t("layout.companyLogoAlt")
                  }
                  title={t("layout.companyLogoTitle")}
                  aria-label={t("layout.companyLogoAria")}
                  className="h-8 w-auto max-w-[4.5rem] object-contain"
                />
              ) : null}
              {branding.company_name ? (
                <p className="w-full truncate text-end text-[10px] font-medium text-ink/80">
                  {branding.company_name}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {mainLinks.map((link) => (
          <NavItem key={link.to} link={link} />
        ))}

        <div className="mt-auto space-y-1 pt-2">
          {footerLinks.map((link) => (
            <NavItem key={link.to} link={link} />
          ))}

          <NavLink
            to="/settings?tab=status"
            title={t("layout.status.openLogsTitle")}
            className="block w-full rounded-xl border border-line/80 bg-fog/40 px-3 py-2 text-start text-[11px] font-medium hover:bg-fog"
            aria-label={t("layout.status.openLogsAria")}
          >
            <span className="grid w-full grid-cols-[auto_1fr] items-baseline gap-x-2 gap-y-1 font-geek tracking-wide">
              <StatusLine
                status={llmStatus}
                label={t("layout.status.llm")}
                checking={checking}
                t={t}
              />
              <StatusLine
                status={engineStatus}
                label={t("layout.status.engine")}
                checking={checking}
                t={t}
              />
              <StatusLine
                status={dbStatus}
                label={t("layout.status.database")}
                checking={checking}
                t={t}
              />
            </span>
          </NavLink>

          <div
            className="flex flex-row gap-1 rounded-xl border border-line/80 bg-fog/40 p-1"
            role="group"
            aria-label={t("layout.languageAria")}
          >
            {[
              { value: "en", label: t("layout.languageEn") },
              { value: "fa", label: t("layout.languageFa") },
            ].map((opt) => {
              const active = locale === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setLocale(opt.value)}
                  title={opt.label}
                  aria-label={opt.label}
                  aria-pressed={active}
                  className={[
                    "flex flex-1 items-center justify-center rounded-lg py-1.5 text-xs font-semibold transition",
                    "px-2",
                    active ? "bg-moss text-white" : "text-ink hover:bg-fog",
                  ].join(" ")}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div
            className="flex flex-row gap-1 rounded-xl border border-line/80 bg-fog/40 p-1"
            role="group"
            aria-label={t("layout.themeAria")}
          >
            {THEME_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = theme === opt.value;
              const label = t(opt.labelKey);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTheme(opt.value)}
                  title={label}
                  aria-label={label}
                  aria-pressed={active}
                  className={[
                    "flex flex-1 items-center justify-center rounded-lg py-1.5 transition",
                    "px-2",
                    active ? "bg-moss text-white" : "text-ink hover:bg-fog",
                  ].join(" ")}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </button>
              );
            })}
          </div>
          <p className="rounded-xl border border-line/80 bg-fog/40 px-2 py-1.5 text-center text-sm leading-snug text-muted">
            {t("layout.credit")}
            <span className="mt-0.5 block text-xs opacity-80">
              {t("layout.version", { version: pkg.version })}
            </span>
          </p>
        </div>
      </nav>
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto p-2 sm:p-3">
        <div className="flex min-h-0 flex-1 flex-col">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
