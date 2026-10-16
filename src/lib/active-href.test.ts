import { describe, expect, it } from "vitest";
import { activeHref } from "./active-href";

describe("activeHref", () => {
  const hrefs = ["/employees", "/employees/teams", "/employees/import"];

  it("matches the item itself", () => {
    expect(activeHref("/employees", hrefs)).toBe("/employees");
  });

  it("prefers the most specific item", () => {
    expect(activeHref("/employees/teams", hrefs)).toBe("/employees/teams");
    expect(activeHref("/employees/teams/abc", hrefs)).toBe("/employees/teams");
  });

  it("falls back to the parent for detail pages", () => {
    expect(activeHref("/employees/abc", hrefs)).toBe("/employees");
  });

  it("does not match a mere prefix of a segment", () => {
    expect(activeHref("/employeesx", hrefs)).toBeUndefined();
  });

  it("returns nothing outside the menu", () => {
    expect(activeHref("/jobs", hrefs)).toBeUndefined();
  });
});
