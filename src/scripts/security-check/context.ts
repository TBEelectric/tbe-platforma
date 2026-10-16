import { sql, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { auditLog } from "@/modules/core/schema";
import type { Fixtures, Person } from "./fixtures";
import { Client, type ActionRef, type ActionResponse } from "./http";
import { assert, type Report } from "./report";
import type { Server } from "./server";

// Shared state of the suites and the verdict helpers: a denied attempt changes nothing in the
// database (target rows and audit_log), an allowed one does.

export const FILES = {
  core: "src/modules/core/actions.ts",
  ts: "src/modules/timesheets/actions.ts",
  timeline: "src/modules/timesheets/timeline-actions.ts",
  import: "src/modules/timesheets/import/actions.ts",
  auth: "src/lib/auth-actions.ts",
  dev: "src/lib/dev-login-actions.ts",
} as const;

export type Who = Person | "anon" | "forged";

export type Ctx = {
  fx: Fixtures;
  report: Report;
  server: Server;
  secret: string;
  actions: Map<string, ActionRef>;
  as: (who: Who) => Client;
  /** Calls an action as someone and marks it covered. */
  call: (
    who: Who,
    file: keyof typeof FILES,
    name: string,
    args: unknown[],
    options?: { origin?: string },
  ) => Promise<ActionResponse>;
};

export function createCtx(
  fx: Fixtures,
  report: Report,
  server: Server,
  secret: string,
  actions: Map<string, ActionRef>,
  forgedCookie: string,
): Ctx {
  const clients = new Map<Who, Client>();
  const as = (who: Who) => {
    let client = clients.get(who);
    if (!client) {
      client = new Client(
        who,
        who === "anon"
          ? null
          : who === "forged"
            ? forgedCookie
            : fx.cookies[who],
      );
      clients.set(who, client);
    }
    return client;
  };
  return {
    fx,
    report,
    server,
    secret,
    actions,
    as,
    call: (who, file, name, args, options) => {
      const ref = actions.get(`${FILES[file]}#${name}`);
      if (!ref)
        throw new Error(`action ${FILES[file]}#${name} is not in the build`);
      report.cover(ref.key);
      return as(who).action(ref, args, options);
    },
  };
}

/** One row as JSON (null when missing); for before/after comparisons. */
export async function row(table: PgTable, id: string): Promise<unknown> {
  const result = await db.execute(
    sql`select * from ${table} where ${sql.identifier("id")} = ${id}`,
  );
  return result.rows[0] ?? null;
}

/** Rows of a table matching a condition, as JSON (for comparisons). */
export async function rows(table: PgTable, where: SQL): Promise<unknown[]> {
  const result = await db.execute(
    sql`select * from ${table} where ${where} order by ${sql.identifier("id")}`,
  );
  return result.rows;
}

export async function auditCount(): Promise<number> {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(auditLog);
  return r.n;
}

const describe = (res: ActionResponse) =>
  `${res.kind}${res.location ? ` → ${res.location}` : ""} ${JSON.stringify(res.value ?? null).slice(0, 160)}`;

/** The attempt must not change the probed data nor add to audit_log. */
export async function denied(
  ctx: Ctx,
  label: string,
  attempt: () => Promise<ActionResponse>,
  probe: () => Promise<unknown>,
  check?: (res: ActionResponse) => void,
) {
  await ctx.report.check(`denied: ${label}`, async () => {
    const before = JSON.stringify(await probe());
    const audits = await auditCount();
    const res = await attempt();
    const after = JSON.stringify(await probe());
    assert(after === before, `data changed (response ${describe(res)})`);
    assert(
      (await auditCount()) === audits,
      `audit_log grew (response ${describe(res)})`,
    );
    check?.(res);
  });
}

/**
 * Control case: the same action with permission changes the data. Proves the request reaches the
 * action, so a "denied" above is not just a broken request.
 */
export async function allowed(
  ctx: Ctx,
  label: string,
  attempt: () => Promise<ActionResponse>,
  probe: () => Promise<unknown>,
  options: { audited?: boolean; check?: (res: ActionResponse) => void } = {},
) {
  await ctx.report.check(`allowed: ${label}`, async () => {
    const before = JSON.stringify(await probe());
    const audits = await auditCount();
    const res = await attempt();
    assert(
      res.kind !== "error" && res.kind !== "notFound",
      `refused (${describe(res)})`,
    );
    assert(
      res.location !== "/login",
      `redirected to sign-in (${describe(res)})`,
    );
    const after = JSON.stringify(await probe());
    assert(after !== before, `nothing changed (response ${describe(res)})`);
    if (options.audited !== false)
      assert((await auditCount()) > audits, "no audit_log row written");
    options.check?.(res);
  });
}

/** Control case without a change: the action passed the permission check (e.g. a refused form). */
export async function reached(
  ctx: Ctx,
  label: string,
  attempt: () => Promise<ActionResponse>,
  check?: (res: ActionResponse) => void,
) {
  await ctx.report.check(`reached: ${label}`, async () => {
    const res = await attempt();
    assert(res.kind === "ok", `refused (${describe(res)})`);
    check?.(res);
  });
}

/** Value of a form action's result (FormState). */
export function formState(res: ActionResponse): {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
} {
  return (res.value ?? {}) as ReturnType<typeof formState>;
}
