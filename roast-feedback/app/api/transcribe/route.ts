import { NextResponse } from "next/server";
import OpenAI, { toFile } from "openai";
import { db } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const MODEL = process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1";

export async function POST(req: Request) {
  let audio: File | null = null;
  try {
    const form = await req.formData();
    audio = form.get("audio") as File | null;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  if (!audio || audio.size === 0) {
    return NextResponse.json({ error: "No audio" }, { status: 400 });
  }
  if (audio.size > 24 * 1024 * 1024) {
    return NextResponse.json({ error: "Recording too long" }, { status: 413 });
  }

  try {
    // Feed the coffee names we already know into the transcription as a hint.
    // Without this, Guji, Sidamo and Yirgacheffe come back mangled every time,
    // and the coffee name is what the whole monthly report hangs on.
    let hint = "Coffee tasting notes from a roastery.";
    const { data: known } = await db
      .from("reviews")
      .select("coffee_name")
      .not("coffee_name", "is", null)
      .order("created_at", { ascending: false })
      .limit(100);

    if (known?.length) {
      const names = Array.from(new Set(known.map((r) => r.coffee_name))).slice(0, 25);
      if (names.length) hint += ` Coffees include: ${names.join(", ")}.`;
    }

    const buf = Buffer.from(await audio.arrayBuffer());
    const ext = (audio.type.split("/")[1] || "webm").split(";")[0];

    const result = await openai.audio.transcriptions.create({
      file: await toFile(buf, `note.${ext}`, { type: audio.type }),
      model: MODEL,
      language: "en",
      prompt: hint,
    });

    return NextResponse.json({ text: result.text ?? "" });
  } catch (e) {
    console.error("transcribe failed", e);
    return NextResponse.json({ error: "Could not transcribe" }, { status: 500 });
  }
}
