import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { closeDb } from "@/lib/db";
import { createCtx } from "./context";
import { createFixtures } from "./fixtures";
import { loadActions, loadRoutes, sessionCookie } from "./http";
import { Report } from "./report";
import { startServer } from "./server";
import { actionsSuite, reopenAction } from "./suites/actions";
import { exportsSuite } from "./suites/exports";
import { mailSuite } from "./suites/mail";
import { pagesSuite } from "./suites/pages";
import { devLoginSuite, sessionSuite } from "./suites/session";

/** Runs every suite against the started production server; returns the number of failures. */
export async function runChecks(
  secret: string,
  env: NodeJS.ProcessEnv,
): Promise<number> {
  const report = new Report();
  const fx = await createFixtures(secret);
  const server = await startServer(env);
  try {
    const actions = loadActions();
    // A well-signed cookie whose session does not exist: passes the proxy, must fail requireUser.
    const forged = sessionCookie(randomBytes(24).toString("base64url"), secret);
    const ctx = createCtx(fx, report, server, secret, actions, forged);

    // Pages first: they expect the test data as created.
    await pagesSuite(ctx);
    await actionsSuite(ctx);
    // The closed month (closed by the manager in actionsSuite) before it is reopened.
    await exportsSuite(ctx);
    await mailSuite(ctx, "manual");
    await reopenAction(ctx);
    await mailSuite(ctx, "worker");
    await devLoginSuite(ctx);
    // Last: archives people and removes roles.
    await sessionSuite(ctx);

    await report.coverage([...actions.keys()], loadRoutes());
  } finally {
    await server.stop();
    await closeDb();
    // Server output for debugging (logs/ is not committed); it holds the logged e-mails, no secrets.
    mkdirSync("logs", { recursive: true });
    writeFileSync("logs/security-check-server.log", server.output());
  }
  console.log(report.summary());
  return report.failed.length;
}
