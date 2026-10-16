import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
// Cross-module foreign keys: schema files may import other modules' schema.ts directly.
import { employee, job, user } from "../core/schema";

/** Postgres schema for the timesheets module. */
export const timesheetsSchema = pgSchema("timesheets");

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

// ── Enums ──

export const timeEntryKind = timesheetsSchema.enum("time_entry_kind", [
  "work",
  "break",
]);
/** self = written by the employee, manager = written on their behalf. */
export const timeEntrySource = timesheetsSchema.enum("time_entry_source", [
  "self",
  "manager",
]);
export const absenceType = timesheetsSchema.enum("absence_type", [
  "vacation",
  "sick",
  "ocr",
  "doctor",
  "other",
]);
export const absenceStatus = timesheetsSchema.enum("absence_status", [
  "requested",
  "approved",
  "rejected",
]);
export const timesheetStatus = timesheetsSchema.enum("timesheet_status", [
  "open",
  "confirmed",
  "approved",
  "closed",
]);

// ── Catalogues and settings ──

/** Montáž, revize, cesta (with a job), režie (requires_job = false). */
export const workType = timesheetsSchema.table("work_type", {
  id: uuid().primaryKey().defaultRandom(),
  code: text().notNull().unique(),
  name: text().notNull(),
  countsAsWork: boolean().notNull().default(true),
  requiresJob: boolean().notNull().default(true),
  sortOrder: integer().notNull().default(0),
  ...archivable,
});

/** Thresholds and limits; the row with the latest valid_from on or before a day applies. */
export const timesheetSettings = timesheetsSchema.table(
  "timesheet_settings",
  {
    id: uuid().primaryKey().defaultRandom(),
    key: text().notNull(),
    value: jsonb().notNull(),
    validFrom: date({ mode: "string" }).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex().on(table.key, table.validFrom)],
);

// ── Daily records ──

// Overlapping entries of one employee are prevented by an exclusion constraint (custom migration).
// Deleting an entry in an open month is a real delete; the audit log keeps it.
export const timeEntry = timesheetsSchema.table(
  "time_entry",
  {
    id: uuid().primaryKey().defaultRandom(),
    employeeId: uuid()
      .notNull()
      .references(() => employee.id),
    /** Day the entry started (Europe/Prague); entries crossing midnight belong to it. */
    workDate: date({ mode: "string" }).notNull(),
    startAt: timestamp({ withTimezone: true }).notNull(),
    endAt: timestamp({ withTimezone: true }).notNull(),
    kind: timeEntryKind().notNull(),
    jobId: uuid().references(() => job.id),
    workTypeId: uuid().references(() => workType.id),
    note: text(),
    /** Overtime (přesčas), set by the team lead or the manager at approval (§ 96: start and end). */
    overtime: boolean().notNull().default(false),
    createdByUserId: uuid().references(() => user.id),
    source: timeEntrySource().notNull().default("self"),
    ...timestamps,
  },
  (table) => [
    index().on(table.employeeId, table.workDate),
    index().on(table.jobId),
    check(
      "time_entry_range",
      sql`${table.endAt} > ${table.startAt} and ${table.endAt} - ${table.startAt} <= interval '24 hours'`,
    ),
    check(
      "time_entry_kind_fields",
      sql`(${table.kind} = 'work' and ${table.workTypeId} is not null) or (${table.kind} = 'break' and ${table.workTypeId} is null and ${table.jobId} is null)`,
    ),
  ],
);

/** Without hours = whole days by the employment; with hours = part of a single day. */
export const absence = timesheetsSchema.table(
  "absence",
  {
    id: uuid().primaryKey().defaultRandom(),
    employeeId: uuid()
      .notNull()
      .references(() => employee.id),
    type: absenceType().notNull(),
    dateFrom: date({ mode: "string" }).notNull(),
    dateTo: date({ mode: "string" }).notNull(),
    hours: numeric({ precision: 4, scale: 1, mode: "number" }),
    note: text(),
    status: absenceStatus().notNull().default("requested"),
    decidedByUserId: uuid().references(() => user.id),
    decidedAt: timestamp({ withTimezone: true }),
    decisionReason: text(),
    ...archivable,
  },
  (table) => [
    index().on(table.employeeId, table.dateFrom),
    index().on(table.status),
    check("absence_range", sql`${table.dateTo} >= ${table.dateFrom}`),
    check(
      "absence_hours",
      sql`${table.hours} is null or (${table.hours} > 0 and ${table.hours} <= 24 and ${table.dateFrom} = ${table.dateTo})`,
    ),
  ],
);

// Overlapping standby of one employee is prevented by an exclusion constraint (custom migration).
export const standby = timesheetsSchema.table(
  "standby",
  {
    id: uuid().primaryKey().defaultRandom(),
    employeeId: uuid()
      .notNull()
      .references(() => employee.id),
    startAt: timestamp({ withTimezone: true }).notNull(),
    endAt: timestamp({ withTimezone: true }).notNull(),
    note: text(),
    createdByUserId: uuid().references(() => user.id),
    ...timestamps,
  },
  (table) => [
    index().on(table.employeeId, table.startAt),
    check("standby_range", sql`${table.endAt} > ${table.startAt}`),
  ],
);

