/**
 * Lightweight live sync bus — zero deps.
 * - in-tab pub/sub via Set per resource
 * - cross-tab via BroadcastChannel
 * - window CustomEvent fallback
 */

const ALL = "*";
const listeners = new Map(); // resource -> Set<fn>
const anyListeners = new Set();
let bc = null;

try {
  if (typeof BroadcastChannel !== "undefined") {
    bc = new BroadcastChannel("helix-live-sync");
    bc.onmessage = (ev) => {
      const msg = ev.data;
      if (!msg || typeof msg.resource !== "string") return;
      notifyLocal(msg.resource, msg.source || "broadcast");
    };
  }
} catch {
  bc = null;
}

function notifyLocal(resource, source) {
  // wildcard
  for (const fn of anyListeners) {
    try { fn(resource, source); } catch {}
  }
  const set = listeners.get(resource);
  if (set) {
    for (const fn of set) { try { fn(resource, source); } catch {} }
  }
  const wild = listeners.get(ALL);
  if (wild) {
    for (const fn of wild) { try { fn(resource, source); } catch {} }
  }
  // also dispatch DOM event for non-React listeners
  try {
    window.dispatchEvent(new CustomEvent("helix:resource-changed", { detail: { resource, source } }));
  } catch {}
}

export function emitLiveChange(resource, source = "local") {
  if (!resource) return;
  notifyLocal(resource, source);
  if (bc) {
    try { bc.postMessage({ resource, source, at: Date.now() }); } catch {}
  }
  // storage event fallback for older tabs
  try {
    localStorage.setItem("__helix_live__", JSON.stringify({ resource, at: Date.now() }));
  } catch {}
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== "__helix_live__" || !e.newValue) return;
    try {
      const v = JSON.parse(e.newValue);
      if (v && v.resource) notifyLocal(v.resource, "storage");
    } catch {}
  });
}

export function subscribeLive(resource, fn) {
  const key = resource || ALL;
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(fn);
  return () => {
    const s = listeners.get(key);
    if (s) s.delete(fn);
  };
}

export function subscribeAny(fn) {
  anyListeners.add(fn);
  return () => anyListeners.delete(fn);
}

// Map API path -> resource key(s) for optimistic broadcast after mutations
const PATH_RESOURCE = [
  [/\/api\/agents\//, "agents"],
  [/\/api\/rules\//, "rules"],
  [/\/api\/skills\//, "skills"],
  [/\/api\/references\//, "references"],
  [/\/api\/results\//, "results"],
  [/\/api\/logs\//, "logs"],
  [/\/api\/docs\//, "docs"],
  [/\/api\/db-explorer\//, "db-explorer"],
  [/\/api\/admin\/database\//, "config"],
  [/\/api\/admin\/provider\//, "config"],
  [/\/api\/admin\/openrouter\//, "config"],
  [/\/api\/admin\/branding\//, "branding"],
  [/\/api\/admin\/pipeline-graph\//, "pipeline_graph"],
  [/\/api\/admin\/users\//, "users"],
  [/\/api\/sample-tiers\//, "database"],
];

export function resourceFromPath(path) {
  if (!path) return null;
  for (const [re, res] of PATH_RESOURCE) {
    if (re.test(path)) return res;
  }
  // generic fallback: first segment after /api/
  const m = String(path).match(/\/api\/([^/?#]+)/);
  if (m) return m[1];
  return null;
}

export function allResourcesFromPath(path) {
  const out = [];
  if (!path) return out;
  for (const [re, res] of PATH_RESOURCE) {
    if (re.test(path)) out.push(res);
  }
  if (out.length === 0) {
    const r = resourceFromPath(path);
    if (r) out.push(r);
  }
  return out;
}

// Called from api/client.js after mutating requests
export function notifyMutation(path, method) {
  const m = String(method || "GET").toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return;
  const resources = allResourcesFromPath(path);
  // Special: config changes affect multiple views
  for (const r of resources) {
    emitLiveChange(r, "mutation");
    // config/pipeline_graph also bumps agents/docs
    if (r === "config") {
      emitLiveChange("pipeline_graph", "mutation:config");
      emitLiveChange("database", "mutation:config");
    }
    if (r === "pipeline_graph") {
      emitLiveChange("config", "mutation:pipeline");
    }
  }
  // Always bump global
  emitLiveChange(ALL, "mutation");
}
