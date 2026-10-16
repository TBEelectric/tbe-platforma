import { spawnSync } from "node:child_process";
import type { Ctx } from "../context";
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
    "/employees/not-a-uuid",
    "/jobs/not-a-uuid",
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

  for (const [label, run] of [
    [
      "setLeaveAction(bad id)",
      () =>
        ctx.call("mg", "ts", "setLeaveAction", [
          "x",
          PREV,
          form({ year: "2026" }),
        ]),
    ],
    [
      "decideAbsenceAction(bad id)",
      () =>
        ctx.call("mg", "ts", "decideAbsenceAction", [
          "x",
          "approve",
          PREV,
          form({}),
        ]),
    ],
    [
      "updateJobAction(bad id)",
      () =>
        ctx.call("mg", "core", "updateJobAction", [
          "x",
          PREV,
          form({ code: "X", name: "Y", status: "active", siteId: fx.siteId }),
        ]),
    ],
  ] as const)
    await report.check(
      `failed action ${label} shows no internals`,
      async () => {
        const res = await run();
        const found = leaksIn(res.body);
        assert(
          found.length === 0,
          `${res.kind}, contains: ${found.join(", ")}`,
        );
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
