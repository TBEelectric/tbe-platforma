import { describe, expect, it } from "vitest";
import { cs } from "@/i18n/test-utils";
import type { EmployeeImportRow, JobImportRow } from "./parse";
import {
  planEmployeeImport,
  planJobImport,
  type EmployeeSnapshot,
  type ExistingEmployee,
  type RowPreview,
} from "./plan";

const row = (over: Partial<EmployeeImportRow> = {}): EmployeeImportRow => ({
  row: 2,
  personalNumber: "1001",
  lastName: "Novák",
  firstName: "Jan",
  email: "jan.novak@example.cz",
  type: "hpp",
  weeklyHours: 40,
  scheduleType: "flexible",
  validFrom: "2019-03-01",
  team: "Montáže 1",
  isLead: true,
  leave: { hoursEntitled: 160, hoursCarriedOver: 24 },
  role: null,
  active: true,
  ...over,
});

const jan: ExistingEmployee = {
  id: "e1",
  personalNumber: "1001",
  firstName: "Jan",
  lastName: "Novák",
  email: "jan.novak@example.cz",
  active: true,
  archived: false,
  employments: [
    {
      id: "m1",
      type: "hpp",
      weeklyHours: 40,
      scheduleType: "flexible",
      validFrom: "2019-03-01",
      validTo: null,
    },
  ],
  memberships: [
    { id: "t-m1", teamId: "t1", validFrom: "2019-03-01", validTo: null },
  ],
  roles: [],
  leaveThisYear: { id: "l1", hoursEntitled: 160, hoursCarriedOver: 24 },
};

const snapshot = (over: Partial<EmployeeSnapshot> = {}): EmployeeSnapshot => ({
  employees: [jan],
  teams: [
    { id: "t1", name: "Montáže 1", leadEmployeeId: "e1", archived: false },
    { id: "t2", name: "Montáže 2", leadEmployeeId: null, archived: false },
  ],
  today: "2026-10-13",
  year: 2026,
  ...over,
});

/** A preview row with its changes and errors in Czech. */
const textOf = (preview: RowPreview) => ({
  ...preview,
  changes: preview.changes.map(cs),
  errors: preview.errors.map(cs),
});

