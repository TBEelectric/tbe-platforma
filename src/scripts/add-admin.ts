// Adds an administrator (also for the first sign-in on a new server).
// Usage: pnpm admin:add <e-mail> <first name> <last name> [--personal-number=A001] [--no-time]
import { closeDb, db } from "@/lib/db";
import { ensureAdmin } from "@/modules/core";

async function main() {
  const args = process.argv.slice(2);
  const flags = new Map(
    args
      .filter((a) => a.startsWith("--"))
      .map((a) => a.slice(2).split("=") as [string, string | undefined]),
  );
  const [email, firstName, lastName] = args.filter((a) => !a.startsWith("--"));
  if (!email?.includes("@") || !firstName || !lastName) {
    console.error(
      "Usage: pnpm admin:add <e-mail> <first name> <last name> [--personal-number=A001] [--no-time]",
    );
    process.exitCode = 1;
    return;
  }
  const result = await ensureAdmin(db, {
    email,
    firstName,
    lastName,
    personalNumber: flags.get("personal-number") ?? `A-${email.split("@")[0]}`,
    tracksTime: !flags.has("no-time"),
  });
  console.log(
    `${result.created ? "Created" : "Updated"} administrator ${email}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeDb);
