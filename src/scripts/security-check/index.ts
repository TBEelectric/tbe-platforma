// pnpm security:check [--no-build] [--keep]
//
// Security check before a deployment (docs/bezpecnost.md): creates the local database tbe_security
// (migrations + seed + test data), builds the app and starts the production server on port 3100,
// then requests every page, route handler and server action as each role and checks sessions,
// development sign-in, exports, e-mails and error pages. Never touches the development database,
// production or other services (no SMTP). Exit code 1 when a check fails.
//
//   --no-build   reuse the existing production build (.next) instead of `pnpm build`
//   --keep       keep the database tbe_security afterwards (for debugging)

import pg from "pg";
import { checkEnv, DB_NAME, securityDatabaseUrls } from "./config";
import { run } from "./server";

async function recreateDatabase(
  adminUrl: string,
  drop: boolean,
  create: boolean,
) {
  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();
  try {
    if (drop)
      await client.query(`drop database if exists ${DB_NAME} with (force)`);
    if (create) await client.query(`create database ${DB_NAME}`);
  } finally {
    await client.end();
  }
}

async function main() {
  const flags = new Set(process.argv.slice(2));
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret)
    throw new Error("BETTER_AUTH_SECRET is not set (see .env.example)");
  const { url, adminUrl } = securityDatabaseUrls(process.env.DATABASE_URL);
  const env = checkEnv(process.env, url);

  console.log(
    `security:check – database ${DB_NAME}, server ${env.BETTER_AUTH_URL}`,
  );
  await recreateDatabase(adminUrl, true, true);
  try {
    console.log("migrations and seed…");
    await run("pnpm", ["-s", "db:migrate"], env);
    await run("pnpm", ["-s", "db:seed"], env);
    if (!flags.has("--no-build")) {
      console.log("pnpm build…");
      await run("pnpm", ["-s", "build"], env);
    }
    // This process uses the same database and settings as the server (db client, sendMail).
    Object.assign(process.env, env);
    const { runChecks } = await import("./run");
    const failed = await runChecks(secret, env);
    process.exitCode = failed > 0 ? 1 : 0;
  } finally {
    if (!flags.has("--keep")) await recreateDatabase(adminUrl, true, false);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
