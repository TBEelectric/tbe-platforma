import type {
  MessageKeys,
  Messages,
  NestedKeyOf,
  TranslationValues,
} from "next-intl";

/** Any full translation key, e.g. "timesheets.day.title". */
export type MessageKey = MessageKeys<Messages, NestedKeyOf<Messages>>;

/** Values of a message: ICU arguments; dates as Date (formatted in the user's locale). */
export type MessageValues = Record<string, string | number | Date>;

/**
 * A message that is not translated yet. Pure rules and services return it, the page, the server
 * action or the client translates it (rules stay free of texts and locale).
 */
export type Msg = { key: MessageKey; values?: MessageValues };

export const msg = (key: MessageKey, values?: MessageValues): Msg => ({
  key,
  values,
});

/** Any translator returned by useTranslations()/getTranslations() without a namespace. */
type Translate = (key: MessageKey, values?: TranslationValues) => string;

export function translate(t: unknown, message: Msg): string {
  return (t as Translate)(message.key, message.values as TranslationValues);
}
