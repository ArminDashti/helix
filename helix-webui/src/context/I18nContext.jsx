import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  applyLocale,
  localeToDir,
  persistLocale,
  readStoredLocale,
} from "../i18n/applyLocale.js";
import { translate } from "../i18n/messages.js";

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(readStoredLocale);

  useEffect(() => {
    applyLocale(locale);
    persistLocale(locale);
  }, [locale]);

  const setLocale = useCallback((next) => {
    setLocaleState(next === "fa" ? "fa" : "en");
  }, []);

  const t = useCallback(
    (key, vars) => translate(locale, key, vars),
    [locale],
  );

  const value = useMemo(
    () => ({
      locale,
      dir: localeToDir(locale),
      setLocale,
      t,
    }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}
