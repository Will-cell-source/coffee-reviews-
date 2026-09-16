import { NextResponse } from "next/server";
import { db, type Review } from "@/lib/supabase";
import { reflect } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  let body: { deviceId?: string; text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const { deviceId, text } = body;
  if (!text?.trim()) {
    return NextResponse.json({ error: "Empty note" }, { status: 400 });
  }

  const note = text.trim().slice(0, 4000);

  // Save first, always. Whatever happens after this, the note is safe.
  const { data: saved, error } = await db
    .from("reviews")
    .insert({ device_id: (deviceId || "anon").slice(0, 64), raw_text: note })
    .select("id")
    .single();

  if (error || !saved) {
    console.error("insert failed", error);
    return NextResponse.json({ error: "Could not save" }, { status: 500 });
  }

  // Then work out which coffee it is, and tell them what everyone else said.
  // If this fails the note is already stored — they just get a plain thank you.
  try {
    const { data: recent } = await db
      .from("reviews")
      .select("*")
      .neq("id", saved.id)
      .order("created_at", { ascending: false })
      .limit(60);

    const { coffee_name, message } = await reflect(note, (recent ?? []) as Review[]);

    if (coffee_name) {
      await db.from("reviews").update({ coffee_name }).eq("id", saved.id);
    }

    return NextResponse.json({ ok: true, message });
  } catch (e) {
    console.error("reflect failed", e);
    return NextResponse.json({ ok: true, message: null });
  }
}
