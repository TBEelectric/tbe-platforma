import { describe, expect, it } from "vitest";
import {
  EMAIL_NOT_ALLOWED,
  isEmailAllowed,
  parseAllowedEmails,
  signInRejection,
} from "./allowed-emails";

describe("parseAllowedEmails", () => {
  it("splits by comma, semicolon and whitespace and normalizes case", () => {
    const allowed = parseAllowedEmails(
      " Jan.Novak@TBE.cz, petr@tbe.cz;\n eva@tbe.cz ",
    );
    expect([...allowed]).toEqual([
      "jan.novak@tbe.cz",
      "petr@tbe.cz",
      "eva@tbe.cz",
    ]);
  });

  it("returns an empty set for a missing or empty value", () => {
    expect(parseAllowedEmails(undefined).size).toBe(0);
    expect(parseAllowedEmails(" , ").size).toBe(0);
  });

  it("ignores entries without @", () => {
    expect([...parseAllowedEmails("tbe.cz, a@tbe.cz")]).toEqual(["a@tbe.cz"]);
  });
});

describe("isEmailAllowed", () => {
  const allowed = parseAllowedEmails("jan.novak@tbe.cz");

  it("allows a listed e-mail regardless of case and spaces", () => {
    expect(isEmailAllowed(allowed, " JAN.NOVAK@tbe.cz")).toBe(true);
  });

  it("rejects other and missing e-mails", () => {
    expect(isEmailAllowed(allowed, "cizi@gmail.com")).toBe(false);
    expect(isEmailAllowed(allowed, undefined)).toBe(false);
    expect(isEmailAllowed(allowed, "")).toBe(false);
  });

  it("rejects everyone when the list is empty", () => {
    expect(isEmailAllowed(new Set(), "jan.novak@tbe.cz")).toBe(false);
  });
});

describe("signInRejection", () => {
  const allowed = parseAllowedEmails("jan.novak@tbe.cz");

  it("lets a verified, listed e-mail in", () => {
    expect(
      signInRejection(allowed, {
        email: "jan.novak@tbe.cz",
        emailVerified: true,
      }),
    ).toBeNull();
  });

  it("refuses an unverified e-mail even if listed", () => {
    expect(
      signInRejection(allowed, {
        email: "jan.novak@tbe.cz",
        emailVerified: false,
      }),
    ).toBe(EMAIL_NOT_ALLOWED);
  });

  it("refuses an unlisted or missing e-mail", () => {
    expect(
      signInRejection(allowed, {
        email: "cizi@gmail.com",
        emailVerified: true,
      }),
    ).toBe(EMAIL_NOT_ALLOWED);
    expect(signInRejection(allowed, {})).toBe(EMAIL_NOT_ALLOWED);
  });
});
