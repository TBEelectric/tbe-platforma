import { spawnSync } from "node:child_process";
import cs from "../../../../messages/cs.json";
import { formState, type Ctx } from "../context";
import { form } from "../http";
import { assert } from "../report";

// Error pages and answers of failed actions in production: no stack trace, SQL, file paths or
// configuration; secrets appear neither in answers, nor in the server log, nor in the client bundle.

const PREV = {};
const LEAKS: Array<[string, RegExp]> = [
  ["SQL", /Failed query|from\s+"(core|timesheets)"\.|invalid input syntax/i],
  ["stack trace", /\n\s+at [^\n]*\.(js|ts|tsx):\d+:\d+/],
  ["file path", /\/Users\/|\/home\/|node_modules\/|\.next\/server/],
  ["database URL", /postgres(ql)?:\/\/[^"\s]*@/i],
];

/** Secret values from the environment (only their presence is reported, never the value). */
function secrets(): Array<[string, string]> {
  return (
    ["BETTER_AUTH_SECRET", "GOOGLE_CLIENT_SECRET", "SMTP_PASSWORD"] as const
  )
    .map((k) => [k, process.env[k] ?? ""] as [string, string])
    .filter(([, v]) => v.length >= 8);
}

/** Not a UUID; the second passes a loose /^[0-9a-f-]{36}$/ check, Postgres still rejects it. */
const BAD_IDS = ["x", "-".repeat(36)];

/** Pass a /^\d{4}-\d{2}-\d{2}$/ check (and Date.parse), Postgres rejects them with error 22008. */
const BAD_DATES = ["2026-02-30", "2026-13-01", "2025-02-29"];

/** What the server logs for an unexpected error (a 500), e.g. a failed query. */
const SERVER_ERROR =
  /22P02|22008|invalid input syntax|field value out of range|Failed query|\bError\b/;

/** Runs a request and returns what the server logged meanwhile (requests run one at a time). */
async function serverLogDuring<T>(
  ctx: Ctx,
  run: () => Promise<T>,
): Promise<[T, string]> {
  const start = ctx.server.output().length;
  const result = await run();
  // The log line may reach the pipe shortly after the response.
  await new Promise((r) => setTimeout(r, 150));
  return [result, ctx.server.output().slice(start)];
}

function leaksIn(text: string): string[] {
  const found = LEAKS.filter(([, re]) => re.test(text)).map(([name]) => name);
  for (const [name, value] of secrets())
    if (text.includes(value)) found.push(name);
  return found;
}

export async function errorsSuite(ctx: Ctx) {
  const { report, fx } = ctx;
  report.section("Chybové stránky a tajemství");

  for (const path of [
    "/employees/teams/00000000-0000-0000-0000-000000000000",
    "/does-not-exist",
    "/timesheets/day?date=2026-02-30&employee=x",
  ])
    await report.check(`error page ${path} shows no internals`, async () => {
      const res = await ctx.as("mg").get(path);
      const found = leaksIn(res.body);
      assert(
        found.length === 0,
        `status ${res.status}, contains: ${found.join(", ")}`,
      );
    });

  // Invalid IDs in the path: notFound() after the permission check, never a database error.
  for (const base of [
    "/employees",
    "/employees/teams",
    "/jobs",
    "/jobs/customers",
  ])
    for (const bad of BAD_IDS)
      await report.check(
        `${base}/${bad.slice(0, 8)}… is not found, no server error`,
        async () => {
          const [res, log] = await serverLogDuring(ctx, () =>
            ctx.as("mg").get(`${base}/${bad}`),
          );
          assert(res.notFound, `status ${res.status}, not 404`);
          assert(leaksIn(res.body).length === 0, "shows internals");
          assert(!SERVER_ERROR.test(log), `server log: ${log.slice(0, 300)}`);
        },
      );

  // Invalid ?employee=: the page falls back to the viewer, the export answers 404.
  for (const path of [
    "/timesheets/day?employee=",
    "/timesheets/month?employee=",
    "/timesheets/approval?employee=",
    "/timesheets/export/month-pdf?employee=",
  ])
    for (const bad of BAD_IDS)
      await report.check(
        `${path}${bad.slice(0, 8)}… has no server error`,
        async () => {
          const [res, log] = await serverLogDuring(ctx, () =>
            ctx.as("mg").get(`${path}${encodeURIComponent(bad)}`),
          );
          assert(res.status < 500, `status ${res.status}`);
          assert(leaksIn(res.body).length === 0, "shows internals");
          assert(!SERVER_ERROR.test(log), `server log: ${log.slice(0, 300)}`);
        },
      );

  // Impossible dates in ?date=: the page falls back to its default day, never a database error.
  for (const path of [
    "/timesheets/day?date=",
    `/timesheets/day?employee=${fx.ids.eb}&date=`,
    "/timesheets/day/someone?date=",
  ])
    for (const bad of BAD_DATES)
      await report.check(
        `${path.replace(fx.ids.eb, "eb")}${bad} has no server error`,
        async () => {
          const [res, log] = await serverLogDuring(ctx, () =>
            ctx.as("mg").get(`${path}${bad}`),
          );
          assert(res.status < 500, `status ${res.status}`);
          assert(leaksIn(res.body).length === 0, "shows internals");
          assert(!SERVER_ERROR.test(log), `server log: ${log.slice(0, 300)}`);
        },
      );

  // Impossible dates in timeline action arguments: their usual refusal, never a database error.
  for (const [label, expected, run] of [
    [
      "timelineAction",
      { ok: false, error: "validation.invalid" },
      (date: string) =>
        ctx.call("mg", "timeline", "timelineAction", [
          {
            employeeId: fx.ids.eb,
            date,
            reason: "secchk",
            command: { type: "fill", source: "usual" },
          },
        ]),
    ],
    [
      "loadTimelineDayAction",
      null,
      (date: string) =>
        ctx.call("mg", "timeline", "loadTimelineDayAction", [fx.ids.eb, date]),
    ],
    [
      "pinTeamJobAction",
      null,
      (date: string) =>
        ctx.call("mg", "timeline", "pinTeamJobAction", [
          fx.ids.eb,
          date,
          fx.jobs.j1,
          true,
        ]),
    ],
  ] as const)
    for (const bad of BAD_DATES)
      await report.check(
        `${label}(${bad}) is refused, no server error`,
        async () => {
          const [res, log] = await serverLogDuring(ctx, () => run(bad));
          assert(
            res.kind === "ok" &&
              JSON.stringify(res.value) === JSON.stringify(expected),
            `${res.kind} ${JSON.stringify(res.value ?? null).slice(0, 120)}`,
          );
          assert(!SERVER_ERROR.test(log), `server log: ${log.slice(0, 300)}`);
        },
      );

  // Invalid IDs in bound arguments: "not found" after the permission check, never a database error.
  // Form actions answer the form error "Záznam nenalezen.", the others notFound(). Valid form fields,
  // so the request gets past validation to the ID.
  const { ids } = fx;
  const reason = () => form({ reason: "x" });
  const asForm = cs.errors.notFound;
  for (const [label, expected, run] of [
    [
      "setLeaveAction",
      asForm,
      (id: string) =>
        ctx.call("mg", "ts", "setLeaveAction", [
          id,
          PREV,
          form({
            year: fx.today.slice(0, 4),
            hoursEntitled: "160",
            hoursCarriedOver: "0",
          }),
        ]),
    ],
    [
      "decideAbsenceAction",
      asForm,
      (id: string) =>
        ctx.call("mg", "ts", "decideAbsenceAction", [
          id,
          "approve",
          PREV,
          reason(),
        ]),
    ],
    [
      "cancelAbsenceAction",
      asForm,
      (id: string) =>
        ctx.call("mg", "ts", "cancelAbsenceAction", [id, PREV, reason()]),
    ],
    [
      "deleteStandbyAction",
      asForm,
      (id: string) =>
        ctx.call("mg", "ts", "deleteStandbyAction", [id, PREV, reason()]),
    ],
    [
      "setOvertimeAction",
      asForm,
      (id: string) =>
        ctx.call("mg", "ts", "setOvertimeAction", [id, true, PREV, reason()]),
    ],
    [
      "deleteDayTemplateAction",
      "notFound",
      (id: string) => ctx.call("mg", "ts", "deleteDayTemplateAction", [id]),
    ],
    [
      "updateEmployeeAction",
      asForm,
      (id: string) =>
        ctx.call("mg", "core", "updateEmployeeAction", [
          id,
          PREV,
          form({
            personalNumber: "S-ec",
            firstName: "Secchk",
            lastName: "SecchkEc",
            tracksTime: true,
          }),
        ]),
    ],
    [
      "updateTeamAction",
      asForm,
      (id: string) =>
        ctx.call("mg", "core", "updateTeamAction", [
          id,
          PREV,
          form({ name: "Secchk B", leadEmployeeId: ids.lb }),
        ]),
    ],
    [
      "setTeamArchivedAction",
      "notFound",
      (id: string) =>
        ctx.call("mg", "core", "setTeamArchivedAction", [id, true]),
    ],
    [
      "unpinTeamJobAction(bad team)",
      "notFound",
      (id: string) =>
        ctx.call("mg", "core", "unpinTeamJobAction", [id, fx.jobs.j1]),
    ],
    [
      "unpinTeamJobAction(bad job)",
      "notFound",
      (id: string) =>
        ctx.call("mg", "core", "unpinTeamJobAction", [fx.teams.b, id]),
    ],
    [
      "updateJobAction",
      asForm,
      (id: string) =>
        ctx.call("mg", "core", "updateJobAction", [
          id,
          PREV,
          form({
            code: "SECCHK-X",
            name: "Y",
            customerId: fx.customerId,
            status: "active",
            siteId: fx.siteId,
          }),
        ]),
    ],
    [
      "setJobArchivedAction",
      "notFound",
      (id: string) =>
        ctx.call("mg", "core", "setJobArchivedAction", [id, true]),
    ],
    [
      "updateCustomerAction",
      asForm,
      (id: string) =>
        ctx.call("mg", "core", "updateCustomerAction", [
          id,
          PREV,
          form({ name: "Y" }),
        ]),
    ],
    [
      "setCustomerArchivedAction",
      "notFound",
      (id: string) =>
        ctx.call("mg", "core", "setCustomerArchivedAction", [id, true]),
    ],
  ] as const)
    for (const bad of BAD_IDS)
      await report.check(
        `${label}(${JSON.stringify(bad.slice(0, 8))}) is not found, no server error`,
        async () => {
          const [res, log] = await serverLogDuring(ctx, () => run(bad));
          const found = leaksIn(res.body);
          assert(
            found.length === 0,
            `${res.kind}, contains: ${found.join(", ")}`,
          );
          const answer =
            res.kind === "ok" ? formState(res).errors?._form : res.kind;
          assert(answer === expected, `${res.kind}: ${String(answer)}`);
          assert(!SERVER_ERROR.test(log), `server log: ${log.slice(0, 300)}`);
        },
      );

  await report.check(
    "no invalid-uuid errors (22P02) in the server log",
    async () => {
      const log = ctx.server.output();
      assert(!/22P02|invalid input syntax for type uuid/.test(log), "found");
    },
  );

  await report.check(
    "no impossible-date errors (22008) in the server log",
    async () => {
      const log = ctx.server.output();
      assert(!/22008|date\/time field value out of range/.test(log), "found");
    },
  );

  await report.check("Better Auth errors show no internals", async () => {
    for (const [path, init] of [
      [
        "/api/auth/get-session",
        { headers: { cookie: "better-auth.session_token=garbage" } },
      ],
      [
        "/api/auth/sign-in/social",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{",
        },
      ],
    ] as const) {
      const res = await ctx.as("anon").request(path, init as RequestInit);
      const found = leaksIn(await res.text());
      assert(found.length === 0, `${path}: ${found.join(", ")}`);
    }
  });

  await report.check("secrets are not in the server log", async () => {
    const found = secrets()
      .filter(([, v]) => ctx.server.output().includes(v))
      .map(([k]) => k);
    assert(found.length === 0, `server log contains ${found.join(", ")}`);
  });
  await report.check("secrets are not in the client bundle", async () => {
    const found = secrets()
      .filter(
        ([, v]) => spawnSync("grep", ["-rlF", v, ".next/static"]).status === 0,
      )
      .map(([k]) => k);
    assert(found.length === 0, `.next/static contains ${found.join(", ")}`);
    const dbUrl = spawnSync("grep", [
      "-rlE",
      "postgres(ql)?://",
      ".next/static",
    ]);
    assert(dbUrl.status !== 0, ".next/static contains a database URL");
  });
}
