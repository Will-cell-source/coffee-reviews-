import { createClient } from "@supabase/supabase-js";

// Service role key — server-side only. Never import this into a client component.
export const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export type Review = {
  id: string;
  station: string;
  device_id: string;
  raw_text: string;
  coffee_name: string | null;
  created_at: string;
};
