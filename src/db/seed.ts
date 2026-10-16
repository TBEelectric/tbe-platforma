// Sample data for local development (pnpm db:seed), matching the screen references and the
// import template (same personal numbers, so importing the template updates these records).
// Safe to run repeatedly: existing records are left as they are.
import { and, eq, gte, inArray, lt, lte } from "drizzle-orm";
import { writeAudit } from "@/lib/audit";
import {
  addDays,
  isWeekend,
  monthStart,
  pragueInstant,
  todayInPrague,
} from "@/lib/dates";
import { closeDb, db, type DbOrTx } from "@/lib/db";
import { ensureAdmin, syncPublicHolidays } from "@/modules/core";
import {
  customer,
  publicHoliday,
  employee,
  employment,
  job,
  site,
  team,
  teamMember,
} from "@/modules/core/schema";
import {
  absence,
  leaveEntitlement,
  standby,
  timeEntry,
  timesheet,
  timesheetSettings,
  workType,
} from "@/modules/timesheets/schema";

const YEAR = new Date().getFullYear();

type SeedEmployee = {
  personalNumber: string;
  firstName: string;
  lastName: string;
  email: string | null;
  type: "hpp" | "dpp" | "dpc";
  weeklyHours: number | null;
  scheduleType: "flexible" | "uneven";
  validFrom: string;
  team: string;
  lead?: boolean;
  leaveHours: number;
  carriedOver: number;
};

const employees: SeedEmployee[] = [
  {
    personalNumber: "1001",
    firstName: "Jan",
    lastName: "Novák",
    email: "jan.novak@example.cz",
    type: "hpp",
    weeklyHours: 40,
    scheduleType: "flexible",
    validFrom: "2019-03-01",
    team: "Montáže 1",
    lead: true,
    leaveHours: 160,
    carriedOver: 24,
  },
  {
    personalNumber: "1002",
    firstName: "Petr",
    lastName: "Svoboda",
    email: "petr.svoboda@example.cz",
    type: "hpp",
    weeklyHours: 40,
    scheduleType: "uneven",
    validFrom: "2020-06-15",
    team: "Montáže 1",
    leaveHours: 160,
    carriedOver: 8,
  },
  {
    personalNumber: "1003",
    firstName: "Martin",
    lastName: "Dvořák",
    email: "martin.dvorak@example.cz",
    type: "hpp",
    weeklyHours: 40,
    scheduleType: "uneven",
    validFrom: "2021-02-01",
    team: "Montáže 1",
    leaveHours: 160,
    carriedOver: 0,
  },
  {
    personalNumber: "1004",
    firstName: "Tomáš",
    lastName: "Král",
    email: "tomas.kral@example.cz",
    type: "hpp",
    weeklyHours: 40,
    scheduleType: "uneven",
    validFrom: "2022-09-01",
    team: "Montáže 1",
    leaveHours: 160,
    carriedOver: 16,
  },
  {
    personalNumber: "1005",
    firstName: "Lukáš",
    lastName: "Beneš",
    email: null,
    type: "dpp",
    weeklyHours: null,
    scheduleType: "flexible",
    validFrom: "2026-04-01",
    team: "Montáže 1",
    leaveHours: 0,
    carriedOver: 0,
  },
  {
    personalNumber: "1006",
    firstName: "Ondřej",
    lastName: "Marek",
    email: "ondrej.marek@example.cz",
    type: "hpp",
    weeklyHours: 40,
    scheduleType: "uneven",
    validFrom: "2018-01-01",
    team: "Montáže 1",
    leaveHours: 200,
    carriedOver: 40,
  },
  {
    personalNumber: "1007",
    firstName: "Pavel",
    lastName: "Horák",
    email: "pavel.horak@example.cz",
    type: "hpp",
    weeklyHours: 40,
    scheduleType: "flexible",
    validFrom: "2017-05-01",
    team: "Montáže 2",
    lead: true,
    leaveHours: 200,
    carriedOver: 12,
  },
];

const jobs = [
  {
    code: "250147",
    name: "Rozvaděče hala A",
    site: "Jihlava, hala A",
    siteAddress: "Průmyslová 12, Jihlava",
    customer: "Strojírny Vysočina s.r.o.",
    ico: "12345678",
  },
  {
    code: "250162",
    name: "Elektroinstalace kanceláře",
    site: "Praha 1, Na Poříčí 12",
    siteAddress: "Na Poříčí 12, Praha 1",
    customer: "Kancelářský dům Na Poříčí a.s.",
    ico: "23456789",
  },
  {
    code: "250201",
    name: "Servis technologie",
    site: "Kolín, pekárna",
    siteAddress: "Pražská 40, Kolín",
    customer: "Pekárna Zlatý klas s.r.o.",
    ico: "34567890",
  },
];

