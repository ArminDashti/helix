import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { emitLiveChange, subscribeLive } from "../lib/liveBus.js";

const LiveSyncContext = createContext(null);

function apiUrl(path) {
  const base = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  if (base) return `${base}${p}`;
  const prefix = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  if (!prefix || prefix === "/") return p;
  return `${prefix}${p}`;
}

async function fetchStateVersion(signal) {
  const url = apiUrl("/api/state-version/");
  const res = await fetch(url, { signal, headers: { Accept: "application/json" }, cache: "no-store" });
  if (!res.ok) throw new Error(`state-version ${res.status}`);
  return res.json();
}

export function LiveSyncProvider({ children, pollMs = 2500, sseEnabled = true }) {
  const [version, setVersion] = useState(null);
  const [resources, setResources] = useState({});
  const [connected, setConnected] = useState(false);
  const prevRef = useRef({ version: null, resources: {} });
  const pollRef = useRef(null);
  const sseRef = useRef(null);

  const apply = useCallback((data, source = "poll") => {
    if (!data || typeof data.version !== "string") return;
    const prev = prevRef.current;
    if (data.version === prev.version) return;
    const nextRes = data.resources || {};
    const changed = [];
    if (!prev.version) {
      // first load — don't emit, just store
      prevRef.current = { version: data.version, resources: nextRes };
      setVersion(data.version);
      setResources(nextRes);
      return;
    }
    for (const k of new Set([...Object.keys(prev.resources), ...Object.keys(nextRes)])) {
      if (prev.resources[k] !== nextRes[k]) changed.push(k);
    }
    // also if version changed but no per-resource delta, bump all
    if (changed.length === 0) changed.push("*");
    prevRef.current = { version: data.version, resources: nextRes };
    setVersion(data.version);
    setResources(nextRes);
    for (const r of changed) emitLiveChange(r, source);
    emitLiveChange("*", source);
  }, []);

  // Polling loop
  useEffect(() => {
    let cancelled = false;
    let timer = null;

    async function tick() {
      if (document.visibilityState === "hidden") {
        // backoff when hidden
        timer = setTimeout(tick, Math.max(pollMs * 4, 10000));
        return;
      }
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 5000);
        const data = await fetchStateVersion(ctrl.signal);
        clearTimeout(t);
        if (!cancelled) {
          apply(data, "poll");
          setConnected(true);
        }
      } catch {
        if (!cancelled) setConnected(false);
      }
      if (!cancelled) timer = setTimeout(tick, pollMs);
    }

    // initial fetch
    tick();

    function onFocus() {
      // immediate revalidate on focus
      fetchStateVersion().then((d) => !cancelled && apply(d, "focus")).catch(() => {});
    }
    function onVis() {
      if (document.visibilityState === "visible") onFocus();
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [apply, pollMs]);

  // SSE stream (EventSource) — compliments polling for ~instant push
  useEffect(() => {
    if (!sseEnabled || typeof EventSource === "undefined") return;
    let es = null;
    let closed = false;
    function connect() {
      if (closed) return;
      try {
        const url = apiUrl("/api/events/stream");
        es = new EventSource(url);
        sseRef.current = es;
        es.addEventListener("version", (ev) => {
          try {
            const data = JSON.parse(ev.data);
            apply(data, "sse");
            setConnected(true);
          } catch {}
        });
        es.onerror = () => {
          setConnected(false);
          try { es.close(); } catch {}
          // reconnect after 3s
          setTimeout(() => { if (!closed) connect(); }, 3000);
        };
        es.onopen = () => setConnected(true);
      } catch {
        // fallback to poll only
      }
    }
    connect();
    return () => {
      closed = true;
      try { es && es.close(); } catch {}
    };
  }, [apply, sseEnabled]);

  const value = useMemo(() => ({
    version,
    resources,
    connected,
    refresh: async () => {
      try {
        const data = await fetchStateVersion();
        apply(data, "manual");
        return data;
      } catch { return null; }
    },
  }), [version, resources, connected, apply]);

  return <LiveSyncContext.Provider value={value}>{children}</LiveSyncContext.Provider>;
}

export function useLiveSync(resource, callback) {
  const cbRef = useRef(callback);
  useEffect(() => { cbRef.current = callback; }, [callback]);
  useEffect(() => {
    if (!resource) return;
    const keys = Array.isArray(resource) ? resource : [resource];
    const unsubs = keys.map((r) => subscribeLive(r, () => cbRef.current && cbRef.current(r)));
    return () => unsubs.forEach((u) => u());
  }, [resource]);
}

export function useLiveSyncContext() {
  const ctx = useContext(LiveSyncContext);
  if (!ctx) throw new Error("useLiveSyncContext must be inside LiveSyncProvider");
  return ctx;
}