describe("planEmployeeImport", () => {
  it("reports an identical row as unchanged (re-import is idempotent)", () => {
    const plan = planEmployeeImport([row()], snapshot());
    expect(textOf(plan.previews[0])).toMatchObject({
      status: "unchanged",
      changes: [],
      errors: [],
    });
    expect(plan.ops).toEqual([]);
  });

  it("creates a new employee with employment, team from the start date, lead, leave and role", () => {
    const plan = planEmployeeImport(
      [
        row({
          personalNumber: "1011",
          firstName: "Lenka",
          lastName: "Černá",
          email: "lenka@example.cz",
          team: "Kancelář",
          role: "timesheetsManager",
          validFrom: "2016-01-01",
        }),
      ],
      snapshot(),
    );
    expect(textOf(plan.previews[0]).status).toBe("new");
    expect(plan.newTeams).toEqual(["Kancelář"]);
    expect(plan.ops[0]).toMatchObject({
      employeeId: null,
      employee: {
        firstName: "Lenka",
        lastName: "Černá",
        email: "lenka@example.cz",
        active: true,
      },
      employment: {
        kind: "create",
        close: null,
        values: { type: "hpp", validFrom: "2016-01-01" },
      },
      team: { name: "Kancelář", validFrom: "2016-01-01", close: null },
      lead: "Kancelář",
      leave: { id: null, hoursEntitled: 160, hoursCarriedOver: 24 },
      addRoles: ["timesheetsManager"],
    });
  });

  it("updates only changed fields and describes them in Czech", () => {
    const plan = planEmployeeImport(
      [row({ lastName: "Nováček", active: false, isLead: false })],
      snapshot(),
    );
    expect(textOf(plan.previews[0])).toMatchObject({
      status: "update",
      changes: [
        "Příjmení: Novák → Nováček",
        "Deaktivace (nebude se moct přihlásit)",
      ],
    });
    expect(plan.ops[0].employee).toEqual({
      lastName: "Nováček",
      active: false,
    });
    expect(plan.ops[0].employment).toBeNull();
  });

  it("updates the employment with the same start, or follows it with a new one", () => {
    const same = planEmployeeImport([row({ weeklyHours: 30 })], snapshot())
      .ops[0].employment;
    expect(same).toEqual({
      kind: "update",
      id: "m1",
      values: { weeklyHours: 30 },
    });

    const later = planEmployeeImport(
      [row({ type: "dpc", weeklyHours: 20, validFrom: "2027-01-01" })],
      snapshot(),
    );
    expect(later.ops[0].employment).toMatchObject({
      kind: "create",
      close: { id: "m1", validTo: "2026-12-31" },
    });
    expect(textOf(later.previews[0]).changes[0]).toBe(
      "Nový úvazek DPČ 20 h, pružná od 1. 1. 2027 (předchozí končí 31. 12. 2026)",
    );
  });

  it("refuses a start before the latest employment", () => {
    const plan = planEmployeeImport(
      [row({ validFrom: "2018-01-01" })],
      snapshot(),
    );
    expect(textOf(plan.previews[0]).status).toBe("error");
    expect(textOf(plan.previews[0]).errors[0]).toContain(
      "je dřív než poslední úvazek",
    );
    expect(plan.ops).toEqual([]);
  });

  it("moves an existing employee to another team from today", () => {
    const plan = planEmployeeImport(
      [row({ team: "montáže 2", isLead: false })],
      snapshot(),
    );
    expect(plan.ops[0].team).toEqual({
      name: "Montáže 2",
      validFrom: "2026-10-13",
      close: { id: "t-m1", validTo: "2026-10-12" },
    });
    expect(textOf(plan.previews[0]).changes).toContain(
      "Parta: Montáže 1 → Montáže 2 od 13. 10. 2026",
    );
  });

  it("keeps everything when team and leave are empty and only adds roles", () => {
    const plan = planEmployeeImport(
      [row({ team: null, isLead: false, leave: null, role: "admin" })],
      snapshot(),
    );
    expect(plan.ops[0]).toMatchObject({
      team: null,
      lead: null,
      leave: null,
      addRoles: ["admin"],
    });
    const withRole = snapshot({ employees: [{ ...jan, roles: ["admin"] }] });
    expect(
      planEmployeeImport([row({ role: null })], withRole).previews[0].status,
    ).toBe("unchanged");
  });

  it("refuses an e-mail of another employee and archived employees", () => {
    const other = {
      ...jan,
      id: "e2",
      personalNumber: "1002",
      email: "petr@example.cz",
      firstName: "Petr",
      lastName: "Svoboda",
    };
    const taken = planEmployeeImport(
      [row({ email: "petr@example.cz" })],
      snapshot({ employees: [jan, other] }),
    );
    expect(textOf(taken.previews[0]).errors).toEqual([
      "E-mail už má Petr Svoboda (1002).",
    ]);
    const archived = planEmployeeImport(
      [row()],
      snapshot({ employees: [{ ...jan, archived: true }] }),
    );
    expect(textOf(archived.previews[0]).status).toBe("error");
  });

  it("replaces another team lead and names the previous one", () => {
    const plan = planEmployeeImport(
      [
        row({
          personalNumber: "1002",
          email: null,
          team: "Montáže 1",
          isLead: true,
        }),
      ],
      snapshot(),
    );
    expect(textOf(plan.previews[0]).changes).toContain(
      "Vedoucí party Montáže 1 (místo Jan Novák)",
    );
  });
});

