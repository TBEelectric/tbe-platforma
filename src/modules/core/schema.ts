import { pgSchema } from "drizzle-orm/pg-core";

/** Postgres schema for the core module (employees, teams, jobs, auth, audit). */
export const coreSchema = pgSchema("core");
