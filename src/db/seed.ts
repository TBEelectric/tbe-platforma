// Sample data for local development (pnpm db:seed), matching the screen references and the
// import template (same personal numbers, so importing the template updates these records).
// Safe to run repeatedly: existing records are left as they are.
import { eq } from "drizzle-orm";
import { writeAudit } from "@/lib/audit";
import { closeDb, db, type DbOrTx } from "@/lib/db";
import { ensureAdmin, syncPublicHolidays } from "@/modules/core";
import {
  customer,
  employee,
  employment,
  job,
  team,
  teamMember,
} from "@/modules/core/schema";
import { leaveEntitlement } from "@/modules/timesheets/schema";

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
    customer: "Strojírny Vysočina s.r.o.",
    ico: "12345678",
  },
  {
    code: "250162",
    name: "Elektroinstalace kanceláře",
    customer: "Kancelářský dům Na Poříčí a.s.",
    ico: "23456789",
  },
  {
    code: "250201",
    name: "Servis technologie",
    customer: "Pekárna Zlatý klas s.r.o.",
    ico: "34567890",
  },
];

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
    const [foundJob] = await tx.select().from(job).where(eq(job.code, j.code));
    await upsertAudited(
      tx,
      "job",
      foundJob,
      async () =>
        (
          await tx
            .insert(job)
            .values({ code: j.code, name: j.name, customerId })
            .returning()
        )[0],
    );
  }
}

async function main() {
  const holidays = await syncPublicHolidays(db, YEAR - 1, YEAR + 5);
  await db.transaction(async (tx) => {
    await seedPeople(tx);
    await seedJobs(tx);
  });
  await ensureAdmin(db, {
    email: "marketing@tbeelectric.cz",
    firstName: "Marketing",
    lastName: "TBE",
    personalNumber: "A001",
    tracksTime: false,
  });
  console.log(`Seed done (${holidays} public holidays added).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeDb);
