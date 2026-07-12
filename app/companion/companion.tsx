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

const LANG_MAP: Record<string, string> = {
  English: "en-US",
  Hindi: "hi-IN",
  Spanish: "es-ES",
  French: "fr-FR",
  Mandarin: "zh-CN",
  German: "de-DE",
  Italian: "it-IT",
  Marathi: "mr-IN",
  Bengali: "bn-IN",
  Tamil: "ta-IN",
  Telugu: "te-IN",
};

export default function Companion({
  elderName,
  nativeLanguage,
  shareCode,
  shareEnabled,
  facts,
}: {
  elderName: string;
  nativeLanguage: string;
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

  const [voiceModeEnabled, setVoiceModeEnabled] = useState(true);
  const [keyboardMode, _setKeyboardMode] = useState(false);
  const keyboardModeRef = useRef(false);
  const setKeyboardMode = (val: boolean) => {
    keyboardModeRef.current = val;
    _setKeyboardMode(val);
  };
  const [isListening, setIsListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  async function sendVoice(text: string) {
    if (!text.trim() || thinking) return;
    const history: ChatMessage[] = [...messages, { role: "user", content: text.trim() }];
    setMessages(history);
    await runTurn(history);
  }

  /**
   * What a screen reader actually hears.
   *
   * The transcript itself is NOT a live region. Wrapping a token stream in aria-live would
   * re-announce the whole growing string on every chunk — the listener hears "Good" "Good
   * morn" "Good morning" forever and the app is unusable. Instead we stay silent while the
   * tokens land and announce the finished sentence exactly once, here.
   */
  const [announcement, setAnnouncement] = useState("");

  const greeted = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);

  /** Streams one assistant turn, appending tokens as they land. */
  async function runTurn(history: ChatMessage[]) {
    setThinking(true);
    setError(null);
    setAnnouncement("");

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
      let full = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        full += chunk;
        setMessages((m) => {
          const next = [...m];
          next[next.length - 1] = {
            role: "assistant",
            content: next[next.length - 1].content + chunk,
          };
          return next;
        });
      }

      // Streaming is over. Say it once, as a whole sentence.
      setAnnouncement(full);
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
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  useEffect(() => {
    if (announcement && voiceModeEnabled && typeof window !== "undefined" && "speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(announcement);
      
      const bcp47 = LANG_MAP[nativeLanguage] || "en-US";
      utterance.lang = bcp47;
      
      const playVoice = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          const langPrefix = bcp47.split('-')[0];
          const targetVoice = voices.find(v => v.lang === bcp47) || voices.find(v => v.lang.startsWith(langPrefix));
          if (targetVoice) {
            utterance.voice = targetVoice;
          }
          window.speechSynthesis.speak(utterance);
        }
      };

      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        playVoice();
      } else {
        window.speechSynthesis.onvoiceschanged = () => {
          playVoice();
          window.speechSynthesis.onvoiceschanged = null;
        };
      }
    }
  }, [announcement, voiceModeEnabled, nativeLanguage]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Voice recognition is not supported in this browser. Try Chrome or Edge.");
      return;
    }

    if (!recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = LANG_MAP[nativeLanguage] || "en-US";

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (!keyboardModeRef.current) {
          void sendVoice(transcript);
        } else {
          setInput(transcript);
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    try {
      recognitionRef.current.start();
      setIsListening(true);
      setError(null);
    } catch (err) {
      console.error(err);
      setIsListening(false);
    }
  };

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
            <p className="text-d-eyebrow font-medium uppercase text-clay-700">Arjun</p>
            <p className="text-e-meta text-ink-700">Good to see you, {elderName}.</p>
          </div>
          <div className="flex items-center gap-3">
            <MemoryPanel facts={facts} shareCode={shareCode} shareEnabled={shareEnabled} />
            <form action={signOut}>
              <button className="rounded-control px-3 py-2 text-e-meta text-ink-700 hover:text-ink-900">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main id="conversation" className="flex-1 overflow-y-auto">
        {/*
          role="log" with aria-live OFF. The transcript is a readable region a screen-reader
          user can navigate at their own pace — it does not shout each token as it lands.
          The finished turn is announced once, by the polite region below.
        */}
        <div
          role="log"
          aria-label="Your conversation with Arjun"
          className="mx-auto max-w-3xl space-y-5 px-5 py-8"
        >
          {messages.map((m, i) => (
            <div
              key={i}
              className={`animate-rise flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <p
                className={`max-w-[90%] whitespace-pre-wrap rounded-bubble px-6 py-5 text-xl leading-relaxed ${
                  m.role === "user"
                    ? "bg-clay-700 text-white"
                    : "bg-surface-card text-ink-900 shadow-sm ring-1 ring-sand-200"
                }`}
              >
                <span className="sr-only">{m.role === "user" ? "You said: " : "Arjun said: "}</span>
                {m.content}
              </p>
            </div>
          ))}

          {thinking && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex justify-start">
              <p
                role="status"
                aria-label="Arjun is thinking"
                className="rounded-bubble bg-surface-card px-6 py-5 shadow-sm ring-1 ring-sand-200"
              >
                <span className="dot inline-block h-2.5 w-2.5 rounded-full bg-ink-500" />
                <span className="dot ml-1.5 inline-block h-2.5 w-2.5 rounded-full bg-ink-500" />
                <span className="dot ml-1.5 inline-block h-2.5 w-2.5 rounded-full bg-ink-500" />
              </p>
            </div>
          )}

          {error && (
            <p role="alert" className="text-e-lead text-clay-700">
              {error}
            </p>
          )}

          <div ref={bottom} />
        </div>

        {/* Announced once, when the sentence is whole. Never mid-stream. */}
        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>
      </main>

      <footer className="border-t border-sand-200 bg-sand-100/70 backdrop-blur">
        <div className="mx-auto max-w-3xl px-5 py-6">
          {!keyboardMode ? (
            <div className="flex flex-col items-center justify-center gap-6">
              <button
                type="button"
                onClick={toggleListening}
                disabled={thinking}
                className={`relative flex h-32 w-32 items-center justify-center rounded-full shadow-lg transition-all duration-300 ${
                  thinking 
                    ? "bg-sand-300 text-ink-500 cursor-not-allowed"
                    : isListening
                    ? "bg-red-500 text-white animate-pulse shadow-red-500/50 scale-105"
                    : "bg-clay-700 text-white hover:bg-clay-800 hover:scale-105"
                }`}
              >
                {thinking ? (
                  <div className="flex space-x-2">
                    <span className="dot h-3 w-3 rounded-full bg-ink-500 animate-bounce" />
                    <span className="dot h-3 w-3 rounded-full bg-ink-500 animate-bounce" style={{ animationDelay: "100ms" }} />
                    <span className="dot h-3 w-3 rounded-full bg-ink-500 animate-bounce" style={{ animationDelay: "200ms" }} />
                  </div>
                ) : isListening ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 9h6v6H9z"/></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                )}
              </button>
              
              <div className="text-center">
                <p className="text-xl font-medium text-ink-900">
                  {thinking ? "Arjun is thinking..." : isListening ? "Listening... Tap to finish" : "Tap to speak"}
                </p>
                <div className="mt-6 flex items-center justify-center gap-6">
                  <button
                    onClick={() => setKeyboardMode(true)}
                    disabled={thinking || isListening}
                    className="text-e-meta text-ink-700 underline underline-offset-4 hover:text-ink-900 disabled:opacity-50"
                  >
                    Use keyboard instead
                  </button>
                  {hasSpoken && (
                    <button
                      onClick={endSession}
                      disabled={ending || thinking || isListening}
                      className="text-e-meta text-clay-700 font-medium underline underline-offset-4 hover:text-clay-800 disabled:opacity-50"
                    >
                      {ending ? "Wrapping up…" : "I'm done for now"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <form onSubmit={send} className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setKeyboardMode(false)}
                    className="text-e-meta text-clay-700 font-medium underline underline-offset-4 hover:text-clay-800"
                  >
                    Switch back to Voice Mode
                  </button>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={voiceModeEnabled}
                      onChange={(e) => {
                        setVoiceModeEnabled(e.target.checked);
                        if (!e.target.checked && typeof window !== 'undefined' && window.speechSynthesis) {
                          window.speechSynthesis.cancel();
                        }
                      }}
                      className="rounded border-ink-300 text-clay-700 focus:ring-clay-700"
                    />
                    <span className="text-e-meta text-ink-700 font-medium">Read responses aloud</span>
                  </label>
                </div>
                
                <div className="flex items-end gap-3">
                  <label htmlFor="message" className="sr-only">
                    Say something to Arjun
                  </label>
                  <textarea
                    id="message"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void send(e);
                      }
                    }}
                    rows={1}
                    placeholder="Type a message to Arjun…"
                    className="min-h-[60px] flex-1 resize-none rounded-control border-2 border-ink-500 bg-surface-card px-5 py-4 text-e-body text-ink-900 placeholder:text-ink-500 focus:border-clay-700 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || thinking}
                    className="min-h-[60px] rounded-control bg-clay-700 px-7 text-e-body font-medium text-white transition-colors duration-[--duration-hover] hover:bg-clay-800 disabled:opacity-40"
                  >
                    Send
                  </button>
                </div>
              </form>

              {hasSpoken && (
                <div className="text-center">
                  <button
                    onClick={endSession}
                    disabled={ending || thinking}
                    className="mt-2 text-e-meta text-ink-700 underline underline-offset-4 hover:text-ink-900 disabled:opacity-50"
                  >
                    {ending ? "Wrapping up…" : "I'm done for now"}
                  </button>
                </div>
              )}
            </div>
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
        <h1 className="text-e-display font-semibold text-ink-900">Thank you for talking.</h1>

        <p className="mt-4 text-e-lead text-ink-700">
          {result.facts_remembered > 0
            ? `I'll remember ${result.facts_remembered} ${
                result.facts_remembered === 1 ? "thing" : "things"
              } from today.`
            : "I'll keep today in mind."}
        </p>

        <section className="mt-8 rounded-card bg-surface-card p-6 shadow-sm ring-1 ring-sand-200">
          <h2 className="text-d-eyebrow font-medium uppercase text-clay-700">
            {shareEnabled ? "What your family will see" : "What would be shared"}
          </h2>
          <p className="mt-3 text-e-body text-ink-900">{result.summary}</p>
          <p className="mt-4 border-t border-sand-200 pt-4 text-e-meta text-ink-700">
            <span className="font-medium">Suggestion for them: </span>
            {result.recommendation}
          </p>
          <p className="mt-4 text-e-meta text-ink-700">
            {shareEnabled
              ? "They see this note — never the words you actually said."
              : "Sharing is off, so this stays with you."}
          </p>
        </section>

        <button
          onClick={onAgain}
          className="mt-8 rounded-control bg-clay-700 px-8 py-4 text-e-body font-medium text-white transition-colors duration-[--duration-hover] hover:bg-clay-800"
        >
          Talk again
        </button>
      </div>
    </main>
  );
}
