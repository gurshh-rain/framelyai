// lib/supabase/server.ts
// Used inside Server Components, Server Actions, and Route Handlers — never
// import this from a Client Component.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./env";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component during render — Server
          // Components can't write cookies. The middleware below
          // refreshes the session on the next request instead, so
          // this can be safely ignored here.
        }
      },
    },
  });
}