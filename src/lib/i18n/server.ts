import { cookies } from "next/headers";
import { COOKIE_LOCALE, DEFAULT_LOCALE, isLocale, type Locale, type TFunc } from "./config";
import { makeT } from "./dictionaries";

// Server-side locale + translator. Use in Server Components / route handlers:
//   const t = await getT();  …  <h1>{t("Collect Fee")}</h1>
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const v = store.get(COOKIE_LOCALE)?.value;
  return isLocale(v) ? v : DEFAULT_LOCALE;
}

export async function getT(): Promise<TFunc> {
  return makeT(await getLocale());
}
