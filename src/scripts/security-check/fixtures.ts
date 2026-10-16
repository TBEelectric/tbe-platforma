import { randomBytes } from "node:crypto";
import { and, eq, gte, lte } from "drizzle-orm";
import {
  addDays,
  isWeekend,
  monthStart,
  pragueInstant,
  todayInPrague,
} from "@/lib/dates";
import { db } from "@/lib/db";
import {
  customer,
  employee,
  employment,
  job,
  publicHoliday,
  roleAssignment,
  session,
  site,
  team,
  teamJob,
  teamMember,
  user,
} from "@/modules/core/schema";
import {
  absence,
  dayTemplate,
  leaveEntitlement,
  standby,
  timeEntry,
  timesheet,
  timesheetSettings,
  workType,
} from "@/modules/timesheets/schema";
import { sessionCookie } from "./http";

// Test data of the check, on top of the seed in the check database. Every name carries a marker
// ("SecchkEb", "secchk-note-eb"), so a page that leaks someone's data is found by searching the HTML.

/**
 * People of the check. ea, ec: employees of team A; eb: of team B; la, lb: leads of A and B; mg:
 * timesheets manager (no team); ad: administrator only; ar, de: archived / deactivated during the
 * session checks; rm: manager who loses the role; ax, ay: archived and deactivated administrators.
 */
const PEOPLE = {
  ea: { team: "a" },
  ec: { team: "a" },
  eb: { team: "b" },
  la: { team: "a", leads: "a" },
  lb: { team: "b", leads: "b" },
  mg: { role: "manager" },
  ad: { role: "admin" },
  ar: { team: "a" },
  de: { team: "a" },
  rm: { role: "manager" },
  ax: { role: "admin", archived: true },
  ay: { role: "admin", inactive: true },
} as const satisfies Record<
  string,
  {
    team?: "a" | "b";
    leads?: "a" | "b";
    role?: "manager" | "admin";
    archived?: boolean;
    inactive?: boolean;
  }
>;

export type Person = keyof typeof PEOPLE;
export const PERSON_CODES = Object.keys(PEOPLE) as Person[];

/** Visible marker of a person (last name). */
export const nameMark = (p: Person) => `Secchk${p[0].toUpperCase()}${p[1]}`;
export const noteMark = (p: Person) => `secchk-note-${p}`;
export const absenceMark = (p: Person) => `secchk-abs-${p}`;
export const standbyMark = (p: Person) => `secchk-sb-${p}`;

/** A past month before every seed employment, closed by the manager in the check. */
export const CLOSED_MONTH = "2016-01-01";
const EMPLOYMENT_FROM = "2016-01-01";

function monthDays(month: string): string[] {
  const days: string[] = [];
  for (let d = month; monthStart(d) === month; d = addDays(d, 1)) days.push(d);
  return days;
}

const at = (date: string, time: string) => pragueInstant(date, time)!;

