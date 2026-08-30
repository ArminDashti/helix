import { useEffect, useState } from "react";

export default function FlashMessage({ message, durationMs = 3000 }) {
  const [visible, setVisible] = useState(Boolean(message));

  useEffect(() => {
    if (!message) {
      setVisible(false);
      return undefined;
    }
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), durationMs);
    return () => window.clearTimeout(timer);
  }, [message, durationMs]);

  if (!visible || !message) return null;
  return (
    <p
      className="shrink-0 rounded-xl border border-line bg-paper/80 px-4 py-2 text-sm text-moss"
      role="status"
    >
      {message}
    </p>
  );
}
