import { describe, expect, it } from "vitest";
import {
  JOB_PALETTE,
  customerShortName,
  jobColor,
  jobLabel,
  siteKey,
} from "./job-display";

describe("jobColor", () => {
  it("is stable for an id and comes from the palette", () => {
    const id = "6f1c0a52-2f43-4f7b-9d0e-1a2b3c4d5e6f";
    expect(jobColor({ id })).toBe(jobColor({ id, color: null }));
    expect(JOB_PALETTE).toContain(jobColor({ id }));
  });

  it("spreads ids over the palette", () => {
    const colors = new Set(
      Array.from({ length: 40 }, (_, i) =>
        jobColor({
          id: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
        }),
      ),
    );
    expect(colors.size).toBeGreaterThanOrEqual(6);
  });

  it("uses a valid override from job administration", () => {
    expect(jobColor({ id: "a", color: "#123abc" })).toBe("#123abc");
    expect(JOB_PALETTE).toContain(jobColor({ id: "a", color: "red" }));
  });
});

describe("customerShortName", () => {
  it.each([
    ["Strojírny Vysočina s.r.o.", "Strojírny Vysočina"],
    ["Kancelářský dům Na Poříčí a.s.", "Kancelářský dům Na Poříčí"],
    ["Pekárna Zlatý klas, s. r. o.", "Pekárna Zlatý klas"],
    ["Elektro Novák spol. s r.o.", "Elektro Novák"],
    ["Bratři Dvořákové v.o.s.", "Bratři Dvořákové"],
    ["Spolek Jiskra z.s.", "Spolek Jiskra"],
    ["ACME SE", "ACME"],
    ["Město Úvaly", "Město Úvaly"],
    ["Novotný Josef", "Novotný Josef"],
    ["Asociace", "Asociace"],
  ])("%s → %s", (name, short) => {
    expect(customerShortName(name)).toBe(short);
  });

  it("keeps a name that is only a legal form", () => {
    expect(customerShortName("s.r.o.")).toBe("s.r.o.");
  });
});

describe("jobLabel", () => {
  it("shows the company without legal form and the site", () => {
    expect(
      jobLabel({
        name: "Rozvaděče hala A",
        customerName: "Strojírny Vysočina s.r.o.",
        siteName: "Jihlava, hala A",
      }),
    ).toBe("Strojírny Vysočina, Jihlava, hala A");
  });

  it("leaves out a missing customer or site, falls back to the job name", () => {
    expect(
      jobLabel({ name: "Sklad", customerName: null, siteName: "Kolín, sklad" }),
    ).toBe("Kolín, sklad");
    expect(
      jobLabel({ name: "Servis", customerName: "Město Úvaly", siteName: " " }),
    ).toBe("Město Úvaly");
    expect(
      jobLabel({ name: "Režie", customerName: null, siteName: null }),
    ).toBe("Režie");
  });
});

describe("siteKey", () => {
  it("ignores case and spacing, but not the customer", () => {
    expect(siteKey("c1", " Jihlava,  hala A ")).toBe(
      siteKey("c1", "jihlava, HALA a"),
    );
    expect(siteKey("c1", "Jihlava, hala A")).not.toBe(
      siteKey("c2", "Jihlava, hala A"),
    );
    expect(siteKey(null, "Sklad")).toBe("-|sklad");
  });
});
