import { describe, expect, it } from "vitest";
import {
  ACCOUNT_NOT_ALLOWED,
  canEmployeeSignIn,
  signInRejection,
} from "./sign-in";

const active = { email: "Jan.Novak@tbe.cz", active: true, archivedAt: null };

describe("canEmployeeSignIn", () => {
  it("allows an active employee with the same e-mail, ignoring case and spaces", () => {
    expect(canEmployeeSignIn(active, " jan.novak@TBE.cz ")).toBe(true);
  });

  it("refuses inactive, archived, missing or e-mail-less employees", () => {
    expect(
      canEmployeeSignIn({ ...active, active: false }, "jan.novak@tbe.cz"),
    ).toBe(false);
    expect(
      canEmployeeSignIn(
        { ...active, archivedAt: new Date() },
        "jan.novak@tbe.cz",
      ),
    ).toBe(false);
    expect(
      canEmployeeSignIn({ ...active, email: null }, "jan.novak@tbe.cz"),
    ).toBe(false);
    expect(canEmployeeSignIn(null, "jan.novak@tbe.cz")).toBe(false);
  });

  it("refuses when the employee's e-mail was changed to another account", () => {
    expect(
      canEmployeeSignIn(
        { ...active, email: "jiny@tbe.cz" },
        "jan.novak@tbe.cz",
      ),
    ).toBe(false);
  });
});

describe("signInRejection", () => {
  it("lets a verified account of an active employee in", () => {
    expect(
      signInRejection(
        { email: "jan.novak@tbe.cz", emailVerified: true },
        active,
      ),
    ).toBeNull();
  });

  it("refuses unverified e-mails and accounts without an employee", () => {
    expect(
      signInRejection(
        { email: "jan.novak@tbe.cz", emailVerified: false },
        active,
      ),
    ).toBe(ACCOUNT_NOT_ALLOWED);
    expect(
      signInRejection({ email: "cizi@gmail.com", emailVerified: true }, null),
    ).toBe(ACCOUNT_NOT_ALLOWED);
    expect(signInRejection({ emailVerified: true }, active)).toBe(
      ACCOUNT_NOT_ALLOWED,
    );
  });
});
