import OpenAI from "openai";
import type { Review } from "./supabase";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// Set OPENAI_MODEL in Vercel to change this. Model names move fast — if a
// call 404s, check platform.openai.com/docs/models and update the variable.
// No redeploy of code needed, just the env var.
const MODEL = process.env.OPENAI_MODEL || "gpt-5.6";

function json<T>(text: string): T {
  return JSON.parse(text.replace(/```json|```/g, "").trim()) as T;
}

async function ask(system: string, user: string, _maxTokens: number) {
  const res = await openai.chat.completions.create({
    model: MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  return res.choices[0]?.message?.content ?? "";
}

/* ------------------------------------------------------------------ */
/* On submit — names the coffee, and tells the taster what others said */
/* ------------------------------------------------------------------ */

const REFLECT_SYSTEM = `A member of staff at a small coffee roastery has just left a tasting note. You do two things.

First, work out which coffee they mean. They write partial names — "the samba", "brazil", "brazilian samba" are all one coffee. Match against the recent notes you're given and reuse the exact same name when it's the same coffee, so they group properly. If they name nothing, return null.

Second, write one or two sentences telling this person what everyone else has said about that same coffee so far. This is the only thing they get back for bothering, so make it worth reading. Say how many notes there are and what the shape of them is. If people disagree, say so — that's more interesting than a false consensus.

Tone: plain and warm, like a colleague telling them over the counter. No coffee jargon, no scores, no percentages. Never name individuals. If theirs is the first note on that coffee, say so and leave it there. If they named no coffee, just thank them briefly.

Return only JSON: { "coffee_name": string | null, "message": string }. No fences, no preamble.`;

export async function reflect(
  note: string,
  recent: Review[]
): Promise<{ coffee_name: string | null; message: string }> {
  const text = await ask(
    REFLECT_SYSTEM,
    JSON.stringify(
      {
        new_note: { note },
        recent_notes: recent.map((r) => ({
          coffee: r.coffee_name,
          note: r.raw_text,
          at: r.created_at.slice(0, 10),
        })),
      },
      null,
      2
    ),
    600
  );
  return json(text);
}

/* ------------------------------------------------------------------ */
/* Monthly — the owner's report                                        */
/* ------------------------------------------------------------------ */

export type Report = { subject: string; body: string };

const MONTHLY_SYSTEM = `You write the monthly tasting report for the owner of a small coffee roastery. He roasts the coffee himself. He reads this once a month and uses it to decide what to change, so overstating confidence costs more than being brief.

A month of notes lets you see things a single day can't. That's the job here — patterns, not incidents:
- Which coffees came up again and again, and which barely got mentioned.
- Whether a problem is every roast of a coffee or one bad batch. Check the dates. "Rough on all four roasts" and "rough on one" are completely different findings.
- Whether anything shifted over the month. If a coffee read badly early and fine later, say so — he probably changed something and it worked, and he'll want to know.
- How a coffee was brewed is not recorded, so where a note mentions espresso, filter or cupping, use that. Where it doesn't, don't assume.

For each coffee worth a section: the overall read, then the most likely problem if there is one, then two to four factual lines he can check himself. Count things — how many people, how many mentioned what, across how many dates.

Notes are anonymous. Each carries a taster label (A, B, C) which only tells you which notes came from the same phone, so you can count people rather than notes — five notes from one person is not five people agreeing. Never use the labels in what you write; he can't identify them and shouldn't try.

Judge each note by how much detail it carries, not by who wrote it. A note that names a specific quality — where it sits in the cup, how it compares to last time — tells you more than "bit harsh", so weight it more heavily. But specificity is not the same as being right: a plain note can be accurate and a fluent one can be wrong. Where detailed notes and plain ones disagree, report both rather than picking a winner.

Where the notes only tell you something tastes off without telling you why, say that plainly instead of guessing at a cause. Where a coffee got one or two notes, say so and draw no conclusion.

Write the body as plain text. Short paragraphs, a blank line between sections, coffee names on their own line. No markdown, no bullet characters, no hash headers — this goes straight into an email. Don't pad it. A quiet month is a short report.

End the body with two or three sentences he can paste into the staff group chat: what came through this month, what he's changing, and thanks. Plain and warm, no jargon, nobody named.

subject is an email subject line under 70 characters carrying the actual finding, not "Monthly report".

Return only JSON: { "subject": string, "body": string }. No fences, no preamble.`;

// Device ids are long and meaningless. Swap them for A, B, C so the model
// can count people without the noise — and so nothing identifying is sent.
function anonymise(reviews: Review[]) {
  const seen = new Map<string, string>();
  const label = (i: number) => {
    let s = "";
    i += 1;
    while (i > 0) {
      s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
      i = Math.floor((i - 1) / 26);
    }
    return s;
  };
  for (const r of reviews) {
    if (!seen.has(r.device_id)) seen.set(r.device_id, label(seen.size));
  }
  return seen;
}

export async function monthlyReport(reviews: Review[], month: string): Promise<Report> {
  const tasters = anonymise(reviews);
  const payload = reviews.map((r) => ({
    coffee: r.coffee_name,
    note: r.raw_text,
    taster: tasters.get(r.device_id),
    date: r.created_at.slice(0, 10),
  }));
  const text = await ask(
    MONTHLY_SYSTEM,
    `Month: ${month}\nNotes: ${reviews.length}\nTasters: ${tasters.size}\n\n${JSON.stringify(payload, null, 2)}`,
    4000
  );
  return json<Report>(text);
}

export function withRawNotes(body: string, reviews: Review[]): string {
  const lines = [body, "", "—".repeat(30), "", `Every note this month (${reviews.length}):`, ""];
  for (const r of reviews) {
    const date = new Date(r.created_at).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      timeZone: "Europe/London",
    });
    lines.push(date);
    lines.push(`  ${r.raw_text}`);
    lines.push("");
  }
  return lines.join("\n");
}
