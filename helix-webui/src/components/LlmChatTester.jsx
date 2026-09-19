import { useState, useRef, useEffect } from "react";
import { Send, Loader2, MessageSquare, Clock, Cpu, Database } from "lucide-react";
import IconButton from "./IconButton.jsx";
import { testOpenRouterChat } from "../api/client.js";
import { useI18n } from "../context/I18nContext.jsx";
import { translateKnownMessage } from "../i18n/apiErrors.js";

export default function LlmChatTester({ models = [], defaultModel, orForm }) {
  const { t } = useI18n();
  const [messages, setMessages] = useState([]); // {role, content, meta}
  const [input, setInput] = useState("");
  const [model, setModel] = useState(defaultModel || "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (defaultModel) setModel(defaultModel);
  }, [defaultModel]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, sending]);

  async function handleSend(e) {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    setError(null);
    const userMsg = { role: "user", content: trimmed, at: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);
    try {
      const res = await testOpenRouterChat({ message: trimmed, model: model || undefined });
      const assistantMsg = {
        role: "assistant",
        content: res.reply || "",
        meta: {
          model: res.model,
          provider: res.provider,
          base_url: res.base_url,
          elapsed_s: res.elapsed_s,
          usage: res.usage,
        },
        at: new Date().toISOString(),
        raw: res.raw,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(translateKnownMessage(t, msg) || msg);
    } finally {
      setSending(false);
    }
  }

  const provider = orForm?.base_url || "";
  const workspace = orForm?.workspace || "";
  const tokenConfigured = orForm?.token_configured;

  return (
    <div className="space-y-3 rounded-2xl border border-moss/30 bg-moss/5 p-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="size-4 text-moss" />
        <h3 className="text-sm font-semibold text-ink">{t("settings.llmTesterTitle") || "Test the model — chat here"}</h3>
      </div>
      <p className="text-xs text-muted">{t("settings.llmTesterHint") || "Send a message to the currently configured LLM to verify the API key, base URL and model work. No data is saved."}</p>

      <div className="grid gap-3 sm:grid-cols-2 text-xs">
        <div className="rounded-xl border border-line bg-paper px-3 py-2">
          <p className="font-medium text-muted flex items-center gap-1.5"><Database className="size-3" /> Base URL</p>
          <p className="mt-1 break-all font-mono text-ink">{provider || "—"}</p>
          {workspace ? <p className="mt-1 text-muted">workspace: <span className="font-mono text-ink">{workspace}</span></p> : null}
          <p className="mt-1 text-muted">API key: {tokenConfigured ? "configured" : "not set"}</p>
        </div>
        <div className="rounded-xl border border-line bg-paper px-3 py-2">
          <label htmlFor="tester-model" className="font-medium text-muted flex items-center gap-1.5"><Cpu className="size-3" /> Model</label>
          <select id="tester-model" value={model} onChange={(e) => setModel(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-fog/40 px-2 py-1.5 text-sm outline-none focus:border-moss focus:ring-1 focus:ring-moss/30">
            <option value="">{defaultModel || "auto"}</option>
            {(models || []).slice(0, 100).map((m) => (
              <option key={m.id} value={m.id}>{m.id}</option>
            ))}
          </select>
          <p className="mt-1 text-muted">Default: <span className="font-mono text-ink">{defaultModel || "auto"}</span></p>
        </div>
      </div>

      <div ref={listRef} className="max-h-64 overflow-y-auto space-y-2 rounded-xl border border-line bg-paper p-3">
        {messages.length === 0 ? (
          <p className="text-sm text-muted">{t("settings.llmTesterEmpty") || "No messages yet. Try: 'Hello, what model are you?'"}</p>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={["flex", m.role === "user" ? "justify-end" : "justify-start"].join(" ")}>
              <div className={["max-w-[85%] rounded-xl px-3 py-2 text-sm", m.role === "user" ? "bg-moss text-white" : "border border-line bg-fog/50 text-ink"].join(" ")}>
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                {m.meta ? (
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] opacity-80">
                    <span className="inline-flex items-center gap-1 rounded bg-paper px-1.5 py-0.5 border border-line"><Cpu className="size-3" />{m.meta.model}</span>
                    {m.meta.elapsed_s != null ? <span className="inline-flex items-center gap-1 rounded bg-paper px-1.5 py-0.5 border border-line"><Clock className="size-3" />{m.meta.elapsed_s}s</span> : null}
                    {m.meta.usage ? <span className="rounded bg-paper px-1.5 py-0.5 border border-line">tokens: {m.meta.usage.total_tokens ?? `${m.meta.usage.prompt_tokens ?? "?"}/${m.meta.usage.completion_tokens ?? "?"}`}</span> : null}
                  </div>
                ) : null}
                {m.meta?.provider ? <p className="mt-1 text-[11px] opacity-60 font-mono">{m.meta.provider} · {m.meta.base_url}</p> : null}
              </div>
            </div>
          ))
        )}
        {sending ? <p className="flex items-center gap-2 text-sm text-muted"><Loader2 className="size-4 animate-spin" /> {t("settings.llmTesterSending") || "Sending…"}</p> : null}
      </div>

      {error ? <p className="rounded-xl border border-warn-border bg-warn-bg px-3 py-2 text-sm text-warn">{error}</p> : null}

      <form onSubmit={handleSend} className="flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={t("settings.llmTesterPlaceholder") || "Type a message to test the LLM…"} className="flex-1 rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/30" disabled={sending} />
        <IconButton type="submit" icon={sending ? Loader2 : Send} disabled={sending || !input.trim()} className="rounded-xl bg-moss px-4 py-2 text-sm font-semibold text-white hover:bg-moss-deep disabled:opacity-50">
          {t("settings.llmTesterSend") || "Send"}
        </IconButton>
      </form>

      {messages.length ? (
        <button type="button" onClick={() => { setMessages([]); setError(null); }} className="text-xs text-muted underline hover:text-ink">{t("settings.llmTesterClear") || "Clear chat"}</button>
      ) : null}
    </div>
  );
}
