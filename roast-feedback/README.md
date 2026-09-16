# Roast feedback

Scan a sticker, type what you think, send. You're told what everyone else said about that coffee. The owner gets a report on the 1st of each month.

Notes are anonymous. There's no login, no name list, and nothing to update when staff join or leave.

## Setup

1. **Supabase** — new project, open the SQL editor, paste `supabase/schema.sql`, run it. Nothing to edit. Copy the project URL and the **service role** key from Settings → API.
2. **GitHub** — push this folder to a new repo.
3. **Vercel** — import the repo. Add these environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL` — optional, defaults to `gpt-5.6`
   - `MAKE_WEBHOOK_URL` (leave blank for now)
   - `CRON_SECRET` — any random string
4. **Deploy.** Open `/s/cupping` on your phone and send a test note. Check the row landed in Supabase. That's the product working.
5. **Make** — new scenario, Custom Webhook in, Email out. Copy the webhook URL into `MAKE_WEBHOOK_URL` on Vercel and redeploy. The payload has `subject`, `body`, `team_note`, `review_count` and `needs_work`.
6. **Test the report** before trusting the cron:
   ```
   curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://yoursite.com/api/report
   ```
7. **Turn on failure notifications** on the Make scenario. Otherwise it stops silently and you find out in a fortnight.
8. **Stickers** — `SITE_URL=https://yoursite.com npm run qr` writes an SVG per station into `qr/`. Print at 10cm square minimum, high contrast, with a line of text underneath saying what it's for. Test on an old Android before laminating.

## Day one with the team

Five minutes at a morning meeting. Show the sticker, say what it's for, say that it's anonymous, and get everyone to add it to their home screen — on iPhone that's Share → Add to Home Screen, on Android it's the three dots → Add to Home screen. Do it as a group or half of them never will.

## Notes

- **The report runs on the 1st at 8am** and covers the month just gone. Change the schedule in `vercel.json` if you want it elsewhere.
- **Nothing sends in a month with no notes.**
- **The note is saved before the AI runs.** If OpenAI is down or slow, the note is already in the database and the taster just gets a plain thank you instead of the summary line.
- **Model names move fast.** `OPENAI_MODEL` is an environment variable, so if a call starts 404ing you change it in Vercel and redeploy — no code edit.
- **The browser never talks to Supabase.** Everything goes through the API routes with the service role key, and RLS denies everything else.
- **Tasters are a random id generated on the phone**, stored in localStorage. It exists only so the report can count people rather than notes. No names anywhere. A shared tablet reads as one person; someone who clears their browser reads as new.

## Adding a station

Add an entry to `lib/stations.ts`, redeploy, run `npm run qr` again. The URL segment is the key.

## What's deliberately not here

Batch selection, batch logging, days off roast, Cropster or Artisan, expertise calibration, alerts. Every one of them is easier to design once you've seen a month of how people actually write. Raw text and timestamps are stored from day one, so most of it can be backfilled.