const workTypes = [
  { code: "montaz", name: "Montáž", requiresJob: true, sortOrder: 10 },
  { code: "revize", name: "Revize", requiresJob: true, sortOrder: 20 },
  { code: "cesta", name: "Cesta", requiresJob: true, sortOrder: 30 },
  { code: "rezie", name: "Režie", requiresJob: false, sortOrder: 40 },
];

/** Default thresholds (see docs/technicky-navrh.md); minutes unless the key says otherwise. */
const SETTINGS_VALID_FROM = "2020-01-01";
const settings: Record<string, unknown> = {
  night_start: "22:00",
  night_end: "06:00",
  break_after_work_minutes: 360,
  break_min_minutes: 30,
  break_part_min_minutes: 15,
  daily_work_warning_minutes: 720,
  daily_rest_minutes: 660,
  weekly_rest_minutes: 2100,
  dpp_yearly_limit_hours: 300,
  dpc_weekly_average_limit_hours: 20,
  // Deadlines: day of the following month; reminders are sent at reminder_time (Prague).
  confirm_deadline_day: 2,
  approve_deadline_day: 5,
  close_deadline_day: 7,
  reminder_time: "07:00",
  // A day without a record is reminded this many working days later.
  missing_day_reminder_delay_days: 1,
  // Company "obvyklý den" (docs/design.md): used when an employee has no template of their own.
  default_day_template: [
    { from: "07:00", to: "11:30", kind: "work" },
    { from: "11:30", to: "12:00", kind: "break" },
    { from: "12:00", to: "15:30", kind: "work" },
  ],
};

/** Inserts a row unless one with the same unique key exists; audits new rows. Returns the row id. */
async function upsertAudited<T extends { id: string }>(
  tx: DbOrTx,
  entity: string,
  existing: T | undefined,
  insert: () => Promise<T>,
): Promise<string> {
  if (existing) return existing.id;
  const row = await insert();
  await writeAudit(tx, {
    actorUserId: null,
    entity,
    entityId: row.id,
    action: "create",
    before: null,
    after: row,
  });
  return row.id;
}

async function seedPeople(tx: DbOrTx) {
  const teamIds = new Map<string, string>();
  for (const name of new Set(employees.map((e) => e.team))) {
    const [found] = await tx.select().from(team).where(eq(team.name, name));
    teamIds.set(
      name,
      await upsertAudited(
        tx,
        "team",
        found,
        async () => (await tx.insert(team).values({ name }).returning())[0],
      ),
    );
  }

  for (const e of employees) {
    const [found] = await tx
      .select()
      .from(employee)
      .where(eq(employee.personalNumber, e.personalNumber));
    if (found) continue;
    const [emp] = await tx
      .insert(employee)
      .values({
        personalNumber: e.personalNumber,
        firstName: e.firstName,
        lastName: e.lastName,
        email: e.email,
      })
      .returning();
    const [emt] = await tx
      .insert(employment)
      .values({
        employeeId: emp.id,
        type: e.type,
        validFrom: e.validFrom,
        weeklyHours: e.weeklyHours,
        scheduleType: e.scheduleType,
      })
      .returning();
    const [member] = await tx
      .insert(teamMember)
      .values({
        teamId: teamIds.get(e.team)!,
        employeeId: emp.id,
        validFrom: e.validFrom,
      })
      .returning();
    const [leave] = await tx
      .insert(leaveEntitlement)
      .values({
        employeeId: emp.id,
        year: YEAR,
        hoursEntitled: e.leaveHours,
        hoursCarriedOver: e.carriedOver,
      })
      .returning();
    for (const [entity, row] of [
      ["employee", emp],
      ["employment", emt],
      ["team_member", member],
      ["leave_entitlement", leave],
    ] as const) {
      await writeAudit(tx, {
        actorUserId: null,
        entity,
        entityId: row.id,
        action: "create",
        before: null,
        after: row,
      });
    }
    if (e.lead) {
      const [before] = await tx
        .select()
        .from(team)
        .where(eq(team.id, teamIds.get(e.team)!));
      const [after] = await tx
        .update(team)
        .set({ leadEmployeeId: emp.id })
        .where(eq(team.id, before.id))
        .returning();
      await writeAudit(tx, {
        actorUserId: null,
        entity: "team",
        entityId: after.id,
        action: "update",
        before,
        after,
      });
    }
  }
}

