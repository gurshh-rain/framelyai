// lib/supabase/env.ts
//
// One place to validate required Supabase env vars at module evaluation
// time. Next.js 16's stricter TS rules narrow `process.env.X` to
// `string | undefined`, which then breaks every `createBrowserClient` /
// `createServerClient` call with an "undefined not assignable to string"
// error. Throwing here at import time gives a clear error in the build
// log if the vars are missing, instead of a cryptic TS overload error —
// and collapses the value to `string` so the rest of the code stays clean.

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
      `Set it in .env.local for development, and in the Vercel project's Environment Variables for production.`
    );
  }
  return value;
}

function optional(name: string, value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value;
}

// Required at module load — every Supabase client needs these. They're
// both NEXT_PUBLIC_* because the browser client uses them too.
export const SUPABASE_URL = required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
export const SUPABASE_PUBLISHABLE_KEY = required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

// Optional — only required if createAdminClient() is actually called.
// Vercel won't complain at build time if this isn't set unless something
// imports the admin client.
export const SUPABASE_SECRET_KEY = optional("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY);

export function requireSecretKey(): string {
  return required("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY);
}