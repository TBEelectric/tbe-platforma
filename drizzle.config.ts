import { defineConfig } from "drizzle-kit";

process.loadEnvFile?.(".env");

if (!process.env.DATABASE_URL)
  throw new Error("DATABASE_URL is not set (see .env.example)");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/modules/*/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL },
  casing: "snake_case",
  // Each module owns its Postgres schema.
  schemaFilter: ["core", "timesheets"],
  strict: true,
  verbose: true,
});
