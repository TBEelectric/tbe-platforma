import { BASE_URL } from "../config";
import type { Ctx, Who } from "../context";
import {
  absenceMark,
  CLOSED_MONTH,
  nameMark,
  noteMark,
  type Person,
} from "../fixtures";
import { assert } from "../report";

// Pages: who may open each one (the page's own requirePermission), and that spoofed ?employee=,
// ?team=, ?month=, ?date= or an id in the path never shows someone else's data.

const ACTORS: Person[] = ["ea", "la", "lb", "mg", "ad"];
const MANAGERS: Person[] = ["mg", "ad"];
const ALL: Person[] = ACTORS;

export async function pagesSuite(ctx: Ctx) {
  const { fx, report } = ctx;
  report.section("Stránky: kdo je otevře");

  const pages: Array<{ route: string; path: string; who: Person[] }> = [
    { route: "/page", path: "/", who: ALL },
    { route: "/employees/page", path: "/employees", who: MANAGERS },
    { route: "/employees/new/page", path: "/employees/new", who: MANAGERS },
    {
      route: "/employees/[id]/page",
      path: `/employees/${fx.ids.eb}`,
      who: MANAGERS,
    },
    { route: "/employees/teams/page", path: "/employees/teams", who: MANAGERS },
    {
      route: "/employees/teams/[id]/page",
      path: `/employees/teams/${fx.teams.b}`,
      who: MANAGERS,
    },
    { route: "/employees/import/page", path: "/employees/import", who: ["ad"] },
    { route: "/jobs/page", path: "/jobs", who: MANAGERS },
    { route: "/jobs/new/page", path: "/jobs/new", who: MANAGERS },
    { route: "/jobs/[id]/page", path: `/jobs/${fx.jobs.j1}`, who: MANAGERS },
    { route: "/jobs/customers/page", path: "/jobs/customers", who: MANAGERS },
    {
      route: "/jobs/customers/new/page",
      path: "/jobs/customers/new",
      who: MANAGERS,
    },
    {
      route: "/jobs/customers/[id]/page",
      path: `/jobs/customers/${fx.customerId}`,
      who: MANAGERS,
    },
    { route: "/timesheets/page", path: "/timesheets", who: ALL },
    {
      route: "/timesheets/day/page",
      path: `/timesheets/day?date=${fx.days[1]}`,
      who: ALL,
    },
    {
      route: "/timesheets/month/page",
      path: `/timesheets/month?month=${fx.p1}`,
      who: ALL,
    },
    {
      route: "/timesheets/day/someone/page",
      path: "/timesheets/day/someone",
      who: ["la", "lb", "mg", "ad"],
    },
    {
      route: "/timesheets/month/someone/page",
      path: "/timesheets/month/someone",
      who: ["la", "lb", "mg", "ad"],
    },
    {
      route: "/timesheets/absences/page",
      path: "/timesheets/absences",
      who: ALL,
    },
    {
      route: "/timesheets/approval/page",
      path: `/timesheets/approval?month=${fx.p2}`,
      who: ["la", "lb", "mg"],
    },
    { route: "/timesheets/close/page", path: "/timesheets/close", who: ["mg"] },
    {
      route: "/timesheets/settings/page",
      path: "/timesheets/settings",
      who: ["mg"],
    },
  ];

  for (const page of pages) {
    report.cover(page.route);
    await report.check(
      `${page.path}: only ${page.who.join(", ")}`,
      async () => {
        for (const who of ACTORS) {
          const res = await ctx.as(who).get(page.path);
          const may = page.who.includes(who);
          assert(res.status < 500, `${who}: status ${res.status}`);
          if (may)
            assert(
              !res.notFound && res.status === 200,
              `${who} should open it (status ${res.status}${res.location ? ` → ${res.location}` : ""})`,
            );
          else
            assert(
              res.notFound,
              `${who} should get 404 (status ${res.status}${res.location ? ` → ${res.location}` : ""})`,
            );
        }
        // The employees of the check never appear on a page somebody may not open.
        for (const who of ACTORS.filter((w) => !page.who.includes(w))) {
          const res = await ctx.as(who).get(page.path);
          assert(
            !res.body.includes(nameMark("eb")),
            `${who} sees ${nameMark("eb")}`,
          );
        }
      },
    );
    await report.check(
      `${page.path}: without a session → sign-in`,
      async () => {
        for (const who of ["anon", "forged"] as Who[]) {
          const res = await ctx.as(who).get(page.path);
          assert(
            res.redirect?.startsWith("/login") ||
              res.redirect?.startsWith(`${BASE_URL}/login`),
            `${who}: status ${res.status}, no redirect to /login`,
          );
          assert(
            !res.body.includes("Secchk"),
            `${who}: response contains data`,
          );
        }
      },
    );
  }

  report.cover("/login/page", "/favicon.ico/route");
  await report.check(
    "/login and /favicon.ico are public and carry no data",
    async () => {
      for (const path of [
        "/login",
        "/login?error=account_not_allowed",
        "/favicon.ico",
      ]) {
        const res = await ctx.as("anon").get(path);
        assert(res.status === 200, `${path}: status ${res.status}`);
        assert(!res.body.includes("Secchk"), `${path}: contains data`);
      }
    },
  );

  report.section("Stránky: podvržené parametry");
  const day = fx.days[1];
  const foreign = [
    {
      label: "?employee= on Den",
      path: `/timesheets/day?date=${day}&employee=${fx.ids.eb}`,
    },
    {
      label: "?employee= on Měsíc",
      path: `/timesheets/month?month=${fx.p1}&employee=${fx.ids.eb}`,
    },
  ];
  for (const { label, path } of foreign) {
    await report.check(`${label}: another team's employee`, async () => {
      for (const who of ["ea", "la"] as const) {
        const res = await ctx.as(who).get(path);
        assert(res.notFound, `${who} should get 404`);
        assert(!res.body.includes(noteMark("eb")), `${who} sees eb's entry`);
      }
      for (const who of ["lb", "mg", "ad"] as const) {
        const res = await ctx.as(who).get(path);
        assert(
          res.body.includes(noteMark("eb")),
          `${who} should see eb's entry`,
        );
      }
    });
  }
  await report.check(
    "?employee= on Den/Měsíc: own team for the lead",
    async () => {
      for (const path of [
        `/timesheets/day?date=${day}&employee=${fx.ids.ec}`,
        `/timesheets/month?month=${fx.p1}&employee=${fx.ids.ec}`,
      ]) {
        assert(
          (await ctx.as("la").get(path)).body.includes(noteMark("ec")),
          `la: ${path}`,
        );
        assert((await ctx.as("ea").get(path)).notFound, `ea: ${path}`);
      }
    },
  );
  await report.check(
    "?employee= with garbage falls back to the own day",
    async () => {
      const res = await ctx
        .as("ea")
        .get(
          `/timesheets/day?date=${day}&employee=${encodeURIComponent(`${fx.ids.eb}' or 1=1`)}`,
        );
      assert(res.status === 200 && !res.notFound, `status ${res.status}`);
      assert(
        res.body.includes(noteMark("ea")) && !res.body.includes(noteMark("eb")),
        "wrong day",
      );
    },
  );
  await report.check(
    "?date= in the closed month shows no one else",
    async () => {
      const res = await ctx
        .as("ea")
        .get(
          `/timesheets/day?date=${CLOSED_MONTH.slice(0, 8)}04&employee=${fx.ids.eb}`,
        );
      assert(res.notFound, "ea should get 404");
    },
  );
  await report.check(
    "Schvalování: ?team= and ?employee= of another team",
    async () => {
      const path = `/timesheets/approval?month=${fx.p2}&team=${fx.teams.b}&employee=${fx.ids.eb}`;
      const la = await ctx.as("la").get(path);
      assert(!la.notFound, "la should open Schvalování");
      assert(!la.body.includes(nameMark("eb")), "la sees eb");
      assert(la.body.includes(nameMark("ea")), "la should see own team (ea)");
      const lb = await ctx.as("lb").get(path);
      assert(lb.body.includes(nameMark("eb")), "lb should see eb");
    },
  );
  await report.check("Absence: only decidable employees", async () => {
    const la = await ctx.as("la").get("/timesheets/absences");
    assert(!la.body.includes(absenceMark("eb")), "la sees eb's request");
    assert(la.body.includes(absenceMark("ec")), "la should see ec's request");
    const ea = await ctx.as("ea").get("/timesheets/absences");
    assert(
      !ea.body.includes(absenceMark("eb")) &&
        !ea.body.includes(absenceMark("ec")),
      "ea sees requests of others",
    );
    assert(ea.body.includes(absenceMark("ea")), "ea should see own request");
    const ad = await ctx.as("ad").get("/timesheets/absences");
    assert(
      !ad.body.includes(absenceMark("eb")),
      "administrator sees requests (decides none)",
    );
  });
  await report.check(
    "Zapsat za jiného / Měsíc zaměstnance: own team for the lead",
    async () => {
      for (const path of [
        `/timesheets/day/someone?date=${day}`,
        `/timesheets/month/someone?month=${fx.p1}`,
      ]) {
        const la = await ctx.as("la").get(path);
        assert(la.body.includes(nameMark("ec")), `la should see ec on ${path}`);
        assert(!la.body.includes(nameMark("eb")), `la sees eb on ${path}`);
      }
    },
  );
  await report.check(
    "Uzávěrka with ?month= stays closed to others",
    async () => {
      for (const who of ["ea", "la", "ad"] as const) {
        const res = await ctx
          .as(who)
          .get(`/timesheets/close?month=${CLOSED_MONTH}`);
        assert(res.notFound, `${who} should get 404`);
      }
    },
  );
  await report.check("ids in the path of detail pages", async () => {
    for (const [path, mark] of [
      [`/employees/${fx.ids.eb}`, nameMark("eb")],
      [`/employees/teams/${fx.teams.b}`, "Secchk B"],
      [`/jobs/${fx.jobs.j1}`, "Secchk zakázka"],
      [`/jobs/customers/${fx.customerId}`, "Secchk zákazník"],
    ])
      for (const who of ["ea", "la", "lb"] as const) {
        const res = await ctx.as(who).get(path);
        assert(res.notFound, `${who}: ${path} should be 404`);
        assert(!res.body.includes(mark), `${who}: ${path} shows ${mark}`);
      }
  });
  await report.check(
    "launcher and Docházka show no one else's data",
    async () => {
      for (const path of ["/", "/timesheets"]) {
        const res = await ctx.as("ea").get(path);
        for (const p of ["eb", "ec", "la"] as const)
          assert(
            !res.body.includes(nameMark(p)),
            `ea sees ${nameMark(p)} on ${path}`,
          );
      }
    },
  );
}
