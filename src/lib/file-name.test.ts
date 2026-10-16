import { describe, expect, it } from "vitest";
import { fileSlug } from "./file-name";

describe("fileSlug", () => {
  it("drops diacritics, spaces and characters unsafe in a file name", () => {
    expect(fileSlug("výkaz-2026-10-Čížek Ota")).toBe("vykaz-2026-10-cizek-ota");
    expect(fileSlug('  Řehoř / Šťastný "x" ')).toBe("rehor-stastny-x");
    expect(fileSlug("podklad-mzdy-2026-10-v2")).toBe("podklad-mzdy-2026-10-v2");
  });
});
