import { describe, expect, it } from "vitest";
import { isDevLoginEnabled } from "./dev-login";

describe("isDevLoginEnabled", () => {
  it("is on only in development with DEV_LOGIN=true", () => {
    expect(
      isDevLoginEnabled({ NODE_ENV: "development", DEV_LOGIN: "true" }),
    ).toBe(true);
  });

  it("is off in a production build, whatever DEV_LOGIN says", () => {
    expect(
      isDevLoginEnabled({ NODE_ENV: "production", DEV_LOGIN: "true" }),
    ).toBe(false);
    expect(isDevLoginEnabled({ NODE_ENV: "test", DEV_LOGIN: "true" })).toBe(
      false,
    );
    expect(isDevLoginEnabled({ DEV_LOGIN: "true" })).toBe(false);
  });

  it("is off in development without DEV_LOGIN=true", () => {
    expect(isDevLoginEnabled({ NODE_ENV: "development" })).toBe(false);
    for (const value of ["", "false", "1", "yes", "TRUE", " true"])
      expect(
        isDevLoginEnabled({ NODE_ENV: "development", DEV_LOGIN: value }),
      ).toBe(false);
  });
});
