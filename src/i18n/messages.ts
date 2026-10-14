import type {
  MessageKeys,
  Messages,
  NestedKeyOf,
  TranslationValues,
} from "next-intl";

/** Any full translation key, e.g. "timesheets.day.title". */
export type MessageKey = MessageKeys<Messages, NestedKeyOf<Messages>>;

/**
 * Values of a message: ICU arguments. Dates as Date (formatted in the user's locale by the message,
 * e.g. "{from, date, short}"); a nested Msg is translated first (e.g. an absence type).
 */
export type MessageValues = Record<string, string | number | Date | Msg>;

/**
 * A message that is not translated yet. Pure rules and services return it; the page, the server
 * action or the client component translates it (rules stay free of texts and locale).
 */
export type Msg = { key: MessageKey; values?: MessageValues };

export const msg = (key: MessageKey, values?: MessageValues): Msg =>
  values ? { key, values } : { key };

export function isMsg(value: unknown): value is Msg {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Msg).key === "string" &&
    !(value instanceof Date)
  );
}

/** Any translator returned by useTranslations()/getTranslations() without a namespace. */
type Translate = (key: string, values?: TranslationValues) => string;

/** Translates a Msg (and nested Msg values) with a translator without a namespace. */
export function translate(t: unknown, message: Msg): string {
  const values: TranslationValues = {};
  for (const [name, value] of Object.entries(message.values ?? {}))
    values[name] = isMsg(value) ? translate(t, value) : value;
  return (t as Translate)(message.key, values);
}
