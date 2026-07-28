// lib/supabase/middleware.ts
// Server Components can't write cookies, so the session's auth token would
// silently expire without this. This runs on every request (see the root
// middleware.ts matcher) and rewrites the refreshed token into both the
// incoming request and the outgoing response.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./env";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: don't add any logic between createServerClient and this call.
  // A simple mistake here can cause the session to randomly log users out.

  // Use getClaims() instead of getUser() for the auth gate. getClaims()
  // validates the JWT signature locally (against the project's JWKS, no
  // extra network hop to /auth/v1/) so it never bounces a logged-in user
  // just because the Auth server had a transient hiccup. getUser() makes a
  // round-trip on every request and was the thing silently returning null
  // when /interview was bounced back to /login even after a successful sign-in.
  const { data: claimsData } = await supabase.auth.getClaims();
  const hasSession = !!claimsData?.claims;

  // Require sign-in for the interview page. Anyone hitting /interview
  // without a session gets bounced to /login, which reads the `next`
  // param below and sends them back here once they're signed in.
  if (!hasSession && request.nextUrl.pathname.startsWith("/interview")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return response;
}