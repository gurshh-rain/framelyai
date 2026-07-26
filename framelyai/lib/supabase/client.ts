// lib/supabase/client.ts
// Used inside Client Components ("use client") — anywhere you need auth
// state or Supabase calls to happen in the browser.
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}