import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as coreSchema from "@/modules/core/schema";
import * as timesheetsSchema from "@/modules/timesheets/schema";
import { env } from "@/lib/env";

const schema = { ...coreSchema, ...timesheetsSchema };

// Reuse one pool across hot reloads in development.
const globalForDb = globalThis as unknown as { pgPool?: Pool };

const pool =
  globalForDb.pgPool ?? new Pool({ connectionString: env.DATABASE_URL });
if (process.env.NODE_ENV !== "production") globalForDb.pgPool = pool;

export const db = drizzle({ client: pool, schema, casing: "snake_case" });
export type Db = typeof db;

/** Closes the pool; for scripts (seed, worker) that must exit. */
export async function closeDb() {
  await pool.end();
  globalForDb.pgPool = undefined;
}
