import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useI18n } from "../context/I18nContext.jsx";
import { compareAz } from "../utils/sortOptions.js";

function modelId(m) {
  if (m == null) return "";
  if (typeof m === "string") return m;
  return String(m.id ?? m.name ?? m.slug ?? "");
}

function modelName(m) {
  if (m == null) return "";
  if (typeof m === "string") return m;
  return String(m.name ?? m.id ?? m.slug ?? "");
}

/**
 * Searchable model picker for catalog entries { id, name } (tolerant of sparse shapes).
 */
export default function ModelCombobox({
  id,
  value,
  onChange,
  models = [],
  loading = false,
  disabled = false,
  placeholder,
}) {
  const { t, locale } = useI18n();
  const listId = useId();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || "");
  const resolvedPlaceholder = placeholder ?? t("models.search");

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  useEffect(() => {
    function onDocClick(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
        setQuery(value || "");
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [value]);

  const normalized = useMemo(() => {
    const list = (Array.isArray(models) ? models : [])
      .map((m) => {
        const idValue = modelId(m);
        if (!idValue) return null;
        return { id: idValue, name: modelName(m) || idValue };
      })
      .filter(Boolean);
    if (!list.some((m) => m.id.toLowerCase() === "auto")) {
      list.push({ id: "auto", name: t("models.auto") });
    }
    list.sort(
      (a, b) =>
        compareAz(a.name, b.name, locale) || compareAz(a.id, b.id, locale),
    );
    return list;
  }, [models, locale, t]);

  const filtered = useMemo(() => {
    const q = String(query || "")
      .trim()
      .toLowerCase();
    if (!q) return normalized.slice(0, 80);
    return normalized
      .filter(
        (m) =>
          m.id.toLowerCase().includes(q) ||
          String(m.name || "")
            .toLowerCase()
            .includes(q),
      )
      .slice(0, 80);
  }, [normalized, query]);

  function selectModel(nextId) {
    onChange(nextId);
    setQuery(nextId);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative mt-1">
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        disabled={disabled}
        value={query}
        placeholder={loading ? t("models.loading") : resolvedPlaceholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onBlur={() => {
          const trimmed = query.trim();
          if (trimmed && trimmed !== value) {
            onChange(trimmed);
          } else {
            setQuery(value || "");
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            setQuery(value || "");
          }
          if (e.key === "Enter") {
            e.preventDefault();
            if (filtered[0]) {
              selectModel(filtered[0].id);
            } else if (query.trim()) {
              selectModel(query.trim());
            }
          }
        }}
        className="w-full rounded-xl border border-line bg-fog/40 px-3 py-2 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/30 disabled:opacity-50"
      />
      {open && !disabled ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-line bg-paper shadow-lg"
        >
          {loading ? (
            <li className="px-3 py-2 text-sm text-muted">{t("models.loadingShort")}</li>
          ) : filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">
              {normalized.length === 0
                ? t("models.noneLoaded")
                : t("models.noMatches")}
            </li>
          ) : (
            filtered.map((m) => (
              <li key={m.id} role="option" aria-selected={m.id === value}>
                <button
                  type="button"
                  className={[
                    "flex w-full flex-col px-3 py-2 text-start text-sm hover:bg-fog",
                    m.id === value ? "bg-moss/20" : "",
                  ].join(" ")}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectModel(m.id)}
                >
                  <span className="font-medium text-ink">{m.id}</span>
                  {m.name && m.name !== m.id ? (
                    <span className="text-xs text-muted">{m.name}</span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
