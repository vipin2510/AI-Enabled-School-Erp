// Lightweight, gettext-style i18n. The English source string IS the lookup
// key — so wrapping a string in `t("Collect Fee")` needs no key invention and
// any string without a Hindi entry simply renders in English. One Hindi
// dictionary (src/lib/i18n/dictionaries.ts) is the only thing to maintain.

export const LOCALES = ["en", "hi"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const COOKIE_LOCALE = "erp_lang";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "EN",
  hi: "हिं",
};

export function isLocale(v: string | undefined | null): v is Locale {
  return !!v && (LOCALES as readonly string[]).includes(v);
}

// Resolve `{name}`-style placeholders. English source and Hindi entries use
// the same placeholder names so interpolation works in either language.
export function interpolate(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

export type TFunc = (key: string, vars?: Record<string, string | number>) => string;
