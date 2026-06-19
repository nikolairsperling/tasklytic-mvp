"use client";

import { useEffect, useRef, useState } from "react";
import { PrimaryButton } from "@/components/admin/ui";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const SUGGESTIONS = [
  "Welche Leads soll ich heute zuerst kontaktieren?",
  "Wie laeuft meine Pipeline aktuell?",
  "Wo verliere ich die meisten Leads?",
  "Welche Kampagne performt am besten?"
];

export function CopilotChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isPending]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isPending) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setError(null);
    setIsPending(true);

    try {
      const response = await fetch("/api/ai/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages })
      });
      const data = (await response.json().catch(() => null)) as { reply?: string; error?: string } | null;
      if (!response.ok || !data?.reply) {
        throw new Error(data?.error ?? "Copilot-Antwort konnte nicht erzeugt werden.");
      }
      setMessages((current) => [...current, { role: "assistant", content: data.reply as string }]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Copilot-Antwort konnte nicht erzeugt werden.");
    } finally {
      setIsPending(false);
    }
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    void send(input);
  }

  return (
    <div className="flex h-[70vh] min-h-[480px] flex-col rounded-2xl border border-white/10 bg-white/5">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Frag mich etwas zu deinen Leads, Kampagnen oder Kennzahlen. Ich nutze deine aktuellen Daten aus Tasklytic.
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => void send(suggestion)}
                  disabled={isPending}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-white/10 disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div key={index} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm ${
                  message.role === "user"
                    ? "bg-brand/15 text-ink"
                    : "border border-white/10 bg-white/5 text-slate-700"
                }`}
              >
                {message.content}
              </div>
            </div>
          ))
        )}
        {isPending ? (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-500">
              Copilot denkt nach...
            </div>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="mx-4 mb-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p>
      ) : null}

      <form onSubmit={onSubmit} className="flex items-end gap-3 border-t border-white/10 p-4">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send(input);
            }
          }}
          rows={1}
          placeholder="Nachricht an den Copilot..."
          className="min-h-11 flex-1 resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-ink outline-none focus:border-brand/50"
        />
        <PrimaryButton type="submit" disabled={isPending || input.trim().length === 0}>
          {isPending ? "Sendet..." : "Senden"}
        </PrimaryButton>
      </form>
    </div>
  );
}
