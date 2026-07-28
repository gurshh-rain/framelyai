// proxy.ts
//
// In Next.js 16 this is called "Proxy" (was "Middleware"). Runs on every
// request — see the matcher below. Its only job here is to delegate to
// lib/supabase/middleware's updateSession(), which refreshes the Supabase
// auth cookies on every request. Without this, the session silently
// expires and the user gets logged out for no visible reason.
//
// Next.js requires the file to live at the project root (next to app/),
// named proxy.ts, exporting either a `proxy` function or a default
// function. See node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md.
import type { NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Skip Next internals and static assets — there's nothing to refresh
  // there, and skipping them keeps the request cheap.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};