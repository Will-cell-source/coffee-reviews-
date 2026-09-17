"use client";

import { useEffect, useRef, useState } from "react";
import { unblockSteps, type Unblock } from "@/lib/unblock";

type Phase = "writing" | "sending" | "sent";
type Mic = "idle" | "recording" | "transcribing" | "blocked" | "unsupported";

const KEY = "taster-id";
const MAX_SECONDS = 120;

// Peak loudness below this means we never actually heard speech. Sending
// silence to a transcription model produces confident nonsense — "thanks for
// watching" and similar, which it learned from video soundtracks.
const HEARD_THRESHOLD = 0.012;

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

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const options = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return options.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

export default function ReviewForm() {
  const [phase, setPhase] = useState<Phase>("writing");
  const [mic, setMic] = useState<Mic>("idle");
  const [micNote, setMicNote] = useState<string | null>(null);
  const [howTo, setHowTo] = useState<Unblock | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [text, setText] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const box = useRef<HTMLTextAreaElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const raf = useRef<number | null>(null);
  const peak = useRef(0);

  useEffect(() => {
    if (typeof navigator === "undefined") return;

    if (typeof window !== "undefined" && !window.isSecureContext) {
      setMic("blocked");
      setMicNote("Voice needs a secure (https) connection.");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMic("unsupported");
      return;
    }

    navigator.permissions
      ?.query({ name: "microphone" as PermissionName })
      .then((status) => {
        if (status.state === "denied") {
          setMic("blocked");
          setMicNote("The microphone is blocked for this site.");
          setHowTo(unblockSteps());
        }
        status.onchange = () => {
          if (status.state === "granted") {
            setMic("idle");
            setMicNote(null);
            setHowTo(null);
          }
        };
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (phase === "writing" && mic === "idle") box.current?.focus();
  }, [phase, mic]);

  function cleanup() {
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = null;
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
    audioCtx.current?.close().catch(() => {});
    audioCtx.current = null;
  }

  async function startRecording() {
    setError(null);
    setMicNote(null);
    setHowTo(null);
    peak.current = 0;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });

      // Watch the actual signal. Without this there's no way to tell a working
      // microphone from a muted one until the transcript comes back wrong.
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      audioCtx.current = ctx;
      if (ctx.state === "suspended") await ctx.resume();

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);

      const meter = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        if (rms > peak.current) peak.current = rms;
        setLevel(Math.min(1, rms * 12));
        raf.current = requestAnimationFrame(meter);
      };
      meter();

      const mimeType = pickMimeType();
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunks.current = [];

      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };

      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        cleanup();
        setLevel(0);

        const blob = new Blob(chunks.current, { type: mimeType || "audio/webm" });
        const heard = peak.current >= HEARD_THRESHOLD;

        if (!heard || blob.size < 2000) {
          setMic("idle");
          setSeconds(0);
          setError(
            "Didn't hear anything. Check nothing is covering the microphone, speak a little closer, or just type it."
          );
          return;
        }
        await transcribe(blob);
      };

      recorder.current = rec;
      rec.start(250); // stream chunks rather than one blob at the end
      setMic("recording");
      setSeconds(0);

      ticker.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) stopRecording();
          return s + 1;
        });
      }, 1000);
    } catch (e) {
      cleanup();
      const name = (e as DOMException)?.name ?? "";
      setMic("blocked");
      if (name === "NotAllowedError" || name === "SecurityError") {
        setMicNote("The microphone is blocked for this site.");
        setHowTo(unblockSteps());
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setMicNote("No microphone found on this device.");
      } else if (name === "NotReadableError" || name === "AbortError") {
        setMicNote("Something else is using the microphone. Close it and try again.");
      } else {
        setMicNote("Couldn't start the microphone. You can still type.");
      }
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
      const ext = (blob.type.split("/")[1] || "webm").split(";")[0];
      form.append("audio", blob, `note.${ext}`);
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const data = (await res.json()) as { text?: string; error?: string };

      if (!res.ok || !data.text) {
        setError(
          data.error === "no_speech"
            ? "Couldn't make out any speech there. Try again a bit closer, or type it."
            : "Couldn't pick that up. Try again, or type it instead."
        );
        setMic("idle");
        setSeconds(0);
        return;
      }

      // Lands in the box rather than sending straight off, so a mangled
      // coffee name gets corrected instead of quietly poisoning the data.
      setText((prev) => (prev.trim() ? `${prev.trim()} ${data.text}` : data.text!));
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
              <span className="bars" aria-hidden="true">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className="bar"
                    style={{
                      transform: `scaleY(${Math.max(
                        0.15,
                        Math.min(1, level * (1 + Math.sin(i * 1.7) * 0.45))
                      )})`,
                    }}
                  />
                ))}
              </span>
              Stop <span className="clock">{clock}</span>
            </>
          )}
          {mic === "transcribing" && "Writing it down\u2026"}
          {(mic === "idle" || mic === "blocked") && (
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

      {mic === "recording" && (
        <p className="hint meter-note">
          {level > 0.08 ? "Hearing you." : "Speak up \u2014 not hearing much yet."}
        </p>
      )}

      {micNote && <p className="error">{micNote}</p>}

      {howTo && (
        <div className="howto">
          <p className="howto-head">To turn it on in {howTo.where}</p>
          <ol>
            {howTo.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          <button className="reload" onClick={() => window.location.reload()}>
            Reload the page
          </button>
          <p className="howto-foot">Or just type your note — that works fine too.</p>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <button
        className="send"
        onClick={send}
        disabled={
          !text.trim() ||
          phase === "sending" ||
          mic === "recording" ||
          mic === "transcribing"
        }
      >
        {phase === "sending" ? "Sending\u2026" : "Send"}
      </button>
    </main>
  );
}
