"use client";

import { useEffect, useRef, useState } from "react";

type Phase = "writing" | "sending" | "sent";

const KEY = "taster-id";

// Random, generated once on this phone, never shown to anyone. It exists
// only so the monthly report can tell six notes from six people apart from
// six notes from one person. No names, nothing to maintain when staff change.
function deviceId(): string {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) return saved;
    const fresh =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    return "anon";
  }
}

export default function ReviewForm() {
  const [phase, setPhase] = useState<Phase>("writing");
  const [text, setText] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (phase === "writing") box.current?.focus();
  }, [phase]);

  async function send() {
    if (!text.trim()) return;
    setPhase("sending");
    setError(null);
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: deviceId(), text }),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { message: string | null };
      setReply(data.message);
      setText("");
      setPhase("sent");
    } catch {
      setError("That didn't save. Check your signal and try again.");
      setPhase("writing");
    }
  }

  if (phase === "sent") {
    return (
      <main className="screen">
        <div className="done">
          <h1>Got it.</h1>
          {reply && <p className="reply">{reply}</p>}
          <button className="again" onClick={() => setPhase("writing")}>
            Add another
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="screen">
      <h1 className="ask">What did you think?</h1>
      <p className="hint">
        Name the coffee and say whatever you like. One line is plenty, and
        nobody sees who wrote it.
      </p>

      <textarea
        ref={box}
        className="note"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="the brazilian samba was nice but a bit sharp"
        enterKeyHint="send"
      />

      {error && <p className="error">{error}</p>}

      <button
        className="send"
        onClick={send}
        disabled={!text.trim() || phase === "sending"}
      >
        {phase === "sending" ? "Sending\u2026" : "Send"}
      </button>
    </main>
  );
}
