import {
  applyLocale,
  readStoredLocale,
} from "./i18n/applyLocale.js";

const THEME_STORAGE_KEY = "helix-theme";

function systemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolveTheme(preference) {
  if (preference === "light") return "light";
  if (preference === "system") return systemPrefersDark() ? "dark" : "light";
  return "dark";
}

try {
  const saved = localStorage.getItem(THEME_STORAGE_KEY) || "dark";
  document.documentElement.setAttribute("data-theme", resolveTheme(saved));
} catch {
  document.documentElement.setAttribute("data-theme", "dark");
}

applyLocale(readStoredLocale());

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
