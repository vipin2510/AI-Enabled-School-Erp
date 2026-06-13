"use client";

// Per-route error boundary. Next.js catches an unhandled exception thrown by
// any descendant Server Component / Client Component / Server Action and
// renders this in its place — the sidebar/topbar shell stays visible so the
// user can navigate away or retry.
//
// The error message is shown to the user (in addition to the digest) so a
// production incident can be diagnosed from a screenshot instead of a
// Vercel log search. The trade-off is a one-line technical message leaking
// to the UI, which is acceptable for an internal-tool ERP. Roll back if
// PII ever leaks via these messages.

import { useEffect } from "react";
import Link from "next/link";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to the browser console in every environment so a screen-recording
    // captures the stack. Vercel's server-side log already has the full
    // server-render trace, indexed by the digest below.
    console.error("[route-error]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl py-16">
      <div className="card p-8 space-y-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-stone-500">
            Something went wrong
          </div>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">
            We couldn’t load this page
          </h1>
        </div>
        <p className="text-sm text-stone-600">
          Try again — most errors here are transient. If it keeps happening,
          share the details below with the admin.
        </p>
        {error.message && (
          <pre className="overflow-auto rounded-md border border-stone-200 bg-stone-50 p-3 text-xs text-stone-700 whitespace-pre-wrap break-words">
            {error.message}
          </pre>
        )}
        {error.digest && (
          <p className="text-xs font-mono text-stone-400">
            Ref: {error.digest}
          </p>
        )}
        <div className="flex flex-wrap gap-2 pt-2">
          <button
            onClick={() => reset()}
            className="rounded-lg bg-stone-900 px-4 py-2 text-sm text-stone-50 hover:bg-stone-800"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
          >
            Go to overview
          </Link>
        </div>
      </div>
    </div>
  );
}
