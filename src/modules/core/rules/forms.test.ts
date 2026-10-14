import { describe, expect, it } from "vitest";
import { csAll } from "@/i18n/test-utils";
import {
  customerFormSchema,
  employeeFormSchema,
  employmentFormSchema,
  fieldErrors,
  jobFormSchema,
  NEW_SITE,
} from "./forms";

describe("employeeFormSchema", () => {
  it("trims, lowercases the e-mail and reads the checkbox", () => {
    expect(
      employeeFormSchema.parse({
        personalNumber: " 1001 ",
        firstName: "Jan",
        lastName: "Novák",
        email: " Jan.Novak@TBE.cz ",
        tracksTime: "on",
      }),
    ).toEqual({
      personalNumber: "1001",
      firstName: "Jan",
      lastName: "Novák",
      email: "jan.novak@tbe.cz",
      tracksTime: true,
    });
  });

  it("treats an empty e-mail as none and a missing checkbox as false", () => {
    const parsed = employeeFormSchema.parse({
      personalNumber: "1",
      firstName: "A",
      lastName: "B",
      email: "",
    });
    expect(parsed.email).toBeNull();
    expect(parsed.tracksTime).toBe(false);
  });

  it("reports field errors as messages", () => {
    const result = employeeFormSchema.safeParse({
      personalNumber: "",
      firstName: "A",
      lastName: "x".repeat(101),
      email: "x",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(csAll(fieldErrors(result.error))).toEqual({
        personalNumber: "Povinné",
        lastName: "Nejvýše 100 znaků",
        email: "Neplatný formát e-mailu",
      });
    }
  });
});

describe("employmentFormSchema", () => {
  it("requires weekly hours for HPP and accepts a decimal comma", () => {
    expect(
      employmentFormSchema.safeParse({
        type: "hpp",
        validFrom: "2026-01-01",
        scheduleType: "uneven",
      }).success,
    ).toBe(false);
    expect(
      employmentFormSchema.parse({
        type: "dpc",
        validFrom: "2026-01-01",
        weeklyHours: "7,5",
        scheduleType: "flexible",
      }).weeklyHours,
    ).toBe(7.5);
  });

  it("drops weekly hours for DPP", () => {
    expect(
      employmentFormSchema.parse({
        type: "dpp",
        validFrom: "2026-04-01",
        weeklyHours: "10",
        scheduleType: "flexible",
      }).weeklyHours,
    ).toBeNull();
  });

  it("rejects an invalid date", () => {
    expect(
      employmentFormSchema.safeParse({
        type: "dpp",
        validFrom: "2026-02-30x",
        scheduleType: "flexible",
      }).success,
    ).toBe(false);
  });
});

describe("customerFormSchema", () => {
  it("accepts 8 digits (spaces removed) or nothing", () => {
    expect(
      customerFormSchema.parse({ name: "Město Úvaly", ico: "002 40 923" }).ico,
    ).toBe("00240923");
    expect(
      customerFormSchema.parse({ name: "Novotný Josef", ico: "" }).ico,
    ).toBeNull();
    expect(
      customerFormSchema.safeParse({ name: "X", ico: "1234" }).success,
    ).toBe(false);
  });
});

describe("jobFormSchema", () => {
  const job = {
    code: "250147",
    name: "Rozvaděče hala A",
    customerId: "",
    status: "active",
  };
  const siteId = "6f1c0a52-2f43-4f7b-9d0e-1a2b3c4d5e6f";
  const errorsOf = (input: Record<string, unknown>) => {
    const result = jobFormSchema.safeParse(input);
    return result.success ? null : csAll(fieldErrors(result.error));
  };

  it("takes an existing site", () => {
    expect(jobFormSchema.parse({ ...job, siteId })).toEqual({
      code: "250147",
      name: "Rozvaděče hala A",
      customerId: null,
      status: "active",
      site: { kind: "existing", id: siteId },
    });
  });

  it("creates a new site from its name and address", () => {
    expect(
      jobFormSchema.parse({
        ...job,
        siteId: NEW_SITE,
        siteName: " Jihlava,  hala A ",
        siteAddress: "",
      }).site,
    ).toEqual({ kind: "new", name: "Jihlava, hala A", address: null });
  });

  it("requires a site", () => {
    expect(errorsOf(job)).toEqual({ siteId: "Vyberte" });
    expect(errorsOf({ ...job, siteId: "x" })).toEqual({ siteId: "Vyberte" });
    expect(errorsOf({ ...job, siteId: NEW_SITE })).toEqual({
      siteName: "Povinné",
    });
  });
});
