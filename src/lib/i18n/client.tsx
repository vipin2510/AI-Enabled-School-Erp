"use client";

import { createContext, useContext, useMemo } from "react";
import { DEFAULT_LOCALE, type Locale, type TFunc } from "./config";
import { makeT } from "./dictionaries";

// Client-side translator. The app shell wraps children in <I18nProvider>;
// client components call `const t = useT()`. The Hindi dictionary is bundled
// into client JS (it's small), so no per-render dictionary prop-drilling.
type Ctx = { locale: Locale; t: TFunc };
const I18nContext = createContext<Ctx>({ locale: DEFAULT_LOCALE, t: makeT(DEFAULT_LOCALE) });

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = useMemo<Ctx>(() => ({ locale, t: makeT(locale) }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): TFunc {
  return useContext(I18nContext).t;
}

export function useLocale(): Locale {
  return useContext(I18nContext).locale;
}
