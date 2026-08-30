import { useCallback, useEffect, useState } from "react";

const FLASH_MS = 3000;

export default function useFlash(durationMs = FLASH_MS) {
  const [flash, setFlash] = useState({ n: 0, text: null });

  useEffect(() => {
    if (!flash.text) return undefined;
    const timer = window.setTimeout(() => {
      setFlash((prev) => (prev.n === flash.n ? { n: prev.n, text: null } : prev));
    }, durationMs);
    return () => window.clearTimeout(timer);
  }, [flash, durationMs]);

  const setStatus = useCallback((text) => {
    if (!text) {
      setFlash((prev) => ({ n: prev.n, text: null }));
      return;
    }
    setFlash((prev) => ({ n: prev.n + 1, text }));
  }, []);

  return [flash.text, setStatus];
}
