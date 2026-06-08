"use client";

// Per-route error boundary. Next.js catches an unhandled exception thrown by
// any descendant Server Component / Client Component / Server Action and
// renders this in its place — the sidebar/topbar shell stays visible so the
// user can navigate away or retry.
//
// Logging caveat: log to the browser console in dev only. In production we
// rely on Vercel's server logs to capture the underlying exception (this
// boundary only ever sees a digest, not the original error message).

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
    if (process.env.NODE_ENV !== "production") {
      console.error("[route-error]", error);
    }
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
          share the reference below with the admin.
        </p>
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
