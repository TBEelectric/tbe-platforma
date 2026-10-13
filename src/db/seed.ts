// Sample data for local development: pnpm db:seed
// Sample employees, teams and jobs (matching the screen references) are added in milestone 2.
import { sql } from "drizzle-orm";
import { closeDb, db } from "@/lib/db";

async function main() {
  const result = await db.execute<{ schema_name: string }>(
    sql`select schema_name from information_schema.schemata where schema_name = 'core'`,
  );
  if (result.rows.length === 0)
    throw new Error("Schema core is missing, run pnpm db:migrate first");
  console.log("Seed: nothing to insert yet.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeDb);
