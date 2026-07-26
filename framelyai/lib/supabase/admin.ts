// lib/supabase/admin.ts
//
// SERVER ONLY. Uses the secret key, which bypasses Row Level Security
// entirely — anyone holding it can read/write every row in every table.
//
// Never import this from a file that has "use client" at the top, never
// call it from a Client Component, and never let SUPABASE_SECRET_KEY get
// a NEXT_PUBLIC_ prefix. Safe places to use this: Route Handlers, Server
// Actions, and (eventually) your Python backend's own service-role calls.
//
// Typical use case here: your future Python scoring service posts a
// session's results to a Route Handler, which uses this client to write
// them under the correct user_id without needing that user's own session.
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}