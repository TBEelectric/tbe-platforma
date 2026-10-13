import { boolean, index, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { pgSchema } from "drizzle-orm/pg-core";

/** Postgres schema for the core module (employees, teams, jobs, auth, audit). */
export const coreSchema = pgSchema("core");

// Column names are snake_case via Drizzle `casing: "snake_case"` (see src/lib/db.ts).

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

// ── Better Auth tables (field names must match Better Auth's model) ──
// employee_id on user is added in milestone 2.

export const user = coreSchema.table("user", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  ...timestamps,
});

export const session = coreSchema.table(
  "session",
  {
    id: uuid().primaryKey().defaultRandom(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    token: text().notNull().unique(),
    ipAddress: text(),
    userAgent: text(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [index().on(table.userId)],
);

export const account = coreSchema.table(
  "account",
  {
    id: uuid().primaryKey().defaultRandom(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true }),
    scope: text(),
    password: text(),
    ...timestamps,
  },
  (table) => [index().on(table.userId)],
);

export const verification = coreSchema.table(
  "verification",
  {
    id: uuid().primaryKey().defaultRandom(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [index().on(table.identifier)],
);
