"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { COOKIE_LOCALE, isLocale } from "@/lib/i18n/config";

// Switch the UI language. Stored in a long-lived cookie and read by the shell
// (src/app/layout.tsx → getLocale) on every request, so the whole app
// re-renders in the chosen language.
export async function setLocale(formData: FormData) {
  const v = String(formData.get("locale") ?? "");
  if (!isLocale(v)) return;
  const store = await cookies();
  store.set(COOKIE_LOCALE, v, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
}
