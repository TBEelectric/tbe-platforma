// Interface languages (docs/architektura.md, Jazyky rozhraní). Only Czech for now; Ukrainian later
// by adding messages/uk.json and "uk" here.
export const LOCALES = ["cs"] as const;
export type AppLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = "cs";

export function toAppLocale(value: string | null | undefined): AppLocale {
  return (LOCALES as readonly string[]).includes(value ?? "")
    ? (value as AppLocale)
    : DEFAULT_LOCALE;
}