async function seedJobs(tx: DbOrTx) {
  for (const j of jobs) {
    const [foundCustomer] = await tx
      .select()
      .from(customer)
      .where(eq(customer.ico, j.ico));
    const customerId = await upsertAudited(
      tx,
      "customer",
      foundCustomer,
      async () =>
        (
          await tx
            .insert(customer)
            .values({ name: j.customer, ico: j.ico })
            .returning()
        )[0],
    );
    const [foundSite] = await tx
      .select()
      .from(site)
      .where(and(eq(site.customerId, customerId), eq(site.name, j.site)));
    const siteId = await upsertAudited(
      tx,
      "site",
      foundSite,
      async () =>
        (
          await tx
            .insert(site)
            .values({
              name: j.site,
              address: j.siteAddress,
              type: "construction",
              customerId,
            })
            .returning()
        )[0],
    );
    const [foundJob] = await tx.select().from(job).where(eq(job.code, j.code));
    await upsertAudited(
      tx,
      "job",
      foundJob,
      async () =>
        (
          await tx
            .insert(job)
            .values({ code: j.code, name: j.name, customerId, siteId })
            .returning()
        )[0],
    );
    // Jobs seeded before job.site_id got a placeholder site from the migration.
    if (foundJob && foundJob.siteId !== siteId) {
      const [after] = await tx
        .update(job)
        .set({ siteId })
        .where(eq(job.id, foundJob.id))
        .returning();
      await writeAudit(tx, {
        actorUserId: null,
        entity: "job",
        entityId: after.id,
        action: "update",
        before: foundJob,
        after,
      });
    }
  }
}

async function seedTimesheetCatalogues(tx: DbOrTx) {
  for (const w of workTypes) {
    const [found] = await tx
      .select()
      .from(workType)
      .where(eq(workType.code, w.code));
    await upsertAudited(
      tx,
      "work_type",
      found,
      async () => (await tx.insert(workType).values(w).returning())[0],
    );
  }
  for (const [key, value] of Object.entries(settings)) {
    const [found] = await tx
      .select()
      .from(timesheetSettings)
      .where(
        and(
          eq(timesheetSettings.key, key),
          eq(timesheetSettings.validFrom, SETTINGS_VALID_FROM),
        ),
      );
    await upsertAudited(
      tx,
      "timesheet_settings",
      found,
      async () =>
        (
          await tx
            .insert(timesheetSettings)
            .values({ key, value, validFrom: SETTINGS_VALID_FROM })
            .returning()
        )[0],
    );
  }
}

// ── Time entries of the current month ──

type Slot = [
  from: string,
  to: string,
  job: string | null,
  workType: string | null,
  note?: string,
];

/** Day patterns; null work type = break. Pattern 0 is the day from the screen reference. */
const DAY_PATTERNS: Slot[][] = [
  [
    ["06:30", "08:15", "250147", "montaz"],
    ["08:15", "08:30", null, null],
    ["08:30", "11:00", "250162", "montaz", "Zapojení"],
    ["11:00", "11:15", null, null],
    ["11:15", "12:00", "250147", "cesta", "Přejezd na halu"],
    ["12:00", "15:15", "250147", "montaz", "Dokončení montáže"],
  ],
  [
    ["07:00", "10:00", "250147", "montaz"],
    ["10:00", "10:30", null, null],
    ["10:30", "15:30", "250147", "montaz"],
  ],
  [
    ["06:00", "07:00", "250201", "cesta"],
    ["07:00", "11:30", "250201", "revize"],
    ["11:30", "12:00", null, null],
    ["12:00", "14:30", "250201", "revize", "Protokoly"],
    ["14:30", "15:30", null, "rezie", "Sklad"],
  ],
];

/** The working day before `date` (skips weekends and public holidays). */
function previousWorkday(date: string, holidays: Set<string>): string {
  let day = addDays(date, -1);
  while (isWeekend(day) || holidays.has(day)) day = addDays(day, -1);
  return day;
}

/**
 * Entries for the seed employees on working days from the 1st of the current month to today.
 * Replaces their entries of this month on every run (open months only). Jan Novák has today as in
 * the screen reference and the previous working day empty (shown as missing).
 */