export async function createFixtures(secret: string) {
  const today = todayInPrague();
  /** Open month (previous month: past days, may be confirmed now). */
  const p1 = monthStart(addDays(monthStart(today), -1));
  /** Month with confirmed / approved timesheets. */
  const p2 = monthStart(addDays(p1, -1));
  const holidays = new Set(
    (
      await db
        .select({ date: publicHoliday.date })
        .from(publicHoliday)
        .where(and(gte(publicHoliday.date, p2), lte(publicHoliday.date, today)))
    ).map((h) => h.date),
  );
  const workdays = (month: string) =>
    monthDays(month).filter((d) => !isWeekend(d) && !holidays.has(d));
  const days = workdays(p1);
  const daysP2 = workdays(p2);

  // The seed's settings start in 2020; the closed month of the check needs them too.
  const settings = await db.select().from(timesheetSettings);
  const earliest = new Map<string, (typeof settings)[number]>();
  for (const s of settings)
    if (!earliest.has(s.key) || s.validFrom < earliest.get(s.key)!.validFrom)
      earliest.set(s.key, s);
  await db.insert(timesheetSettings).values(
    [...earliest.values()].map((s) => ({
      key: s.key,
      value: s.value,
      validFrom: "2015-01-01",
    })),
  );

  const [jobType] = await db
    .select()
    .from(workType)
    .where(and(eq(workType.requiresJob, true), eq(workType.code, "montaz")));
  const [noJobType] = await db
    .select()
    .from(workType)
    .where(eq(workType.requiresJob, false));

  const [cust] = await db
    .insert(customer)
    .values({ name: "Secchk zákazník" })
    .returning();
  const [place] = await db
    .insert(site)
    .values({ name: "Secchk místo", type: "construction", customerId: cust.id })
    .returning();
  const [job1, job2] = await db
    .insert(job)
    .values([
      {
        code: "SECCHK-1",
        name: "Secchk zakázka",
        customerId: cust.id,
        siteId: place.id,
      },
      {
        code: "SECCHK-2",
        name: "Secchk druhá",
        customerId: cust.id,
        siteId: place.id,
      },
    ])
    .returning();

  // ── People ──
  const ids = {} as Record<Person, string>;
  for (const code of PERSON_CODES) {
    const p: (typeof PEOPLE)[Person] = PEOPLE[code];
    const tracks = !("archived" in p) && !("inactive" in p);
    const [row] = await db
      .insert(employee)
      .values({
        personalNumber: `S-${code}`,
        firstName: "Secchk",
        lastName: nameMark(code),
        email: `secchk-${code}@example.invalid`,
        tracksTime: tracks,
        active: !("inactive" in p) && !("archived" in p),
        archivedAt: "archived" in p ? new Date() : null,
      })
      .returning();
    ids[code] = row.id;
    if (tracks)
      await db.insert(employment).values({
        employeeId: row.id,
        type: "hpp",
        validFrom: EMPLOYMENT_FROM,
        weeklyHours: 40,
        scheduleType: "flexible",
      });
    if ("role" in p)
      await db
        .insert(roleAssignment)
        .values(
          p.role === "admin"
            ? { employeeId: row.id, module: "*", role: "admin" }
            : { employeeId: row.id, module: "timesheets", role: "manager" },
        );
  }
  const [teamA, teamB] = await db
    .insert(team)
    .values([
      { name: "Secchk A", leadEmployeeId: ids.la },
      { name: "Secchk B", leadEmployeeId: ids.lb },
    ])
    .returning();
  const teams = { a: teamA.id, b: teamB.id };
  for (const code of PERSON_CODES) {
    const p: (typeof PEOPLE)[Person] = PEOPLE[code];
    if ("team" in p)
      await db.insert(teamMember).values({
        teamId: teams[p.team],
        employeeId: ids[code],
        validFrom: EMPLOYMENT_FROM,
      });
  }
  await db.insert(teamJob).values({ teamId: teams.b, jobId: job1.id });

  // ── Sign-in: a Better Auth user and session per person, as after a Google sign-in ──
  const cookies = {} as Record<Person, string>;
  const userIds = {} as Record<Person, string>;
  for (const code of PERSON_CODES) {
    const [u] = await db
      .insert(user)
      .values({
        name: `Secchk ${nameMark(code)}`,
        email: `secchk-${code}@example.invalid`,
        emailVerified: true,
        employeeId: ids[code],
      })
      .returning();
    userIds[code] = u.id;
    cookies[code] = await newSession(u.id, secret);
  }

  // ── Closed month: every working day filled and approved, closed later by the manager ──
  const tracking = PERSON_CODES.filter(
    (c) => !("archived" in PEOPLE[c]) && !("inactive" in PEOPLE[c]),
  );
  const closedDays = monthDays(CLOSED_MONTH).filter((d) => !isWeekend(d));
  for (const code of tracking) {
    await db
      .insert(timeEntry)
      .values(
        closedDays.flatMap((d) => [
          work(ids[code], d, "06:00", "10:00"),
          work(ids[code], d, "10:30", "14:30"),
        ]),
      );
    await db.insert(timesheet).values({
      employeeId: ids[code],
      month: CLOSED_MONTH,
      status: "approved",
      confirmedAt: new Date(),
      approvedAt: new Date(),
    });
  }

  function work(
    employeeId: string,
    date: string,
    from: string,
    to: string,
    note?: string,
  ) {
    return {
      employeeId,
      workDate: date,
      startAt: at(date, from),
      endAt: at(date, to),
      kind: "work" as const,
      jobId: job1.id,
      workTypeId: jobType.id,
      note: note ?? null,
    };
  }

  // ── Open month p1: marked entries, absence requests, standby ──
  const d1 = days[1];
  const entries = {} as Record<Person, string>;
  for (const code of ["ea", "ec", "eb", "la", "lb", "mg"] as const) {
    const [row] = await db
      .insert(timeEntry)
      .values(work(ids[code], d1, "06:00", "07:00", noteMark(code)))
      .returning();
    entries[code] = row.id;
  }
  const absences = {} as Record<"eb" | "ec" | "la" | "ea", string>;
  for (const [code, day] of [
    ["eb", days[5]],
    ["ec", days[6]],
    ["la", days[7]],
    ["ea", days[8]],
  ] as const) {
    const [row] = await db
      .insert(absence)
      .values({
        employeeId: ids[code],
        type: "vacation",
        dateFrom: day,
        dateTo: day,
        note: absenceMark(code),
      })
      .returning();
    absences[code] = row.id;
  }
  const standbys = {} as Record<"eb" | "ec", string>;
  for (const [code, to] of [
    ["eb", "22:00"],
    ["ec", "20:00"],
  ] as const) {
    const [row] = await db
      .insert(standby)
      .values({
        employeeId: ids[code],
        startAt: at(d1, "18:00"),
        endAt: at(d1, to),
        note: standbyMark(code),
      })
      .returning();
    standbys[code] = row.id;
  }

  // ── Month p2: confirmed (ea, eb, la) and approved (ec) timesheets, one entry each ──
  const lockedEntries = {} as Record<"ea" | "eb" | "ec" | "la", string>;
  for (const [code, status] of [
    ["ea", "confirmed"],
    ["eb", "confirmed"],
    ["la", "confirmed"],
    ["ec", "approved"],
  ] as const) {
    const [row] = await db
      .insert(timeEntry)
      .values(work(ids[code], daysP2[1], "06:00", "07:00", noteMark(code)))
      .returning();
    lockedEntries[code] = row.id;
    await db.insert(timesheet).values({
      employeeId: ids[code],
      month: p2,
      status,
      confirmedAt: new Date(),
      approvedAt: status === "approved" ? new Date() : null,
    });
  }

  await db.insert(dayTemplate).values({
    employeeId: ids.eb,
    items: [{ from: "07:00", to: "15:00", kind: "work" }],
  });
  await db.insert(leaveEntitlement).values({
    employeeId: ids.ec,
    year: Number(today.slice(0, 4)),
    hoursEntitled: 160,
    hoursCarriedOver: 0,
  });
  const [employmentEc] = await db
    .select({ id: employment.id })
    .from(employment)
    .where(eq(employment.employeeId, ids.ec));

  return {
    today,
    p1,
    p2,
    days,
    daysP2,
    ids,
    userIds,
    cookies,
    teams,
    jobs: { j1: job1.id, j2: job2.id },
    customerId: cust.id,
    siteId: place.id,
    workTypes: { job: jobType.id, noJob: noJobType.id },
    entries,
    lockedEntries,
    absences,
    standbys,
    employmentEc: employmentEc.id,
  };
}

export type Fixtures = Awaited<ReturnType<typeof createFixtures>>;

/** A new Better Auth session for a user, returned as the Cookie header value. */
export async function newSession(
  userId: string,
  secret: string,
): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  await db.insert(session).values({
    token,
    userId,
    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    userAgent: "security-check",
  });
  return sessionCookie(token, secret);
}
