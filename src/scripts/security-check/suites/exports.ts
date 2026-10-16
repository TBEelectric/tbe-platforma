import type { Ctx, Who } from "../context";
import { CLOSED_MONTH, type Person } from "../fixtures";
import { assert } from "../report";

// Route handlers with files: who may download what, and the headers of the answer (attachment,
// private, never cached). Payroll exports come from the snapshot of the closed month.

const SIGNED_IN: Person[] = ["ea", "la", "lb", "mg", "ad"];

const XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

type Download = {
  route: string;
  path: string;
  who: Person[];
  type: string;
  magic: string;
  /** Personal data: never stored by a browser or proxy cache. */
  personal: boolean;
};

export async function exportsSuite(ctx: Ctx) {
  const { fx, report } = ctx;
  report.section("Exporty a soubory");
  const { ids } = fx;

  const downloads: Download[] = [
    {
      route: "/timesheets/export/payroll/[month]/[version]/xlsx/route",
      path: `/timesheets/export/payroll/${CLOSED_MONTH}/1/xlsx`,
      who: ["mg"],
      type: XLSX,
      magic: "PK",
      personal: true,
    },
    {
      route: "/timesheets/export/payroll/[month]/[version]/pdf/route",
      path: `/timesheets/export/payroll/${CLOSED_MONTH}/1/pdf`,
      who: ["mg"],
      type: "application/pdf",
      magic: "%PDF",
      personal: true,
    },
    {
      route: "/timesheets/export/job-hours/route",
      path: `/timesheets/export/job-hours?from=${fx.p2}&to=${fx.today}`,
      who: ["mg"],
      type: "text/csv",
      magic: "﻿",
      personal: true,
    },
    {
      route: "/timesheets/export/month-pdf/route",
      path: `/timesheets/export/month-pdf?month=${fx.p1}&employee=${ids.eb}`,
      who: ["lb", "mg", "ad"],
      type: "application/pdf",
      magic: "%PDF",
      personal: true,
    },
    {
      route: "/employees/import/template/route",
      path: "/employees/import/template",
      who: ["ad"],
      type: XLSX,
      magic: "PK",
      personal: false,
    },
  ];

  for (const d of downloads) {
    report.cover(d.route);
    await report.check(`${d.path}: only ${d.who.join(", ")}`, async () => {
      for (const who of SIGNED_IN) {
        const res = await ctx.as(who).getBytes(d.path);
        if (!d.who.includes(who)) {
          assert(res.status === 404, `${who}: status ${res.status}`);
          assert(
            !res.bytes.toString("utf8").includes("Secchk"),
            `${who}: data in 404`,
          );
          continue;
        }
        assert(res.status === 200, `${who}: status ${res.status}`);
        const type = res.headers.get("content-type") ?? "";
        assert(type.startsWith(d.type), `${who}: Content-Type ${type}`);
        assert(
          res.bytes.subarray(0, Buffer.byteLength(d.magic)).toString("utf8") ===
            d.magic,
          `${who}: not a ${d.type} file`,
        );
        assert(
          /^attachment; filename="[^"/\\]+"$/.test(
            res.headers.get("content-disposition") ?? "",
          ),
          `${who}: Content-Disposition ${res.headers.get("content-disposition")}`,
        );
        const cache = res.headers.get("cache-control") ?? "";
        if (d.personal)
          assert(
            /private/.test(cache) && /no-store/.test(cache),
            `${who}: Cache-Control ${cache}`,
          );
        else assert(!/public/.test(cache), `${who}: Cache-Control ${cache}`);
      }
    });
    await report.check(`${d.path}: nothing without a session`, async () => {
      for (const who of ["anon", "forged"] as Who[]) {
        const res = await ctx.as(who).getBytes(d.path);
        // Sign-in redirect (proxy, requireUser) or 404 (the template asks getCurrentUser).
        const toLogin =
          res.status >= 300 &&
          res.status < 400 &&
          res.location?.includes("/login");
        assert(toLogin || res.status === 404, `${who}: status ${res.status}`);
        assert(
          !res.bytes.toString("utf8").startsWith(d.magic),
          `${who}: got the file`,
        );
      }
    });
  }

  await report.check(
    "month PDF: own month, own team, another team",
    async () => {
      const own = await ctx
        .as("ea")
        .getBytes(`/timesheets/export/month-pdf?month=${fx.p1}`);
      assert(own.status === 200, `ea own: ${own.status}`);
      const team = await ctx
        .as("la")
        .getBytes(
          `/timesheets/export/month-pdf?month=${fx.p1}&employee=${ids.ec}`,
        );
      assert(team.status === 200, `la for ec: ${team.status}`);
      for (const [who, target] of [
        ["ea", ids.ec],
        ["la", ids.eb],
        ["ea", ids.mg],
      ] as const) {
        const res = await ctx
          .as(who)
          .getBytes(
            `/timesheets/export/month-pdf?month=${fx.p1}&employee=${target}`,
          );
        assert(
          res.status === 404,
          `${who} for another employee: ${res.status}`,
        );
      }
      const closed = await ctx
        .as("la")
        .getBytes(
          `/timesheets/export/month-pdf?month=${CLOSED_MONTH}&employee=${ids.eb}`,
        );
      assert(
        closed.status === 404,
        `la for eb in the closed month: ${closed.status}`,
      );
    },
  );
  await report.check(
    "export parameters: unknown version, bad month, bad id",
    async () => {
      for (const path of [
        `/timesheets/export/payroll/${CLOSED_MONTH}/99/xlsx`,
        `/timesheets/export/payroll/${CLOSED_MONTH}/0/pdf`,
        `/timesheets/export/payroll/${fx.p1}/1/xlsx`,
        "/timesheets/export/payroll/2016-01-01%27--/1/xlsx",
        `/timesheets/export/month-pdf?month=${fx.p1}&employee=${ids.eb}%27`,
        `/timesheets/export/month-pdf?month=2016-13-01`,
      ]) {
        const res = await ctx.as("mg").getBytes(path);
        assert(res.status === 404, `${path}: status ${res.status}`);
      }
      const bad = await ctx
        .as("mg")
        .getBytes("/timesheets/export/job-hours?from=2016-01-01&to=nope");
      assert(bad.status === 400, `job-hours with a bad date: ${bad.status}`);
    },
  );
  await report.check(
    "job-hours CSV: semicolons, UTF-8 BOM, only work",
    async () => {
      const res = await ctx
        .as("mg")
        .getBytes(`/timesheets/export/job-hours?from=${fx.p2}&to=${fx.today}`);
      const text = res.bytes.toString("utf8");
      assert(text.includes("SECCHK-1") && text.includes(";"), "no rows");
    },
  );
  await report.check("pages with personal data are not cached", async () => {
    for (const path of [
      `/timesheets/month?month=${fx.p1}&employee=${ids.eb}`,
      `/employees/${ids.eb}`,
      "/timesheets/close",
    ]) {
      const res = await ctx.as("mg").get(path);
      const cache = res.headers.get("cache-control") ?? "";
      assert(
        /private/.test(cache) && /no-store/.test(cache),
        `${path}: Cache-Control ${cache}`,
      );
    }
  });
}
