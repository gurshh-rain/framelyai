// lib/supabase/middleware.ts
// Server Components can't write cookies, so the session's auth token would
// silently expire without this. This runs on every request (see the root
// middleware.ts matcher) and rewrites the refreshed token into both the
// incoming request and the outgoing response.
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

export async function updateSession(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
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
    }
  );

  // IMPORTANT: don't add any logic between createServerClient and this call.
  // A simple mistake here can cause the session to randomly log users out.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Optional route protection — uncomment to require sign-in for the
  // interview page. Left off by default so you can test the UI freely.
  // if (!user && request.nextUrl.pathname.startsWith("/interview")) {
  //   const url = request.nextUrl.clone();
  //   url.pathname = "/login";
  //   url.searchParams.set("next", request.nextUrl.pathname);
  //   return NextResponse.redirect(url);
  // }

  return response;
}