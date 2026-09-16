import { NextResponse } from "next/server";
import { db, type Review } from "@/lib/supabase";
import { monthlyReport, withRawNotes } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Runs on the 1st, reports the month just gone.
  // ?test=1 reports the current month instead, so you can fire one on demand
  // to check the email still works without waiting for the 1st.
  const test = new URL(req.url).searchParams.get("test") === "1";

  const now = new Date();
  const offset = test ? 0 : 1;
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset + 1, 1));
  const label = start.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const { data, error } = await db
    .from("reviews")
    .select("*")
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString())
    .order("created_at", { ascending: true });

  if (error) {
    console.error("fetch failed", error);
    return NextResponse.json({ error: "Could not read notes" }, { status: 500 });
  }

  const reviews = (data ?? []) as Review[];

  if (reviews.length === 0) {
    return NextResponse.json({ sent: false, reason: "no notes", month: label });
  }

  const report = await monthlyReport(reviews, label);
  const body = withRawNotes(report.body, reviews);

  await db.from("reports").insert({
    month: start.toISOString().slice(0, 10),
    subject: test ? `[TEST] ${report.subject}` : report.subject,
    body,
    note_count: reviews.length,
  });

  const res = await fetch(process.env.MAKE_WEBHOOK_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      month: label,
      subject: test ? `[TEST] ${report.subject}` : report.subject,
      body,
      note_count: reviews.length,
      test,
    }),
  });

  if (!res.ok) {
    console.error("make webhook failed", res.status, await res.text());
    return NextResponse.json({ error: "Webhook failed" }, { status: 502 });
  }

  return NextResponse.json({ sent: true, month: label, notes: reviews.length });
}
