"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/app/actions";
import type { ChatMessage } from "@/lib/types";
import MemoryPanel from "./memory-panel";

type Fact = { category: string; key: string; value: string };

type EndResult = {
  facts_remembered: number;
  summary: string;
  mood: string;
  score: number;
  recommendation: string;
};

export default function Companion({
  elderName,
  shareCode,
  shareEnabled,
  facts,
}: {
  elderName: string;
  shareCode: string;
  shareEnabled: boolean;
  facts: Fact[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [ending, setEnding] = useState(false);
  const [result, setResult] = useState<EndResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const greeted = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);

  /** Streams one assistant turn, appending tokens as they land. */
  async function runTurn(history: ChatMessage[]) {
    setThinking(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Arjun couldn't answer just now.");
      }

      setMessages((m) => [...m, { role: "assistant", content: "" }]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((m) => {
          const next = [...m];
          next[next.length - 1] = {
            role: "assistant",
            content: next[next.length - 1].content + chunk,
          };
          return next;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setThinking(false);
    }
  }

  // Arjun speaks first, using what it remembers. This is the recall moment.
  useEffect(() => {
    if (greeted.current) return;
    greeted.current = true;
    void runTurn([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  async function send(e: React.SyntheticEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || thinking) return;

    const history: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(history);
    setInput("");
    await runTurn(history);
  }

  async function endSession() {
    if (ending) return;
    setEnding(true);
    setError(null);

    try {
      const res = await fetch("/api/session/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not finish up.");
      if (body.skipped) {
        setError("You haven't said anything yet.");
        return;
      }
      setResult(body as EndResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not finish up.");
    } finally {
      setEnding(false);
    }
  }

  const hasSpoken = messages.some((m) => m.role === "user");

  if (result) {
    return (
      <SessionClosed
        result={result}
        shareEnabled={shareEnabled}
        onAgain={() => router.refresh()}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-sand-200 bg-sand-100/70 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-clay-600">
              Arjun
            </p>
            <p className="text-base text-ink-500">Good to see you, {elderName}.</p>
          </div>
          <div className="flex items-center gap-3">
            <MemoryPanel facts={facts} shareCode={shareCode} shareEnabled={shareEnabled} />
            <form action={signOut}>
              <button className="rounded-xl px-3 py-2 text-base text-ink-500 hover:text-ink-900">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-5 px-5 py-8">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`animate-rise flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <p
                className={`max-w-[85%] whitespace-pre-wrap rounded-3xl px-6 py-4 text-xl leading-relaxed ${
                  m.role === "user"
                    ? "bg-clay-500 text-white"
                    : "bg-white text-ink-900 shadow-sm ring-1 ring-sand-200"
                }`}
              >
                {m.content}
              </p>
            </div>
          ))}

          {thinking && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex justify-start">
              <p className="rounded-3xl bg-white px-6 py-5 shadow-sm ring-1 ring-sand-200">
                <span className="dot inline-block h-2.5 w-2.5 rounded-full bg-ink-500" />
                <span className="dot ml-1.5 inline-block h-2.5 w-2.5 rounded-full bg-ink-500" />
                <span className="dot ml-1.5 inline-block h-2.5 w-2.5 rounded-full bg-ink-500" />
              </p>
            </div>
          )}

          {error && (
            <p role="alert" className="text-lg text-clay-600">
              {error}
            </p>
          )}

          <div ref={bottom} />
        </div>
      </main>

      <footer className="border-t border-sand-200 bg-sand-100/70 backdrop-blur">
        <div className="mx-auto max-w-3xl px-5 py-5">
          <form onSubmit={send} className="flex items-end gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(e);
                }
              }}
              rows={1}
              placeholder="Say something to Arjun…"
              aria-label="Your message"
              className="flex-1 resize-none rounded-2xl border-2 border-sand-200 bg-white px-5 py-4 text-xl leading-relaxed text-ink-900 placeholder:text-ink-500/60 focus:border-clay-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim() || thinking}
              className="rounded-2xl bg-clay-500 px-7 py-4 text-xl font-medium text-white transition hover:bg-clay-600 disabled:opacity-40"
            >
              Send
            </button>
          </form>

          {hasSpoken && (
            <button
              onClick={endSession}
              disabled={ending || thinking}
              className="mt-3 text-base text-ink-500 underline underline-offset-4 hover:text-ink-900 disabled:opacity-50"
            >
              {ending ? "Wrapping up…" : "I'm done for now"}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

/**
 * The consent beat: before anything reaches the family, the elder sees exactly what will be
 * sent. "Summaries, never transcript" is only trustworthy if they can read the summary.
 */
function SessionClosed({
  result,
  shareEnabled,
  onAgain,
}: {
  result: EndResult;
  shareEnabled: boolean;
  onAgain: () => void;
}) {
  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl animate-rise">
        <h1 className="text-3xl font-semibold text-ink-900">Thank you for talking.</h1>

        <p className="mt-4 text-lg text-ink-700">
          {result.facts_remembered > 0
            ? `I'll remember ${result.facts_remembered} ${
                result.facts_remembered === 1 ? "thing" : "things"
              } from today.`
            : "I'll keep today in mind."}
        </p>

        <section className="mt-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-sand-200">
          <h2 className="text-base font-medium uppercase tracking-widest text-clay-600">
            {shareEnabled ? "What your family will see" : "What would be shared"}
          </h2>
          <p className="mt-3 text-lg leading-relaxed text-ink-900">{result.summary}</p>
          <p className="mt-4 border-t border-sand-200 pt-4 text-base leading-relaxed text-ink-700">
            <span className="font-medium">Suggestion for them: </span>
            {result.recommendation}
          </p>
          <p className="mt-4 text-sm text-ink-500">
            {shareEnabled
              ? "They see this note — never the words you actually said."
              : "Sharing is off, so this stays with you."}
          </p>
        </section>

        <button
          onClick={onAgain}
          className="mt-8 rounded-2xl bg-clay-500 px-8 py-4 text-lg font-medium text-white transition hover:bg-clay-600"
        >
          Talk again
        </button>
      </div>
    </main>
  );
}
