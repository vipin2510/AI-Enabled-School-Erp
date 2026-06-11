import { NextResponse, type NextRequest } from "next/server";

// Next.js 16 renamed Middleware to Proxy (same mechanism). Two jobs:
//   1. Decide whether to redirect anonymous users to /login.
//   2. Inject the request pathname as a header so the root layout can branch
//      on the active route without hardcoding routing logic.
//
// We deliberately do NOT call `supabase.auth.getUser()` here, even though
// the Supabase SSR docs recommend it. That call is a round-trip to the auth
// server (200-500ms) and it ran on every page navigation, multiplying the
// real cost of a click. The downstream guard `requireProfile()` already
// calls getUser() inside the page render, so a stale/expired/forged cookie
// is caught there and the page redirects on its own — proxy doesn't need
// to duplicate that work.
//
// The cookie-existence check below is enough for the "kick anonymous users
// to /login" decision: if there is no Supabase auth cookie at all, the user
// is definitely not logged in and we can redirect without any network call.
// If a cookie is present but invalid/expired, the page-level guard handles
// it on first DB query.
export async function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  const path = request.nextUrl.pathname;
  const isLogin = path === "/login";

  const hasAuthCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));

  if (!hasAuthCookie && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (hasAuthCookie && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|letterhead|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
