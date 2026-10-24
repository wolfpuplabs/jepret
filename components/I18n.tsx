"use client";
import { createContext, useContext } from "react";
import { getDict, type Dict, type Lang } from "@/lib/i18n";

const Ctx = createContext<{ lang: Lang; t: Dict }>({ lang: "en", t: getDict("en") });

export function I18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <Ctx.Provider value={{ lang, t: getDict(lang) }}>{children}</Ctx.Provider>;
}

export const useT = () => useContext(Ctx);
