import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { fetchHealth, subscribeApiErrors } from "../api/client.js";
import ErrorModal from "../components/ErrorModal.jsx";

const ApiStatusContext = createContext(null);
const STATUS_LOG_CAP = 50;

function summarizeHealth(health) {
  if (!health) return "disconnected";
  const services = [health.database, health.llm].filter(Boolean);
  const anyIssue = services.some(
    (s) =>
      s.status &&
      s.status !== "connected" &&
      s.status !== "configured",
  );
  if (health.ok && !anyIssue) return "connected";
  if (health.api?.status === "connected") return "degraded";
  return "disconnected";
}

function fetchErrorDetail(err) {
  if (!err) return "Cannot reach the API";
  const parts = [err.message, err.detail].filter(Boolean);
  return [...new Set(parts)].join(" — ") || "Cannot reach the API";
}

function snapshotServices(health, fetchError) {
  if (!health) {
    const detail = fetchErrorDetail(fetchError);
    return {
      engine: { status: "disconnected", detail },
      database: {
        status: "disconnected",
        detail: "Engine unreachable; database status unknown",
      },
      llm: {
        status: "disconnected",
        detail: "Engine unreachable; LLM status unknown",
      },
    };
  }
  return {
    engine: {
      status: health.api?.status || "disconnected",
      detail: health.api?.detail || "",
    },
    database: {
      status: health.database?.status || "disconnected",
      detail: health.database?.detail || "",
    },
    llm: {
      status: health.llm?.status || "disconnected",
      detail: health.llm?.detail || "",
    },
  };
}

function appendStatusEvents(prevLog, prevSnap, nextSnap, at) {
  const next = [...prevLog];
  for (const service of ["llm", "engine", "database"]) {
    const before = prevSnap?.[service];
    const after = nextSnap[service];
    if (!after) continue;
    if (
      !before ||
      before.status !== after.status ||
      before.detail !== after.detail
    ) {
      next.push({
        at,
        service,
        status: after.status,
        detail: after.detail || "",
      });
    }
  }
  return next.slice(-STATUS_LOG_CAP);
}

export function ApiStatusProvider({ children }) {
  const [apiError, setApiError] = useState(null);
  const [health, setHealth] = useState(null);
  const [summary, setSummary] = useState("unknown");
  const [checking, setChecking] = useState(false);
  const [lastFetchError, setLastFetchError] = useState(null);
  const [statusLog, setStatusLog] = useState([]);
  const prevSnapRef = useRef(null);

  useEffect(() => subscribeApiErrors((err) => setApiError(err)), []);

  const checkConnection = useCallback(async ({ silent = false } = {}) => {
    setChecking(true);
    try {
      const data = await fetchHealth({ silent });
      setHealth(data);
      setLastFetchError(null);
      setSummary(summarizeHealth(data));
      const snap = snapshotServices(data, null);
      const at = data?.api?.checked_at || new Date().toISOString();
      setStatusLog((prev) =>
        appendStatusEvents(prev, prevSnapRef.current, snap, at),
      );
      prevSnapRef.current = snap;
      return data;
    } catch (err) {
      setHealth(null);
      setLastFetchError(err);
      setSummary("disconnected");
      const snap = snapshotServices(null, err);
      const at = new Date().toISOString();
      setStatusLog((prev) =>
        appendStatusEvents(prev, prevSnapRef.current, snap, at),
      );
      prevSnapRef.current = snap;
      return null;
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkConnection({ silent: false });
    const interval = window.setInterval(() => {
      checkConnection({ silent: true });
    }, 15000);
    function onFocus() {
      checkConnection({ silent: true });
    }
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [checkConnection]);

  const value = useMemo(
    () => ({
      health,
      summary,
      checking,
      checkConnection,
      lastFetchError,
      statusLog,
      apiError,
      clearApiError: () => setApiError(null),
    }),
    [
      health,
      summary,
      checking,
      checkConnection,
      lastFetchError,
      statusLog,
      apiError,
    ],
  );

  return (
    <ApiStatusContext.Provider value={value}>
      {children}
      <ErrorModal error={apiError} onDismiss={() => setApiError(null)} />
    </ApiStatusContext.Provider>
  );
}

export function useApiStatus() {
  const ctx = useContext(ApiStatusContext);
  if (!ctx) {
    throw new Error("useApiStatus must be used within ApiStatusProvider");
  }
  return ctx;
}
