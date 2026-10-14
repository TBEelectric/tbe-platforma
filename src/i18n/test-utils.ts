// Test helper: renders messages in Czech, so rule tests read like the UI and catch missing keys.
import { createTranslator } from "next-intl";
import messages from "../../messages/cs.json";
import { formats } from "./formats";
import { translate, type Msg } from "./messages";

const t = createTranslator({
  locale: "cs",
  messages,
  formats,
  timeZone: "Europe/Prague",
  onError: (error) => {
    throw error;
  },
});

/** Czech text of a message (throws on a missing key or argument). */
export function cs(message: Msg): string {
  return translate(t, message);
}

/** Czech texts of all messages in a record (e.g. validation errors by field). */
export function csAll(record: Record<string, Msg>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, cs(value)]),
  );
}
