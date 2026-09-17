"use client";

import { useEffect, useRef, useState } from "react";

type Phase = "writing" | "sending" | "sent";
type Mic = "idle" | "recording" | "transcribing" | "denied" | "unsupported";

const KEY = "taster-id";
const MAX_SECONDS = 120;

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

// Safari wants mp4, Chrome and Firefox want webm. Ask for whatever works.
function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const options = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  return options.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

export default function ReviewForm() {
  const [phase, setPhase] = useState<Phase>("writing");
  const [mic, setMic] = useState<Mic>("idle");
  const [seconds, setSeconds] = useState(0);
  const [text, setText] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const box = useRef<HTMLTextAreaElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setMic("unsupported");
    }
  }, []);

  useEffect(() => {
    if (phase === "writing" && mic === "idle") box.current?.focus();
  }, [phase, mic]);

  function stopTicker() {
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = null;
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMimeType();
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunks.current = [];

      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };

      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        stopTicker();
        const blob = new Blob(chunks.current, { type: mimeType || "audio/webm" });
        if (blob.size < 1000) {
          setMic("idle");
          setSeconds(0);
          return;
        }
        await transcribe(blob);
      };

      recorder.current = rec;
      rec.start();
      setMic("recording");
      setSeconds(0);

      ticker.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) stopRecording();
          return s + 1;
        });
      }, 1000);
    } catch {
      setMic("denied");
    }
  }

  function stopRecording() {
    if (recorder.current?.state === "recording") {
      setMic("transcribing");
      recorder.current.stop();
    }
  }

  async function transcribe(blob: Blob) {
    setMic("transcribing");
    try {
      const form = new FormData();
      form.append("audio", blob, "note.webm");
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { text: string };

      // Drops into the box rather than sending straight off, so a mangled
      // coffee name gets corrected instead of quietly poisoning the data.
      setText((prev) => (prev.trim() ? `${prev.trim()} ${data.text}` : data.text));
      setMic("idle");
      setSeconds(0);
      setTimeout(() => box.current?.focus(), 50);
    } catch {
      setError("Couldn't pick that up. Try again, or type it instead.");
      setMic("idle");
      setSeconds(0);
    }
  }

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

  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <main className="screen">
      <h1 className="ask">What did you think?</h1>
      <p className="hint">
        Name the coffee and say whatever you like. Type it or talk it. One line
        is plenty, and nobody sees who wrote it.
      </p>

      <textarea
        ref={box}
        className="note"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="the brazilian samba was nice but a bit sharp"
        disabled={mic === "recording" || mic === "transcribing"}
      />

      {mic !== "unsupported" && (
        <button
          className={`mic ${mic === "recording" ? "live" : ""}`}
          onClick={mic === "recording" ? stopRecording : startRecording}
          disabled={mic === "transcribing" || phase === "sending"}
        >
          {mic === "recording" && (
            <>
              <span className="dot" />
              Stop <span className="clock">{clock}</span>
            </>
          )}
          {mic === "transcribing" && "Writing it down\u2026"}
          {(mic === "idle" || mic === "denied") && (
            <>
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <rect x="9" y="2" width="6" height="11" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0" />
                <path d="M12 18v4" />
              </svg>
              Say it instead
            </>
          )}
        </button>
      )}

      {mic === "denied" && (
        <p className="error">
          No microphone access. Allow it in your browser settings, or just type.
        </p>
      )}
      {error && <p className="error">{error}</p>}

      <button
        className="send"
        onClick={send}
        disabled={!text.trim() || phase === "sending" || mic !== "idle"}
      >
        {phase === "sending" ? "Sending\u2026" : "Send"}
      </button>
    </main>
  );
}