/**
 * "Můj obvyklý den": one template per employee (items: from, to, kind work/break; rules/day-template.ts).
 * Without it the company default from timesheet_settings (key default_day_template) applies.
 */
export const dayTemplate = timesheetsSchema.table("day_template", {
  id: uuid().primaryKey().defaultRandom(),
  employeeId: uuid()
    .notNull()
    .unique()
    .references(() => employee.id),
  items: jsonb().notNull(),
  ...timestamps,
});

// ── Month ──

/** One row per employee and month, created on first change; a missing row means open. */
export const timesheet = timesheetsSchema.table(
  "timesheet",
  {
    id: uuid().primaryKey().defaultRandom(),
    employeeId: uuid()
      .notNull()
      .references(() => employee.id),
    /** First day of the month. */
    month: date({ mode: "string" }).notNull(),
    status: timesheetStatus().notNull().default("open"),
    confirmedAt: timestamp({ withTimezone: true }),
    approvedByUserId: uuid().references(() => user.id),
    approvedAt: timestamp({ withTimezone: true }),
    returnReason: text(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex().on(table.employeeId, table.month),
    index().on(table.month, table.status),
    check("timesheet_month_start", sql`extract(day from ${table.month}) = 1`),
  ],
);

/** Closing a month for everyone; reopening and closing again raises export_version. */
export const periodClose = timesheetsSchema.table(
  "period_close",
  {
    id: uuid().primaryKey().defaultRandom(),
    /** First day of the month. */
    month: date({ mode: "string" }).notNull().unique(),
    closedByUserId: uuid().references(() => user.id),
    closedAt: timestamp({ withTimezone: true }),
    reopenedByUserId: uuid().references(() => user.id),
    reopenedAt: timestamp({ withTimezone: true }),
    reopenReason: text(),
    exportVersion: integer().notNull().default(1),
    ...timestamps,
  },
  (table) => [
    check(
      "period_close_month_start",
      sql`extract(day from ${table.month}) = 1`,
    ),
  ],
);

/**
 * Snapshot of the payroll export data taken at each close of a month (version = period_close
 * export_version). Exports read the snapshot, never live data, so every version can be re-downloaded.
 */
export const periodExport = timesheetsSchema.table(
  "period_export",
  {
    id: uuid().primaryKey().defaultRandom(),
    /** First day of the month. */
    month: date({ mode: "string" }).notNull(),
    version: integer().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    createdByUserId: uuid().references(() => user.id),
    data: jsonb().notNull(),
  },
  (table) => [
    uniqueIndex().on(table.month, table.version),
    check(
      "period_export_month_start",
      sql`extract(day from ${table.month}) = 1`,
    ),
  ],
);

/** Every sent reminder (worker, manual „Připomenout“), so nothing is sent twice. */
export const reminderLog = timesheetsSchema.table(
  "reminder_log",
  {
    id: uuid().primaryKey().defaultRandom(),
    employeeId: uuid()
      .notNull()
      .references(() => employee.id),
    /** Reminder kind, e.g. missing_day, confirm_month, approve, close. */
    kind: text().notNull(),
    /** The day or month the reminder is about. */
    refDate: date({ mode: "string" }).notNull(),
    sentAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex().on(table.employeeId, table.kind, table.refDate)],
);

/**
 * E-mail events written with the change that causes them (returned timesheet, reopened month); the
 * worker (4.5) sends them and fills sent_at. Nothing is sent from a server action.
 */
export const notification = timesheetsSchema.table(
  "notification",
  {
    id: uuid().primaryKey().defaultRandom(),
    /** Recipient. */
    employeeId: uuid()
      .notNull()
      .references(() => employee.id),
    /** Event kind: timesheet_returned, timesheet_reopened. */
    kind: text().notNull(),
    /** First day of the month the event is about. */
    month: date({ mode: "string" }).notNull(),
    /** Values for the e-mail text, e.g. the reason. */
    data: jsonb().notNull(),
    createdByUserId: uuid().references(() => user.id),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp({ withTimezone: true }),
  },
  (table) => [index().on(table.sentAt)],
);

/** Yearly leave entitlement in hours. Balance = entitled + carried over − taken. */
export const leaveEntitlement = timesheetsSchema.table(
  "leave_entitlement",
  {
    id: uuid().primaryKey().defaultRandom(),
    employeeId: uuid()
      .notNull()
      .references(() => employee.id),
    year: integer().notNull(),
    hoursEntitled: numeric({ precision: 6, scale: 1, mode: "number" })
      .notNull()
      .default(0),
    hoursCarriedOver: numeric({ precision: 6, scale: 1, mode: "number" })
      .notNull()
      .default(0),
    ...timestamps,
  },
  (table) => [
    uniqueIndex().on(table.employeeId, table.year),
    index().on(table.year),
  ],
);
