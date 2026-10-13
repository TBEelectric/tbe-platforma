import {
  index,
  integer,
  numeric,
  pgSchema,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
// Cross-module foreign key: schema files may import other modules' schema.ts directly.
import { employee } from "../core/schema";

/** Postgres schema for the timesheets module. */
export const timesheetsSchema = pgSchema("timesheets");

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

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
