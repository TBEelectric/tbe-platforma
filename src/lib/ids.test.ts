import { describe, expect, it } from "vitest";
import { z } from "zod";
import { UserError } from "./form-state";
import { bound, boundId, idOrNotFound, isId } from "./ids";

const ID = "6f1c0a52-2f43-4f7b-9d0e-1a2b3c4d5e6f";

describe("isId", () => {
  it("accepts canonical UUIDs of any version", () => {
    expect(isId(ID)).toBe(true);
    expect(isId(ID.toUpperCase())).toBe(true);
    expect(isId("00000000-0000-0000-0000-000000000000")).toBe(true);
    expect(isId("11111111-1111-1111-1111-111111111111")).toBe(true);
  });

  it("rejects anything Postgres would not parse as uuid", () => {
    for (const value of [
      "x",
      "abc",
      "",
      "-".repeat(36),
      `${ID}0`,
      ID.replaceAll("-", "_"),
      `{${ID}}`,
      "6f1c0a52-2f43-4f7b-9d0e-1a2b3c4d5e6g",
      null,
      undefined,
      42,
      [ID],
    ])
      expect(isId(value), String(value)).toBe(false);
  });
});

describe("idOrNotFound", () => {
  it("returns a valid ID", () => {
    expect(idOrNotFound(ID)).toBe(ID);
  });

  it("renders notFound() for an invalid one", () => {
    try {
      idOrNotFound("abc");
      expect.unreachable();
    } catch (error) {
      expect((error as { digest?: string }).digest).toBe(
        "NEXT_HTTP_ERROR_FALLBACK;404",
      );
    }
  });
});

describe("bound", () => {
  it("returns the parsed value", () => {
    expect(bound(z.enum(["a", "b"]), "a")).toBe("a");
    expect(boundId(ID)).toBe(ID);
  });

  it("turns an invalid value into the user error 'not found'", () => {
    expect(() => bound(z.enum(["a", "b"]), "c")).toThrow(UserError);
    try {
      boundId("x");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(UserError);
      expect((error as UserError).msg.key).toBe("errors.notFound");
    }
  });
});
