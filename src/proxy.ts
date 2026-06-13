import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Next.js 16 renamed Middleware to Proxy (same mechanism). Two jobs:
//   1. Keep the Supabase session alive (refresh the access token + refresh
//      token cookie pair). This MUST live in middleware/proxy — server
//      components can't reliably write cookies, so a page-level getUser()
//      that triggers a refresh has nowhere to persist the new tokens. The
//      symptom of getting this wrong is a flood of "Refresh Token Not
//      Found" errors and eventual auth rate-limiting.
//   2. Redirect anonymous users to /login (and logged-in users away from
//      /login).
//
// To keep nav snappy, we only invoke supabase.auth.getUser() — which is a
// network round-trip to Supabase auth — when the access token is actually
// near expiry. The Supabase SSR cookie stores `expires_at` in plaintext
// JSON, so we can decide locally in O(1) whether a refresh is needed.
//
// On refresh failure we delete every sb-* cookie so the next request
// doesn't try to refresh the same dead token in an infinite loop.
export async function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  const path = request.nextUrl.pathname;
  const isLogin = path === "/login";

  const authCookies = request.cookies
    .getAll()
    .filter((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));

  // No session cookies at all → anonymous. /login is the only path they may
  // see; everything else bounces to /login.
  if (authCookies.length === 0) {
    if (isLogin) return passThrough(requestHeaders);
    return redirectToLogin(request, path);
  }

  const expiresAt = decodeSessionExpiry(authCookies);
  const nowSeconds = Math.floor(Date.now() / 1000);
  // 60s headroom: if the token expires within a minute, refresh now so the
  // page-level supabase calls don't see a stale token mid-render.
  const tokenIsFresh = expiresAt !== null && expiresAt - nowSeconds > 60;

  if (tokenIsFresh) {
    // Fast path — no Supabase call. ~1-2ms total proxy work.
    if (isLogin) return redirectHome(request);
    return passThrough(requestHeaders);
  }

  // Slow path — token expired (or unreadable). Run a real refresh through
  // the SSR client so the new access/refresh tokens land in the response
  // cookies the browser will store.
  let response = passThrough(requestHeaders);
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = passThrough(requestHeaders);
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      // Either the refresh succeeded but yielded no user (impossible in
      // practice) or it failed silently. Treat as logged out and clear the
      // cookies so we don't refresh the same dead token next request.
      clearAuthCookies(response, authCookies);
      if (isLogin) return response;
      return redirectToLogin(request, path);
    }

    if (isLogin) return redirectHome(request);
    return response;
  } catch {
    // Refresh threw — almost always "Refresh Token Not Found" because the
    // token was already consumed and rotated by a parallel request. Clear
    // the bad cookies so the loop ends here.
    clearAuthCookies(response, authCookies);
    if (isLogin) return response;
    return redirectToLogin(request, path);
  }
}

function passThrough(headers: Headers) {
  return NextResponse.next({ request: { headers } });
}

function redirectToLogin(request: NextRequest, path: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", path);
  return NextResponse.redirect(url);
}

function redirectHome(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/";
  url.search = "";
  return NextResponse.redirect(url);
}

function clearAuthCookies(
  response: NextResponse,
  cookies: { name: string }[],
) {
  for (const c of cookies) {
    response.cookies.delete(c.name);
  }
}

// Decode the Supabase SSR auth cookie(s) and return `expires_at` (unix
// seconds), or null if we can't parse it. The SDK stores the session as
// either plain JSON or a base64-prefixed JSON blob, possibly chunked across
// `…-auth-token`, `…-auth-token.0`, `…-auth-token.1` etc. when too large
// for a single cookie. We join the chunks in name order before parsing.
function decodeSessionExpiry(
  cookies: { name: string; value: string }[],
): number | null {
  if (cookies.length === 0) return null;
  const sorted = [...cookies].sort((a, b) => a.name.localeCompare(b.name));
  const raw = sorted.map((c) => c.value).join("");

  try {
    let value = raw;
    if (value.startsWith("base64-")) {
      value = atob(value.slice("base64-".length));
    }
    const session: { expires_at?: number } = JSON.parse(value);
    return typeof session.expires_at === "number" ? session.expires_at : null;
  } catch {
    return null;
  }
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|letterhead|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
