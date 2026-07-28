// lib/supabase/client.ts
// Used inside Client Components ("use client") — anywhere you need auth
// state or Supabase calls to happen in the browser.
import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./env";

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
}