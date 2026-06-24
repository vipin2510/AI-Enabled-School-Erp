"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { login, type LoginState } from "@/app/actions/auth";

export default function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, undefined);
  const params = useSearchParams();
  const next = params.get("next") ?? "/";
  const reason = params.get("reason");

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      {reason === "idle" && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          You were signed out after 15 minutes of inactivity. Please sign in again.
        </p>
      )}
      <div>
        <label htmlFor="identifier" className="block text-sm font-medium text-stone-700 mb-1">
          Phone or email
        </label>
        <input
          id="identifier"
          name="identifier"
          type="text"
          inputMode="text"
          autoComplete="username"
          required
          placeholder="9876543210 or you@example.com"
          className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-stone-700 mb-1">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
        />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-stone-50 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