async function seedMonthEntries(tx: DbOrTx) {
  const today = todayInPrague();
  const month = monthStart(today);
  const holidays = new Set(
    (
      await tx
        .select({ date: publicHoliday.date })
        .from(publicHoliday)
        .where(gte(publicHoliday.date, month))
    ).map((h) => h.date),
  );
  const jobIds = new Map(
    (await tx.select().from(job)).map((j) => [j.code, j.id] as const),
  );
  const workTypeIds = new Map(
    (await tx.select().from(workType)).map((w) => [w.code, w.id] as const),
  );
  const people = await tx
    .select()
    .from(employee)
    .where(
      inArray(
        employee.personalNumber,
        employees.map((e) => e.personalNumber),
      ),
    );
  const janEmptyDay = previousWorkday(today, holidays);

  let count = 0;
  for (const [index, seedEmployee] of employees.entries()) {
    const emp = people.find(
      (p) => p.personalNumber === seedEmployee.personalNumber,
    );
    if (!emp) continue;
    const [sheet] = await tx
      .select()
      .from(timesheet)
      .where(and(eq(timesheet.employeeId, emp.id), eq(timesheet.month, month)));
    if (sheet && sheet.status !== "open") continue;

    const old = await tx
      .delete(timeEntry)
      .where(
        and(
          eq(timeEntry.employeeId, emp.id),
          gte(timeEntry.workDate, month),
          lte(timeEntry.workDate, addDays(monthStart(addDays(month, 31)), -1)),
        ),
      )
      .returning();
    for (const row of old)
      await writeAudit(tx, {
        actorUserId: null,
        entity: "time_entry",
        entityId: row.id,
        action: "delete",
        before: row,
        after: null,
        reason: "Seed: nová ukázková data",
      });

    const absences = await tx
      .select()
      .from(absence)
      .where(eq(absence.employeeId, emp.id));
    for (
      let day = month, dayIndex = 0;
      day <= today;
      day = addDays(day, 1), dayIndex++
    ) {
      if (isWeekend(day) || holidays.has(day)) continue;
      if (seedEmployee.personalNumber === "1001" && day === janEmptyDay)
        continue;
      // DPP works only on Tuesdays and Thursdays.
      const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
      if (seedEmployee.type === "dpp" && weekday !== 2 && weekday !== 4)
        continue;
      if (
        absences.some(
          (a) =>
            a.status !== "rejected" &&
            !a.archivedAt &&
            a.dateFrom <= day &&
            day <= a.dateTo,
        )
      )
        continue;
      const pattern =
        seedEmployee.personalNumber === "1001" && day === today
          ? DAY_PATTERNS[0]
          : DAY_PATTERNS[(dayIndex + index) % DAY_PATTERNS.length];
      for (const [from, to, jobCode, workTypeCode, note] of pattern) {
        const [row] = await tx
          .insert(timeEntry)
          .values({
            employeeId: emp.id,
            workDate: day,
            startAt: pragueInstant(day, from)!,
            endAt: pragueInstant(day, to)!,
            kind: workTypeCode ? "work" : "break",
            jobId: jobCode ? jobIds.get(jobCode)! : null,
            workTypeId: workTypeCode ? workTypeIds.get(workTypeCode)! : null,
            note: note ?? null,
          })
          .returning();
        await writeAudit(tx, {
          actorUserId: null,
          entity: "time_entry",
          entityId: row.id,
          action: "create",
          before: null,
          after: row,
        });
        count++;
      }
    }
  }
  return count;
}

/** One approved vacation this month (Petr Svoboda) and one pending request next month (Martin Dvořák). */
async function seedAbsences(tx: DbOrTx) {
  const today = todayInPrague();
  const month = monthStart(today);
  const nextMonth = monthStart(addDays(month, 31));
  const samples = [
    {
      personalNumber: "1002",
      type: "vacation" as const,
      dateFrom: addDays(month, 7),
      dateTo: addDays(month, 8),
      status: "approved" as const,
      note: "Rodinná akce",
    },
    {
      personalNumber: "1003",
      type: "vacation" as const,
      dateFrom: addDays(nextMonth, 9),
      dateTo: addDays(nextMonth, 13),
      status: "requested" as const,
      note: null,
    },
  ];
  for (const sample of samples) {
    const [emp] = await tx
      .select()
      .from(employee)
      .where(eq(employee.personalNumber, sample.personalNumber));
    if (!emp) continue;
    const [found] = await tx
      .select()
      .from(absence)
      .where(
        and(
          eq(absence.employeeId, emp.id),
          eq(absence.dateFrom, sample.dateFrom),
        ),
      );
    await upsertAudited(
      tx,
      "absence",
      found,
      async () =>
        (
          await tx
            .insert(absence)
            .values({
              employeeId: emp.id,
              type: sample.type,
              dateFrom: sample.dateFrom,
              dateTo: sample.dateTo,
              status: sample.status,
              note: sample.note,
              decidedAt: sample.status === "approved" ? new Date() : null,
            })
            .returning()
        )[0],
    );
  }
}

