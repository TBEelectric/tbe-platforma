import { describe, expect, it } from "vitest";
import { formValues, pgError } from "./form-state";

describe("formValues", () => {
  it("keeps string fields and skips React action internals", () => {
    const data = new FormData();
    data.set("name", "Montáže 1");
    data.set("$ACTION_ID_abc", "");
    expect(formValues(data)).toEqual({ name: "Montáže 1" });
  });
});

describe("pgError", () => {
  it("finds the Postgres code and constraint inside wrapped errors", () => {
    const driverError = Object.assign(new Error("duplicate"), {
      code: "23505",
      constraint: "job_code_unique",
    });
    const wrapped = new Error("Failed query", { cause: driverError });
    expect(pgError(wrapped)).toEqual({
      code: "23505",
      constraint: "job_code_unique",
    });
    expect(pgError(new Error("other"))).toEqual({});
  });
});