describe("planJobImport", () => {
  const job = (over: Partial<JobImportRow> = {}): JobImportRow => ({
    row: 2,
    code: "250147",
    name: "Rozvaděče hala A",
    siteName: "Jihlava, hala A",
    siteAddress: "Průmyslová 12, Jihlava",
    customerName: "Strojírny Vysočina s.r.o.",
    ico: "12345678",
    status: "active",
    ...over,
  });
  const jobs = {
    jobs: [
      {
        id: "j1",
        code: "250147",
        name: "Rozvaděče hala A",
        customerId: "c1",
        siteId: "s1",
        status: "active" as const,
        archived: false,
      },
    ],
    customers: [
      {
        id: "c1",
        name: "Strojírny Vysočina s.r.o.",
        ico: "12345678",
        archived: false,
      },
    ],
    sites: [
      {
        id: "s1",
        name: "Jihlava, hala A",
        address: "Průmyslová 12, Jihlava",
        customerId: "c1",
        archived: false,
      },
    ],
  };

  it("is unchanged for identical data", () => {
    expect(planJobImport([job()], jobs).previews[0].status).toBe("unchanged");
  });

  it("creates jobs and customers once, matching existing customers by IČO", () => {
    const plan = planJobImport(
      [
        job({
          code: "250244",
          name: "Přípojka NN – dílna",
          customerName: "Strojírny (jiný název)",
        }),
        job({
          row: 3,
          code: "250230",
          name: "Fotovoltaika RD Kolín",
          customerName: "Novotný Josef",
          ico: null,
        }),
        job({
          row: 4,
          code: "250231",
          name: "Druhá zakázka",
          customerName: "novotný josef",
          ico: null,
        }),
      ],
      jobs,
    );
    expect(plan.previews.map((p) => p.status)).toEqual(["new", "new", "new"]);
    expect(plan.ops[0].values.customerKey).toBe("ico:12345678");
    expect(plan.newCustomers).toEqual([
      { key: "name:novotný josef", name: "Novotný Josef", ico: null },
    ]);
    // The existing customer's site is reused; the new customer gets one new site for both jobs.
    expect(plan.siteIds[plan.ops[0].values.siteKey!]).toBe("s1");
    expect(plan.ops[1].values.siteKey).toBe(plan.ops[2].values.siteKey);
    expect(plan.newSites).toEqual([
      {
        key: "name:novotný josef|jihlava, hala a",
        name: "Jihlava, hala A",
        address: "Průmyslová 12, Jihlava",
        customerId: null,
        customerKey: "name:novotný josef",
      },
    ]);
    expect(textOf(plan.previews[0]).changes).toEqual([
      "Zákazník Strojírny Vysočina s.r.o.",
      "Místo Jihlava, hala A",
    ]);
    expect(textOf(plan.previews[1]).changes).toEqual([
      "Nový zákazník Novotný Josef",
      "Nové místo Jihlava, hala A",
    ]);
  });

  it("matches sites by name regardless of case and spacing", () => {
    const plan = planJobImport([job({ siteName: "jihlava,  HALA a" })], jobs);
    expect(plan.previews[0].status).toBe("unchanged");
    expect(plan.newSites).toEqual([]);
  });

  it("moves a job to a new site of its current customer", () => {
    const plan = planJobImport(
      [
        job({
          siteName: "Jihlava, dílna",
          siteAddress: null,
          customerName: null,
          ico: null,
        }),
      ],
      jobs,
    );
    expect(plan.ops[0].values).toEqual({ siteKey: "c1|jihlava, dílna" });
    expect(plan.newSites).toEqual([
      {
        key: "c1|jihlava, dílna",
        name: "Jihlava, dílna",
        address: null,
        customerId: "c1",
        customerKey: null,
      },
    ]);
    expect(textOf(plan.previews[0]).changes).toEqual([
      "Místo: Jihlava, hala A → Jihlava, dílna",
      "Nové místo Jihlava, dílna",
    ]);
  });

  it("updates the address of an existing site once, keeps it when empty", () => {
    const plan = planJobImport(
      [
        job({ siteAddress: "Průmyslová 14, Jihlava" }),
        job({ row: 3, code: "250244", siteAddress: "Průmyslová 14, Jihlava" }),
        job({ row: 4, code: "250245", siteAddress: null }),
      ],
      jobs,
    );
    expect(plan.previews[0].status).toBe("update");
    expect(plan.ops[0]).toMatchObject({
      values: {},
      siteAddress: { siteId: "s1", address: "Průmyslová 14, Jihlava" },
    });
    expect(textOf(plan.previews[0]).changes).toEqual([
      "Adresa místa: Průmyslová 12, Jihlava → Průmyslová 14, Jihlava",
    ]);
    expect(plan.ops[1].siteAddress).toBeUndefined();
    expect(plan.ops[2].siteAddress).toBeUndefined();
  });

  it("creates no site for a row with an error", () => {
    const plan = planJobImport([job({ siteName: "Jinde" })], {
      ...jobs,
      jobs: [{ ...jobs.jobs[0], archived: true }],
    });
    expect(plan.previews[0].status).toBe("error");
    expect(plan.newSites).toEqual([]);
  });

  it("updates name and status, keeps the customer when the column is empty", () => {
    const plan = planJobImport(
      [
        job({
          name: "Rozvaděče hala A+B",
          status: "closed",
          customerName: null,
          ico: null,
        }),
      ],
      jobs,
    );
    expect(plan.ops[0].values).toEqual({
      name: "Rozvaděče hala A+B",
      status: "closed",
    });
    expect(textOf(plan.previews[0]).changes).toEqual([
      "Název: Rozvaděče hala A → Rozvaděče hala A+B",
      "Stav: aktivní → uzavřená",
    ]);
  });
});