/**
 * Weekend standby (Sat 6:00 – Sun 22:00) for Jan Novák and Petr Svoboda on the last weekend of this
 * month up to today (else the first one). Jan had a call-out on Saturday during it, marked as
 * overtime. Replaces their standby of this month on every run (open months only).
 */
async function seedStandby(tx: DbOrTx) {
  const today = todayInPrague();
  const month = monthStart(today);
  const nextMonth = monthStart(addDays(month, 31));
  const saturdays: string[] = [];
  for (let day = month; day < nextMonth; day = addDays(day, 1))
    if (new Date(`${day}T12:00:00Z`).getUTCDay() === 6) saturdays.push(day);
  const saturday =
    saturdays.filter((d) => addDays(d, 1) <= today).at(-1) ?? saturdays[0];
  const [jobRow] = await tx.select().from(job).where(eq(job.code, "250147"));
  const [montaz] = await tx
    .select()
    .from(workType)
    .where(eq(workType.code, "montaz"));

  let count = 0;
  for (const personalNumber of ["1001", "1002"]) {
    const [emp] = await tx
      .select()
      .from(employee)
      .where(eq(employee.personalNumber, personalNumber));
    if (!emp) continue;
    const [sheet] = await tx
      .select()
      .from(timesheet)
      .where(and(eq(timesheet.employeeId, emp.id), eq(timesheet.month, month)));
    if (sheet && sheet.status !== "open") continue;

    const old = await tx
      .delete(standby)
      .where(
        and(
          eq(standby.employeeId, emp.id),
          gte(standby.startAt, pragueInstant(month, "00:00")!),
          lt(standby.startAt, pragueInstant(nextMonth, "00:00")!),
        ),
      )
      .returning();
    for (const row of old)
      await writeAudit(tx, {
        actorUserId: null,
        entity: "standby",
        entityId: row.id,
        action: "delete",
        before: row,
        after: null,
        reason: "Seed: nová ukázková data",
      });
    const [row] = await tx
      .insert(standby)
      .values({
        employeeId: emp.id,
        startAt: pragueInstant(saturday, "06:00")!,
        endAt: pragueInstant(addDays(saturday, 1), "22:00")!,
        note: "Pohotovost o víkendu",
      })
      .returning();
    await writeAudit(tx, {
      actorUserId: null,
      entity: "standby",
      entityId: row.id,
      action: "create",
      before: null,
      after: row,
    });
    count++;

    // Call-out during standby (work during standby), marked as overtime.
    if (personalNumber === "1001" && saturday <= today && jobRow && montaz) {
      const [entry] = await tx
        .insert(timeEntry)
        .values({
          employeeId: emp.id,
          workDate: saturday,
          startAt: pragueInstant(saturday, "09:00")!,
          endAt: pragueInstant(saturday, "11:30")!,
          kind: "work",
          jobId: jobRow.id,
          workTypeId: montaz.id,
          note: "Výjezd k poruše",
          overtime: true,
        })
        .returning();
      await writeAudit(tx, {
        actorUserId: null,
        entity: "time_entry",
        entityId: entry.id,
        action: "create",
        before: null,
        after: entry,
      });
    }
  }
  return count;
}

async function main() {
  const holidays = await syncPublicHolidays(db, YEAR - 1, YEAR + 5);
  await db.transaction(async (tx) => {
    await seedPeople(tx);
    await seedJobs(tx);
    await seedTimesheetCatalogues(tx);
  });
  // Absences first: days with an absence get no entries.
  await db.transaction(seedAbsences);
  const entries = await db.transaction(seedMonthEntries);
  // After the entries: they are replaced on every run, the call-out during standby with them.
  const standbys = await db.transaction(seedStandby);
  await ensureAdmin(db, {
    email: "marketing@tbeelectric.cz",
    firstName: "Marketing",
    lastName: "TBE",
    personalNumber: "A001",
    tracksTime: false,
  });
  console.log(
    `Seed done (${holidays} public holidays added, ${entries} time entries and ${standbys} standbys this month).`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeDb);
