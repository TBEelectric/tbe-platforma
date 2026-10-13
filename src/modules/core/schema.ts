import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  jsonb,
  numeric,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

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

/** Business records are never deleted, only archived. */
const archivable = {
  ...timestamps,
  archivedAt: timestamp({ withTimezone: true }),
};

// ── Better Auth tables (field names must match Better Auth's model) ──

export const user = coreSchema.table("user", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  /** Linked on first request by matching e-mail (see requireUser). */
  employeeId: uuid()
    .unique()
    .references(() => employee.id),
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

// ── Enums ──

export const employmentType = coreSchema.enum("employment_type", [
  "hpp",
  "dpp",
  "dpc",
]);
export const scheduleType = coreSchema.enum("schedule_type", [
  "flexible",
  "uneven",
]);
export const jobStatus = coreSchema.enum("job_status", ["active", "closed"]);
export const siteType = coreSchema.enum("site_type", [
  "headquarters",
  "warehouse",
  "construction",
  "customer_address",
]);

// ── People ──

export const employee = coreSchema.table(
  "employee",
  {
    id: uuid().primaryKey().defaultRandom(),
    personalNumber: text().notNull().unique(),
    firstName: text().notNull(),
    lastName: text().notNull(),
    /** Company Google account; an active employee with an e-mail may sign in. */
    email: text(),
    active: boolean().notNull().default(true),
    /** false for accounts that do not record attendance (e.g. an external administrator). */
    tracksTime: boolean().notNull().default(true),
    ...archivable,
  },
  (table) => [
    uniqueIndex("employee_email_unique")
      .on(sql`lower(${table.email})`)
      .where(sql`${table.email} is not null`),
    index().on(table.lastName, table.firstName),
  ],
);

// Overlapping employments per employee are prevented by an exclusion constraint (custom migration).
export const employment = coreSchema.table(
  "employment",
  {
    id: uuid().primaryKey().defaultRandom(),
    employeeId: uuid()
      .notNull()
      .references(() => employee.id),
    type: employmentType().notNull(),
    validFrom: date({ mode: "string" }).notNull(),
    validTo: date({ mode: "string" }),
    weeklyHours: numeric({ precision: 4, scale: 1, mode: "number" }),
    scheduleType: scheduleType().notNull(),
    ...archivable,
  },
  (table) => [
    index().on(table.employeeId, table.validFrom),
    check(
      "employment_valid_range",
      sql`${table.validTo} is null or ${table.validTo} >= ${table.validFrom}`,
    ),
    check(
      "employment_weekly_hours",
      sql`${table.type} = 'dpp' or (${table.weeklyHours} is not null and ${table.weeklyHours} > 0)`,
    ),
  ],
);

export const team = coreSchema.table(
  "team",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    leadEmployeeId: uuid().references(() => employee.id),
    ...archivable,
  },
  (table) => [
    uniqueIndex("team_name_unique")
      .on(sql`lower(${table.name})`)
      .where(sql`${table.archivedAt} is null`),
  ],
);

// One team per employee at a time is enforced by an exclusion constraint (custom migration).
export const teamMember = coreSchema.table(
  "team_member",
  {
    id: uuid().primaryKey().defaultRandom(),
    teamId: uuid()
      .notNull()
      .references(() => team.id),
    employeeId: uuid()
      .notNull()
      .references(() => employee.id),
    validFrom: date({ mode: "string" }).notNull(),
    validTo: date({ mode: "string" }),
    ...timestamps,
  },
  (table) => [
    index().on(table.teamId),
    index().on(table.employeeId),
    check(
      "team_member_valid_range",
      sql`${table.validTo} is null or ${table.validTo} >= ${table.validFrom}`,
    ),
  ],
);

/** module '*' + role 'admin' = administrator; module 'timesheets' + role 'manager' = timesheets manager. */
export const roleAssignment = coreSchema.table(
  "role_assignment",
  {
    id: uuid().primaryKey().defaultRandom(),
    employeeId: uuid()
      .notNull()
      .references(() => employee.id),
    module: text().notNull(),
    role: text().notNull(),
    ...archivable,
  },
  (table) => [
    uniqueIndex("role_assignment_unique")
      .on(table.employeeId, table.module, table.role)
      .where(sql`${table.archivedAt} is null`),
  ],
);

// ── Customers and jobs ──

export const customer = coreSchema.table(
  "customer",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    /** Czech company ID, 8 digits. */
    ico: text(),
    externalId: text(),
    ...archivable,
  },
  (table) => [
    uniqueIndex("customer_ico_unique")
      .on(table.ico)
      .where(sql`${table.ico} is not null`),
    index("customer_name_lower_index").on(sql`lower(${table.name})`),
    check(
      "customer_ico_format",
      sql`${table.ico} is null or ${table.ico} ~ '^[0-9]{8}$'`,
    ),
  ],
);

export const job = coreSchema.table(
  "job",
  {
    id: uuid().primaryKey().defaultRandom(),
    code: text().notNull().unique(),
    name: text().notNull(),
    customerId: uuid().references(() => customer.id),
    status: jobStatus().notNull().default("active"),
    externalId: text(),
    ...archivable,
  },
  (table) => [index().on(table.customerId)],
);

export const site = coreSchema.table(
  "site",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    type: siteType().notNull(),
    address: text(),
    lat: numeric({ precision: 9, scale: 6, mode: "number" }),
    lng: numeric({ precision: 9, scale: 6, mode: "number" }),
    customerId: uuid().references(() => customer.id),
    ...archivable,
  },
  (table) => [index().on(table.customerId)],
);

// ── Calendar and audit ──

export const publicHoliday = coreSchema.table("public_holiday", {
  id: uuid().primaryKey().defaultRandom(),
  date: date({ mode: "string" }).notNull().unique(),
  name: text().notNull(),
  ...timestamps,
});

/** Append-only history of changes. actor_user_id is null for system jobs and scripts. */
export const auditLog = coreSchema.table(
  "audit_log",
  {
    id: uuid().primaryKey().defaultRandom(),
    actorUserId: uuid().references(() => user.id),
    entity: text().notNull(),
    entityId: uuid().notNull(),
    action: text().notNull(),
    before: jsonb(),
    after: jsonb(),
    reason: text(),
    at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index().on(table.entity, table.entityId), index().on(table.at)],
);
