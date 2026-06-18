"use client";

import { useRef } from "react";
import { deleteUser } from "./actions";

// Tiny client wrapper around the deleteUser server action that prompts a
// native confirm() before submitting — destructive enough that a misclick
// shouldn't nuke an account.
export default function DeleteUserButton({
  userId,
  label,
}: {
  userId: string;
  label: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={deleteUser}>
      <input type="hidden" name="id" value={userId} />
      <button
        type="button"
        onClick={() => {
          if (window.confirm(`Delete "${label}"? This cannot be undone.`)) {
            formRef.current?.requestSubmit();
          }
        }}
        className="text-xs text-red-600 hover:text-red-800 hover:underline"
      >
        Delete
      </button>
    </form>
  );
}
