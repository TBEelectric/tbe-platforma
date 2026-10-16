import { describe, expect, it } from "vitest";
import { parseMails } from "./mail-log";

describe("parseMails", () => {
  it("reads the e-mails sendMail logs without SMTP", () => {
    const output = [
      "✓ Ready in 100ms",
      "── e-mail (SMTP_HOST not set, not sent) ──",
      "To: a@example.invalid",
      "Subject: Nevyplněný den",
      "",
      "Dobrý den,",
      "odkaz: http://localhost:3100/timesheets/day",
      "⨯ Error: something else",
      "── e-mail (SMTP_HOST not set, not sent) ──",
      "To: b@example.invalid",
      "Subject: Vrácený výkaz",
      "",
      "Důvod: chybí den",
    ].join("\n");
    expect(parseMails(output)).toEqual([
      {
        to: "a@example.invalid",
        subject: "Nevyplněný den",
        text: "Dobrý den,\nodkaz: http://localhost:3100/timesheets/day",
      },
      {
        to: "b@example.invalid",
        subject: "Vrácený výkaz",
        text: "Důvod: chybí den",
      },
    ]);
  });
});
