import { and, eq, inArray, like, sql } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { db } from "@/lib/db";
import {
  customer,
  employee,
  employment,
  job,
  roleAssignment,
  team,
  teamJob,
  teamMember,
} from "@/modules/core/schema";
import {
  absence,
  dayTemplate,
  leaveEntitlement,
  notification,
  periodClose,
  periodExport,
  reminderLog,
  standby,
  timeEntry,
  timesheet,
  timesheetSettings,
} from "@/modules/timesheets/schema";
import {
  allowed,
  denied,
  FILES,
  formState,
  reached,
  row,
  rows,
  type Ctx,
  type Who,
} from "../context";
import { CLOSED_MONTH, noteMark, type Person } from "../fixtures";
import { form } from "../http";
import { assert } from "../report";

// Every server action for every role: spoofed ids, employees, months and bound arguments are sent
// as the browser would send them (an attacker controls all of them). Denied = no change in the
// database; each action also has an allowed control case.

const PREV = {};

export async function actionsSuite(ctx: Ctx) {
  await withoutSession(ctx);
  await coreActions(ctx);
  await timesheetActions(ctx);
  await timelineActions(ctx);
  await flowActions(ctx);
}

/** Every action refuses a request without a valid session (no cookie, or a forged one). */
async function withoutSession(ctx: Ctx) {
  ctx.report.section("Akce bez přihlášení");
  const skip = new Set([
    `${FILES.auth}#signOut`,
    `${FILES.dev}#devSignInAction`,
  ]);
  for (const ref of ctx.actions.values()) {
    if (skip.has(ref.key)) continue;
    for (const who of ["anon", "forged"] as Who[]) {
      const [file, name] = ref.key.split("#");
      const short = (Object.keys(FILES) as Array<keyof typeof FILES>).find(
        (k) => FILES[k] === file,
      )!;
      await denied(
        ctx,
        `${name} as ${who}`,
        () =>
          ctx.call(who, short, name, [
            ctx.fx.ids.ea,
            ctx.fx.p1,
            PREV,
            form({}),
          ]),
        async () => null,
        (res) =>
          assert(
            res.kind === "redirect" && res.location?.includes("/login"),
            `expected a redirect to /login, got ${res.kind} ${res.location ?? ""}`,
          ),
      );
    }
  }
}

const employeeFields = (fields: Record<string, string | boolean | null>) =>
  form({
    tracksTime: true,
    type: "hpp",
    // Not in the closed month of the check (it would block the close).
    validFrom: "2099-01-01",
    weeklyHours: "40",
    scheduleType: "flexible",
    ...fields,
  });

async function coreActions(ctx: Ctx) {
  const { fx } = ctx;
  const { ids } = fx;
  ctx.report.section("Akce jádra: zaměstnanci, party, zakázky");

  // ── createEmployeeAction ──
  const newEmployees = () =>
    rows(employee, like(employee.personalNumber, "S-new%"));
  for (const who of ["ea", "la"] as const)
    await denied(
      ctx,
      `createEmployeeAction as ${who}`,
      () =>
        ctx.call(who, "core", "createEmployeeAction", [
          PREV,
          employeeFields({
            personalNumber: `S-new-${who}`,
            firstName: "X",
            lastName: "Y",
          }),
        ]),
      newEmployees,
    );
  await denied(
    ctx,
    "createEmployeeAction as manager with a sign-in e-mail",
    () =>
      ctx.call("mg", "core", "createEmployeeAction", [
        PREV,
        employeeFields({
          personalNumber: "S-new-mg-mail",
          firstName: "X",
          lastName: "Y",
          email: "secchk-new@example.invalid",
        }),
      ]),
    newEmployees,
  );
  await allowed(
    ctx,
    "createEmployeeAction as manager",
    () =>
      ctx.call("mg", "core", "createEmployeeAction", [
        PREV,
        employeeFields({
          personalNumber: "S-new-mg",
          firstName: "Secchk",
          lastName: "Nový",
        }),
      ]),
    newEmployees,
  );

  // ── updateEmployeeAction ──
  const ec = () => row(employee, ids.ec);
  const ecFields = (over: Record<string, string>) =>
    form({
      personalNumber: "S-ec",
      firstName: "Secchk",
      lastName: "SecchkEc",
      email: "secchk-ec@example.invalid",
      tracksTime: true,
      ...over,
    });
  for (const who of ["ea", "la"] as const)
    await denied(
      ctx,
      `updateEmployeeAction(ec) as ${who}`,
      () =>
        ctx.call(who, "core", "updateEmployeeAction", [
          ids.ec,
          PREV,
          ecFields({ firstName: "Hacked" }),
        ]),
      ec,
    );
  await denied(
    ctx,
    "updateEmployeeAction: manager changes the sign-in e-mail",
    () =>
      ctx.call("mg", "core", "updateEmployeeAction", [
        ids.ec,
        PREV,
        ecFields({ email: "attacker@example.invalid" }),
      ]),
    ec,
  );
  await allowed(
    ctx,
    "updateEmployeeAction(ec) as manager",
    () =>
      ctx.call("mg", "core", "updateEmployeeAction", [
        ids.ec,
        PREV,
        ecFields({ firstName: "Secchk2" }),
      ]),
    ec,
  );

  // ── setEmployeeStateAction ──
  const state = (id: string) => () => row(employee, id);
  for (const who of ["ea", "la"] as const)
    await denied(
      ctx,
      `setEmployeeStateAction(de, deactivate) as ${who}`,
      () =>
        ctx.call(who, "core", "setEmployeeStateAction", [ids.de, "deactivate"]),
      state(ids.de),
    );
  await denied(
    ctx,
    "setEmployeeStateAction: manager deactivates an administrator",
    () =>
      ctx.call("mg", "core", "setEmployeeStateAction", [ids.ad, "deactivate"]),
    state(ids.ad),
  );
  await denied(
    ctx,
    "setEmployeeStateAction: manager archives themselves",
    () => ctx.call("mg", "core", "setEmployeeStateAction", [ids.mg, "archive"]),
    state(ids.mg),
  );
  await denied(
    ctx,
    "setEmployeeStateAction: manager restores an archived administrator",
    () => ctx.call("mg", "core", "setEmployeeStateAction", [ids.ax, "restore"]),
    state(ids.ax),
  );
  await denied(
    ctx,
    "setEmployeeStateAction: manager activates a deactivated administrator",
    () =>
      ctx.call("mg", "core", "setEmployeeStateAction", [ids.ay, "activate"]),
    state(ids.ay),
  );
  await denied(
    ctx,
    "setEmployeeStateAction: unknown change (spoofed bound argument)",
    () => ctx.call("mg", "core", "setEmployeeStateAction", [ids.de, "promote"]),
    state(ids.de),
    (res) => assert(res.kind !== "error", "server error instead of a refusal"),
  );
  await allowed(
    ctx,
    "setEmployeeStateAction(de, deactivate) as manager",
    () =>
      ctx.call("mg", "core", "setEmployeeStateAction", [ids.de, "deactivate"]),
    state(ids.de),
  );
  await allowed(
    ctx,
    "setEmployeeStateAction(ay, activate) as administrator",
    () =>
      ctx.call("ad", "core", "setEmployeeStateAction", [ids.ay, "activate"]),
    state(ids.ay),
  );
  await allowed(
    ctx,
    "setEmployeeStateAction(ax, restore) as administrator",
    () => ctx.call("ad", "core", "setEmployeeStateAction", [ids.ax, "restore"]),
    state(ids.ax),
  );

  // ── Employments, team membership ──
  const employmentFields = form({
    type: "hpp",
    validFrom: "2016-01-01",
    weeklyHours: "20",
    scheduleType: "flexible",
  });
  const ecEmployments = () =>
    rows(employment, eq(employment.employeeId, ids.ec));
  for (const who of ["ea", "la"] as const) {
    await denied(
      ctx,
      `updateEmploymentAction(ec) as ${who}`,
      () =>
        ctx.call(who, "core", "updateEmploymentAction", [
          fx.employmentEc,
          PREV,
          employmentFields,
        ]),
      ecEmployments,
    );
    await denied(
      ctx,
      `addEmploymentAction(ec) as ${who}`,
      () =>
        ctx.call(who, "core", "addEmploymentAction", [
          ids.ec,
          PREV,
          form({
            type: "hpp",
            validFrom: "2099-01-01",
            weeklyHours: "40",
            scheduleType: "flexible",
          }),
        ]),
      ecEmployments,
    );
  }
  await allowed(
    ctx,
    "updateEmploymentAction(ec) as manager",
    () =>
      ctx.call("mg", "core", "updateEmploymentAction", [
        fx.employmentEc,
        PREV,
        form({
          type: "hpp",
          validFrom: "2016-01-01",
          weeklyHours: "40",
          scheduleType: "uneven",
        }),
      ]),
    ecEmployments,
  );
  await allowed(
    ctx,
    "addEmploymentAction(ec) as manager",
    () =>
      ctx.call("mg", "core", "addEmploymentAction", [
        ids.ec,
        PREV,
        form({
          type: "hpp",
          validFrom: "2099-01-01",
          weeklyHours: "40",
          scheduleType: "flexible",
        }),
      ]),
    ecEmployments,
  );
  const memberships = (id: string) => () =>
    rows(teamMember, eq(teamMember.employeeId, id));
  for (const who of ["ea", "la"] as const)
    await denied(
      ctx,
      `changeTeamAction: ${who} moves eb into team A`,
      () =>
        ctx.call(who, "core", "changeTeamAction", [
          ids.eb,
          PREV,
          form({ teamId: fx.teams.a, validFrom: fx.today }),
        ]),
      memberships(ids.eb),
    );
  await allowed(
    ctx,
    "changeTeamAction(ar → B) as manager",
    () =>
      ctx.call("mg", "core", "changeTeamAction", [
        ids.ar,
        PREV,
        form({ teamId: fx.teams.b, validFrom: fx.today }),
      ]),
    memberships(ids.ar),
  );

  // ── Roles ──
  const roles = (id: string) => () =>
    rows(
      roleAssignment,
      sql`${roleAssignment.employeeId} = ${id} and ${roleAssignment.archivedAt} is null`,
    );
  for (const [who, target] of [
    ["mg", "mg"],
    ["la", "la"],
    ["ea", "ea"],
    ["mg", "ec"],
  ] as const)
    await denied(
      ctx,
      `setRolesAction: ${who} makes ${target} administrator`,
      () =>
        ctx.call(who, "core", "setRolesAction", [
          ids[target],
          PREV,
          form({ admin: true, timesheetsManager: true }),
        ]),
      roles(ids[target]),
    );
  await allowed(
    ctx,
    "setRolesAction(ay) as administrator",
    () =>
      ctx.call("ad", "core", "setRolesAction", [
        ids.ay,
        PREV,
        form({ admin: true, timesheetsManager: true }),
      ]),
    roles(ids.ay),
  );

  // ── Teams ──
  const teams = () => rows(team, like(team.name, "Secchk%"));
  for (const who of ["ea", "la"] as const) {
    await denied(
      ctx,
      `createTeamAction as ${who}`,
      () =>
        ctx.call(who, "core", "createTeamAction", [
          PREV,
          form({ name: `Secchk ${who}` }),
        ]),
      teams,
    );
    await denied(
      ctx,
      `updateTeamAction(B: lead = ${who}) as ${who}`,
      () =>
        ctx.call(who, "core", "updateTeamAction", [
          fx.teams.b,
          PREV,
          form({ name: "Secchk B", leadEmployeeId: ids[who] }),
        ]),
      teams,
    );
    await denied(
      ctx,
      `setTeamArchivedAction(B) as ${who}`,
      () => ctx.call(who, "core", "setTeamArchivedAction", [fx.teams.b, true]),
      teams,
    );
  }
  await denied(
    ctx,
    "updateTeamAction: lead renames own team",
    () =>
      ctx.call("la", "core", "updateTeamAction", [
        fx.teams.a,
        PREV,
        form({ name: "Secchk A2", leadEmployeeId: ids.la }),
      ]),
    teams,
  );
  await allowed(
    ctx,
    "createTeamAction as manager",
    () =>
      ctx.call("mg", "core", "createTeamAction", [
        PREV,
        form({ name: "Secchk C" }),
      ]),
    teams,
  );
  const [teamC] = await db.select().from(team).where(eq(team.name, "Secchk C"));
  await allowed(
    ctx,
    "updateTeamAction(C) as manager",
    () =>
      ctx.call("mg", "core", "updateTeamAction", [
        teamC?.id ?? ids.ea,
        PREV,
        form({ name: "Secchk C2" }),
      ]),
    teams,
  );
  await allowed(
    ctx,
    "setTeamArchivedAction(C) as manager",
    () =>
      ctx.call("mg", "core", "setTeamArchivedAction", [
        teamC?.id ?? ids.ea,
        true,
      ]),
    teams,
  );

  // ── Zakázky party (core actions on the team detail) ──
  const pins = (teamId: string) => () =>
    rows(teamJob, eq(teamJob.teamId, teamId));
  for (const who of ["ea", "la"] as const)
    await denied(
      ctx,
      `pinTeamJobAction(B) as ${who}`,
      () =>
        ctx.call(who, "core", "pinTeamJobAction", [
          fx.teams.b,
          PREV,
          form({ jobId: fx.jobs.j2 }),
        ]),
      pins(fx.teams.b),
    );
  await denied(
    ctx,
    "pinTeamJobAction(A) as employee of A",
    () =>
      ctx.call("ea", "core", "pinTeamJobAction", [
        fx.teams.a,
        PREV,
        form({ jobId: fx.jobs.j2 }),
      ]),
    pins(fx.teams.a),
  );
  await allowed(
    ctx,
    "pinTeamJobAction(A) as lead of A",
    () =>
      ctx.call("la", "core", "pinTeamJobAction", [
        fx.teams.a,
        PREV,
        form({ jobId: fx.jobs.j2 }),
      ]),
    pins(fx.teams.a),
  );
  for (const who of ["ea", "la"] as const)
    await denied(
      ctx,
      `unpinTeamJobAction(B) as ${who}`,
      () =>
        ctx.call(who, "core", "unpinTeamJobAction", [fx.teams.b, fx.jobs.j1]),
      pins(fx.teams.b),
    );
  await allowed(
    ctx,
    "unpinTeamJobAction(B) as lead of B",
    () =>
      ctx.call("lb", "core", "unpinTeamJobAction", [fx.teams.b, fx.jobs.j1]),
    pins(fx.teams.b),
  );

  // ── Jobs and customers ──
  const jobs = () => rows(job, like(job.code, "SECCHK%"));
  const customers = () => rows(customer, like(customer.name, "Secchk%"));
  const jobFields = (code: string, name: string) =>
    form({
      code,
      name,
      customerId: fx.customerId,
      status: "active",
      siteId: fx.siteId,
    });
  for (const who of ["ea", "la", "lb"] as const) {
    await denied(
      ctx,
      `createJobAction as ${who}`,
      () =>
        ctx.call(who, "core", "createJobAction", [
          PREV,
          jobFields(`SECCHK-${who}`, "X"),
        ]),
      jobs,
    );
    await denied(
      ctx,
      `updateJobAction(j1) as ${who}`,
      () =>
        ctx.call(who, "core", "updateJobAction", [
          fx.jobs.j1,
          PREV,
          jobFields("SECCHK-1", "Hacked"),
        ]),
      jobs,
    );
    await denied(
      ctx,
      `setJobArchivedAction(j1) as ${who}`,
      () => ctx.call(who, "core", "setJobArchivedAction", [fx.jobs.j1, true]),
      jobs,
    );
    await denied(
      ctx,
      `createCustomerAction as ${who}`,
      () =>
        ctx.call(who, "core", "createCustomerAction", [
          PREV,
          form({ name: `Secchk ${who}` }),
        ]),
      customers,
    );
    await denied(
      ctx,
      `updateCustomerAction as ${who}`,
      () =>
        ctx.call(who, "core", "updateCustomerAction", [
          fx.customerId,
          PREV,
          form({ name: "Hacked" }),
        ]),
      customers,
    );
    await denied(
      ctx,
      `setCustomerArchivedAction as ${who}`,
      () =>
        ctx.call(who, "core", "setCustomerArchivedAction", [
          fx.customerId,
          true,
        ]),
      customers,
    );
  }
  await allowed(
    ctx,
    "createJobAction as manager",
    () =>
      ctx.call("mg", "core", "createJobAction", [
        PREV,
        jobFields("SECCHK-3", "Secchk třetí"),
      ]),
    jobs,
  );
  await allowed(
    ctx,
    "updateJobAction(j2) as administrator",
    () =>
      ctx.call("ad", "core", "updateJobAction", [
        fx.jobs.j2,
        PREV,
        jobFields("SECCHK-2", "Secchk druhá 2"),
      ]),
    jobs,
  );
  const [job3] = await db.select().from(job).where(eq(job.code, "SECCHK-3"));
  await allowed(
    ctx,
    "setJobArchivedAction(j3) as manager",
    () =>
      ctx.call("mg", "core", "setJobArchivedAction", [
        job3?.id ?? fx.jobs.j1,
        true,
      ]),
    jobs,
  );
  await allowed(
    ctx,
    "createCustomerAction as manager",
    () =>
      ctx.call("mg", "core", "createCustomerAction", [
        PREV,
        form({ name: "Secchk druhý" }),
      ]),
    customers,
  );
  const [cust2] = await db
    .select()
    .from(customer)
    .where(eq(customer.name, "Secchk druhý"));
  await allowed(
    ctx,
    "updateCustomerAction as manager",
    () =>
      ctx.call("mg", "core", "updateCustomerAction", [
        cust2?.id ?? fx.customerId,
        PREV,
        form({ name: "Secchk druhý 2" }),
      ]),
    customers,
  );
  await allowed(
    ctx,
    "setCustomerArchivedAction as administrator",
    () =>
      ctx.call("ad", "core", "setCustomerArchivedAction", [
        cust2?.id ?? fx.customerId,
        true,
      ]),
    customers,
  );
}

async function timesheetActions(ctx: Ctx) {
  const { fx } = ctx;
  const { ids, days } = fx;
  ctx.report.section(
    "Akce docházky: nároky, šablony, absence, pohotovost, přesčas",
  );

  // ── Leave entitlement ──
  const leave = () =>
    rows(leaveEntitlement, eq(leaveEntitlement.employeeId, ids.ec));
  const leaveFields = form({
    year: fx.today.slice(0, 4),
    hoursEntitled: "999",
    hoursCarriedOver: "0",
  });
  for (const who of ["ec", "la"] as const)
    await denied(
      ctx,
      `setLeaveAction(ec) as ${who}`,
      () => ctx.call(who, "ts", "setLeaveAction", [ids.ec, PREV, leaveFields]),
      leave,
    );
  await allowed(
    ctx,
    "setLeaveAction(ec) as manager",
    () => ctx.call("mg", "ts", "setLeaveAction", [ids.ec, PREV, leaveFields]),
    leave,
  );

  // ── Day templates ──
  const ebTemplate = () =>
    rows(dayTemplate, eq(dayTemplate.employeeId, ids.eb));
  for (const who of ["ea", "lb"] as const)
    await denied(
      ctx,
      `deleteDayTemplateAction(eb) as ${who}`,
      () => ctx.call(who, "ts", "deleteDayTemplateAction", [ids.eb]),
      ebTemplate,
    );
  await allowed(
    ctx,
    "deleteDayTemplateAction(eb) as manager",
    () => ctx.call("mg", "ts", "deleteDayTemplateAction", [ids.eb]),
    ebTemplate,
  );
  const defaults = () =>
    rows(timesheetSettings, eq(timesheetSettings.key, "default_day_template"));
  const templateForm = form({
    items: JSON.stringify([{ from: "06:00", to: "14:30", kind: "work" }]),
  });
  for (const who of ["ea", "la", "lb"] as const)
    await denied(
      ctx,
      `setDefaultDayTemplateAction as ${who}`,
      () =>
        ctx.call(who, "ts", "setDefaultDayTemplateAction", [
          PREV,
          templateForm,
        ]),
      defaults,
    );
  await allowed(
    ctx,
    "setDefaultDayTemplateAction as manager",
    () =>
      ctx.call("mg", "ts", "setDefaultDayTemplateAction", [PREV, templateForm]),
    defaults,
  );

  // ── Absences ──
  const absencesOf = (p: Person) => () =>
    rows(absence, eq(absence.employeeId, ids[p]));
  const absenceForm = (p: Person, day: string, reason?: string) =>
    form({
      employeeId: ids[p],
      type: "vacation",
      dateFrom: day,
      dateTo: day,
      note: "secchk-new-absence",
      reason: reason ?? null,
    });
  for (const who of ["ea", "la", "ad"] as const)
    await denied(
      ctx,
      `createAbsenceAction for eb as ${who}`,
      () =>
        ctx.call(who, "ts", "createAbsenceAction", [
          PREV,
          absenceForm("eb", days[9], "x"),
        ]),
      absencesOf("eb"),
    );
  await denied(
    ctx,
    "createAbsenceAction for ec by the lead without a reason",
    () =>
      ctx.call("la", "ts", "createAbsenceAction", [
        PREV,
        absenceForm("ec", days[10]),
      ]),
    absencesOf("ec"),
  );
  await denied(
    ctx,
    "createAbsenceAction: own request in a confirmed month",
    () =>
      ctx.call("ea", "ts", "createAbsenceAction", [
        PREV,
        absenceForm("ea", fx.daysP2[3]),
      ]),
    absencesOf("ea"),
  );
  await allowed(
    ctx,
    "createAbsenceAction: own request",
    () =>
      ctx.call("ea", "ts", "createAbsenceAction", [
        PREV,
        absenceForm("ea", days[9]),
      ]),
    absencesOf("ea"),
  );
  await allowed(
    ctx,
    "createAbsenceAction for ec by the lead",
    () =>
      ctx.call("la", "ts", "createAbsenceAction", [
        PREV,
        absenceForm("ec", days[10], "secchk"),
      ]),
    absencesOf("ec"),
  );
  const absenceRow = (id: string) => () => row(absence, id);
  for (const [who, target] of [
    ["ea", "ea"],
    ["la", "la"],
    ["la", "eb"],
    ["ad", "ec"],
    ["ea", "ec"],
  ] as const)
    await denied(
      ctx,
      `decideAbsenceAction: ${who} approves ${target}'s request`,
      () =>
        ctx.call(who, "ts", "decideAbsenceAction", [
          fx.absences[target],
          "approve",
          PREV,
          form({ reason: "x" }),
        ]),
      absenceRow(fx.absences[target]),
    );
  await allowed(
    ctx,
    "decideAbsenceAction: lead approves own team's request",
    () =>
      ctx.call("la", "ts", "decideAbsenceAction", [
        fx.absences.ec,
        "approve",
        PREV,
        form({}),
      ]),
    absenceRow(fx.absences.ec),
  );
  for (const who of ["ea", "la"] as const)
    await denied(
      ctx,
      `cancelAbsenceAction(eb) as ${who}`,
      () =>
        ctx.call(who, "ts", "cancelAbsenceAction", [
          fx.absences.eb,
          PREV,
          form({ reason: "x" }),
        ]),
      absenceRow(fx.absences.eb),
    );
  await allowed(
    ctx,
    "cancelAbsenceAction: own request",
    () =>
      ctx.call("ea", "ts", "cancelAbsenceAction", [
        fx.absences.ea,
        PREV,
        form({}),
      ]),
    absenceRow(fx.absences.ea),
  );

  // ── Standby ──
  const standbysOf = (p: Person) => () =>
    rows(standby, eq(standby.employeeId, ids[p]));
  const standbyForm = (p: Person, day: string, end: string, reason?: string) =>
    form({
      employeeId: ids[p],
      startDate: day,
      startTime: "18:00",
      endDate: day,
      endTime: end,
      note: "secchk-new-standby",
      reason: reason ?? null,
    });
  for (const who of ["ea", "la"] as const)
    await denied(
      ctx,
      `createStandbyAction for eb as ${who}`,
      () =>
        ctx.call(who, "ts", "createStandbyAction", [
          PREV,
          standbyForm("eb", days[2], "20:00", "x"),
        ]),
      standbysOf("eb"),
    );
  await denied(
    ctx,
    "createStandbyAction for eb by the lead without a reason",
    () =>
      ctx.call("lb", "ts", "createStandbyAction", [
        PREV,
        standbyForm("eb", days[2], "20:00"),
      ]),
    standbysOf("eb"),
  );
  await denied(
    ctx,
    "createStandbyAction: own in a confirmed month",
    () =>
      ctx.call("ea", "ts", "createStandbyAction", [
        PREV,
        standbyForm("ea", fx.daysP2[2], "20:00"),
      ]),
    standbysOf("ea"),
  );
  await allowed(
    ctx,
    "createStandbyAction: own",
    () =>
      ctx.call("ea", "ts", "createStandbyAction", [
        PREV,
        standbyForm("ea", days[2], "20:00"),
      ]),
    standbysOf("ea"),
  );
  await allowed(
    ctx,
    "createStandbyAction for ec by the lead",
    () =>
      ctx.call("la", "ts", "createStandbyAction", [
        PREV,
        standbyForm("ec", days[2], "20:00", "secchk"),
      ]),
    standbysOf("ec"),
  );
  const ebStandby = () => row(standby, fx.standbys.eb);
  await denied(
    ctx,
    "updateStandbyAction(eb's) as ea",
    () =>
      ctx.call("ea", "ts", "updateStandbyAction", [
        fx.standbys.eb,
        PREV,
        standbyForm("eb", days[1], "19:00", "x"),
      ]),
    ebStandby,
  );
  await denied(
    ctx,
    "updateStandbyAction(eb's) as ea, claiming it is ea's",
    () =>
      ctx.call("ea", "ts", "updateStandbyAction", [
        fx.standbys.eb,
        PREV,
        standbyForm("ea", days[1], "19:00", "x"),
      ]),
    ebStandby,
  );
  await denied(
    ctx,
    "updateStandbyAction(eb's) as lead of A",
    () =>
      ctx.call("la", "ts", "updateStandbyAction", [
        fx.standbys.eb,
        PREV,
        standbyForm("eb", days[1], "19:00", "x"),
      ]),
    ebStandby,
  );
  await allowed(
    ctx,
    "updateStandbyAction(eb's) as lead of B",
    () =>
      ctx.call("lb", "ts", "updateStandbyAction", [
        fx.standbys.eb,
        PREV,
        standbyForm("eb", days[1], "21:00", "secchk"),
      ]),
    ebStandby,
  );
  for (const who of ["ea", "la"] as const)
    await denied(
      ctx,
      `deleteStandbyAction(eb's) as ${who}`,
      () =>
        ctx.call(who, "ts", "deleteStandbyAction", [
          fx.standbys.eb,
          PREV,
          form({ reason: "x" }),
        ]),
      ebStandby,
    );
  await allowed(
    ctx,
    "deleteStandbyAction(ec's) as lead of A",
    () =>
      ctx.call("la", "ts", "deleteStandbyAction", [
        fx.standbys.ec,
        PREV,
        form({ reason: "secchk" }),
      ]),
    () => row(standby, fx.standbys.ec),
  );

  // ── Overtime flag ──
  const entry = (id: string) => () => row(timeEntry, id);
  for (const [who, id, label] of [
    ["ea", fx.entries.ea, "own entry as employee"],
    ["la", fx.entries.la, "own entry as lead"],
    ["la", fx.entries.eb, "another team's entry as lead"],
    ["ad", fx.entries.eb, "as administrator"],
    ["la", fx.lockedEntries.ec, "entry in an approved month"],
  ] as const)
    await denied(
      ctx,
      `setOvertimeAction: ${label}`,
      () =>
        ctx.call(who, "ts", "setOvertimeAction", [
          id,
          true,
          PREV,
          form({ reason: "x" }),
        ]),
      entry(id),
    );
  await allowed(
    ctx,
    "setOvertimeAction: lead on own team's entry",
    () =>
      ctx.call("lb", "ts", "setOvertimeAction", [
        fx.entries.eb,
        true,
        PREV,
        form({ reason: "secchk" }),
      ]),
    entry(fx.entries.eb),
  );
}

async function timelineActions(ctx: Ctx) {
  const { fx } = ctx;
  const { ids, days } = fx;
  ctx.report.section("Časová osa dne");

  const entriesOn = (p: Person, day: string) => () =>
    rows(
      timeEntry,
      and(eq(timeEntry.employeeId, ids[p]), eq(timeEntry.workDate, day))!,
    );
  const create = (start: number) => ({
    type: "create",
    start,
    end: start + 60,
    kind: "work",
    jobId: fx.jobs.j1,
    workTypeId: fx.workTypes.job,
    note: "secchk-timeline",
  });
  const input = (
    p: Person,
    date: string,
    command: unknown,
    reason?: string,
  ) => [{ employeeId: ids[p], date, reason: reason ?? null, command }];

  for (const who of ["ea", "la"] as const)
    await denied(
      ctx,
      `timelineAction: ${who} creates an entry for eb`,
      () =>
        ctx.call(
          who,
          "timeline",
          "timelineAction",
          input("eb", days[3], create(480), "x"),
        ),
      entriesOn("eb", days[3]),
    );
  await denied(
    ctx,
    "timelineAction: lead writes for own team without a reason",
    () =>
      ctx.call(
        "la",
        "timeline",
        "timelineAction",
        input("ec", days[3], create(480)),
      ),
    entriesOn("ec", days[3]),
  );
  await denied(
    ctx,
    "timelineAction: own entry in a confirmed month",
    () =>
      ctx.call(
        "ea",
        "timeline",
        "timelineAction",
        input("ea", fx.daysP2[1], create(600)),
      ),
    entriesOn("ea", fx.daysP2[1]),
  );
  await denied(
    ctx,
    "timelineAction: manager writes into an approved month",
    () =>
      ctx.call(
        "mg",
        "timeline",
        "timelineAction",
        input("ea", "2016-01-04", create(900), "x"),
      ),
    entriesOn("ea", "2016-01-04"),
  );
  const ebEntry = () => row(timeEntry, fx.entries.eb);
  for (const [label, p, command] of [
    [
      "update eb's entry under own employee",
      "ea",
      { type: "update", id: fx.entries.eb, note: "hacked" },
    ],
    [
      "delete eb's entry under own employee",
      "ea",
      { type: "delete", id: fx.entries.eb },
    ],
    ["delete eb's entry", "eb", { type: "delete", id: fx.entries.eb }],
    [
      "move eb's entry",
      "ea",
      {
        type: "adjust",
        id: fx.entries.eb,
        action: "move",
        delta: 60,
        step: 15,
      },
    ],
  ] as const)
    await denied(
      ctx,
      `timelineAction: ea tries to ${label}`,
      () =>
        ctx.call(
          "ea",
          "timeline",
          "timelineAction",
          input(p, days[1], command, "x"),
        ),
      ebEntry,
    );
  await allowed(
    ctx,
    "timelineAction: own entry",
    () =>
      ctx.call(
        "ea",
        "timeline",
        "timelineAction",
        input("ea", days[3], create(480)),
      ),
    entriesOn("ea", days[3]),
  );
  await allowed(
    ctx,
    "timelineAction: lead for own team with a reason",
    () =>
      ctx.call(
        "la",
        "timeline",
        "timelineAction",
        input("ec", days[3], create(480), "secchk"),
      ),
    entriesOn("ec", days[3]),
  );
  await allowed(
    ctx,
    "timelineAction: administrator for anyone with a reason",
    () =>
      ctx.call(
        "ad",
        "timeline",
        "timelineAction",
        input("eb", days[4], create(480), "secchk"),
      ),
    entriesOn("eb", days[4]),
  );

  for (const who of ["ea", "la"] as const)
    await ctx.report.check(
      `loadTimelineDayAction: ${who} loads eb's day → nothing`,
      async () => {
        const res = await ctx.call(who, "timeline", "loadTimelineDayAction", [
          ids.eb,
          days[1],
        ]);
        assert(
          res.kind === "ok" && res.value === null,
          `got ${res.kind} ${String(res.value).slice(0, 80)}`,
        );
        assert(
          !res.body.includes(noteMark("eb")),
          "response contains eb's entry",
        );
      },
    );
  await ctx.report.check(
    "loadTimelineDayAction: lead of B loads eb's day",
    async () => {
      const res = await ctx.call("lb", "timeline", "loadTimelineDayAction", [
        ids.eb,
        days[1],
      ]);
      assert(res.body.includes(noteMark("eb")), `got ${res.kind}`);
    },
  );

  const pins = (teamId: string) => () =>
    rows(teamJob, eq(teamJob.teamId, teamId));
  await denied(
    ctx,
    "timeline pinTeamJobAction as employee",
    () =>
      ctx.call("ea", "timeline", "pinTeamJobAction", [
        ids.ea,
        days[1],
        fx.jobs.j1,
        true,
      ]),
    pins(fx.teams.a),
  );
  await denied(
    ctx,
    "timeline pinTeamJobAction: lead of A pins for eb's team",
    () =>
      ctx.call("la", "timeline", "pinTeamJobAction", [
        ids.eb,
        days[1],
        fx.jobs.j2,
        true,
      ]),
    pins(fx.teams.b),
    (res) =>
      assert(!res.body.includes(noteMark("eb")), "response contains eb's day"),
  );
  await allowed(
    ctx,
    "timeline pinTeamJobAction: lead for own team",
    () =>
      ctx.call("la", "timeline", "pinTeamJobAction", [
        ids.ec,
        days[1],
        fx.jobs.j1,
        true,
      ]),
    pins(fx.teams.a),
  );

  const templates = () =>
    rows(dayTemplate, inArray(dayTemplate.employeeId, [ids.ea, ids.eb]));
  await allowed(
    ctx,
    "saveOwnTemplateAction saves only the own template (no employee argument)",
    () =>
      ctx.call("ea", "timeline", "saveOwnTemplateAction", [
        [{ from: "07:00", to: "15:30", kind: "work" }],
      ]),
    templates,
  );
  await ctx.report.check("saveOwnTemplateAction did not touch eb", async () => {
    const [ebRow] = await db
      .select()
      .from(dayTemplate)
      .where(eq(dayTemplate.employeeId, ids.eb));
    assert(!ebRow, "eb has a template again");
  });
}

async function flowActions(ctx: Ctx) {
  const { fx } = ctx;
  const { ids } = fx;
  ctx.report.section(
    "Výkaz: potvrzení, schválení, uzávěrka, připomínky, import",
  );

  const sheet = (p: Person, month: string) => () =>
    rows(
      timesheet,
      and(eq(timesheet.employeeId, ids[p]), eq(timesheet.month, month))!,
    );

  // ── Confirm: only the own month (no employee argument) ──
  await reached(
    ctx,
    "confirmTimesheetAction confirms only the own month (refused: missing days)",
    () =>
      ctx.call("ea", "ts", "confirmTimesheetAction", [fx.p1, PREV, form({})]),
    (res) =>
      assert(
        formState(res).ok === false,
        "confirmed although days are missing",
      ),
  );
  await denied(
    ctx,
    "confirmTimesheetAction in an approved month",
    () =>
      ctx.call("mg", "ts", "confirmTimesheetAction", [
        CLOSED_MONTH,
        PREV,
        form({}),
      ]),
    sheet("mg", CLOSED_MONTH),
  );

  // ── Bulk approve (before the single decisions change the month) ──
  const p2Sheets = () =>
    rows(
      timesheet,
      and(
        eq(timesheet.month, fx.p2),
        inArray(timesheet.employeeId, [ids.eb, ids.la]),
      )!,
    );
  await denied(
    ctx,
    "bulkApproveAction: lead of A with eb and himself",
    () =>
      ctx.call("la", "ts", "bulkApproveAction", [
        fx.p2,
        [ids.eb, ids.la],
        PREV,
        form({}),
      ]),
    p2Sheets,
  );
  await ctx.report.check(
    "denied: bulkApproveAction(all) by lead of A leaves eb and himself",
    async () => {
      const before = JSON.stringify(await p2Sheets());
      await ctx.call("la", "ts", "bulkApproveAction", [
        fx.p2,
        "all",
        PREV,
        form({}),
      ]);
      assert(
        JSON.stringify(await p2Sheets()) === before,
        "eb's or the lead's own month changed",
      );
    },
  );
  for (const who of ["ea", "ad"] as const)
    await denied(
      ctx,
      `bulkApproveAction as ${who}`,
      () =>
        ctx.call(who, "ts", "bulkApproveAction", [
          fx.p2,
          "all",
          PREV,
          form({}),
        ]),
      p2Sheets,
    );
  await reached(ctx, "bulkApproveAction as lead of B", () =>
    ctx.call("lb", "ts", "bulkApproveAction", [
      fx.p2,
      [ids.ea],
      PREV,
      form({}),
    ]),
  );

  // ── Approve / return one timesheet ──
  for (const [who, target, decision] of [
    ["ea", "eb", "approve"],
    ["la", "eb", "approve"],
    ["la", "la", "approve"],
    ["ad", "eb", "approve"],
    ["la", "eb", "return"],
    ["la", "ea", "confirm"],
  ] as const)
    await denied(
      ctx,
      `decideTimesheetAction: ${who} ${decision}s ${target}'s month`,
      () =>
        ctx.call(who, "ts", "decideTimesheetAction", [
          ids[target],
          fx.p2,
          decision,
          PREV,
          form({ reason: "x" }),
        ]),
      sheet(target, fx.p2),
    );
  await allowed(
    ctx,
    "decideTimesheetAction: manager approves the lead's month",
    () =>
      ctx.call("mg", "ts", "decideTimesheetAction", [
        ids.la,
        fx.p2,
        "approve",
        PREV,
        form({}),
      ]),
    sheet("la", fx.p2),
  );
  const ebNotifications = () =>
    rows(notification, eq(notification.employeeId, ids.eb));
  await allowed(
    ctx,
    "decideTimesheetAction: lead of B returns eb's month (queues an e-mail)",
    () =>
      ctx.call("lb", "ts", "decideTimesheetAction", [
        ids.eb,
        fx.p2,
        "return",
        PREV,
        form({ reason: "secchk-return-reason" }),
      ]),
    ebNotifications,
  );

  // ── Reminders by hand ──
  const reminders = (p: Person) => () =>
    rows(reminderLog, eq(reminderLog.employeeId, ids[p]));
  for (const who of ["ea", "la", "ad"] as const)
    await denied(
      ctx,
      `remindEmployeeAction(eb) as ${who}`,
      () =>
        ctx.call(who, "ts", "remindEmployeeAction", [
          ids.eb,
          fx.p1,
          PREV,
          form({}),
        ]),
      reminders("eb"),
    );
  await allowed(
    ctx,
    "remindEmployeeAction(eb) as lead of B",
    () =>
      ctx.call("lb", "ts", "remindEmployeeAction", [
        ids.eb,
        fx.p1,
        PREV,
        form({}),
      ]),
    reminders("eb"),
    { audited: false },
  );
  const allReminders = () => rows(reminderLog, sql`true`);
  for (const who of ["ea", "la", "lb", "ad"] as const)
    await denied(
      ctx,
      `remindMissingAction as ${who}`,
      () => ctx.call(who, "ts", "remindMissingAction", [fx.p1, PREV, form({})]),
      allReminders,
    );
  await allowed(
    ctx,
    "remindMissingAction as manager",
    () => ctx.call("mg", "ts", "remindMissingAction", [fx.p1, PREV, form({})]),
    allReminders,
    { audited: false },
  );

  // ── Settings ──
  const settings = () => rows(timesheetSettings, sql`true`);
  for (const who of ["ea", "la", "ad"] as const)
    await denied(
      ctx,
      `saveSettingsAction as ${who}`,
      () =>
        ctx.call(who, "ts", "saveSettingsAction", [
          PREV,
          form({ validFrom: fx.today, nightStart: "21:00" }),
        ]),
      settings,
    );
  await reached(
    ctx,
    "saveSettingsAction as manager (incomplete form refused)",
    () =>
      ctx.call("mg", "ts", "saveSettingsAction", [
        PREV,
        form({ validFrom: fx.today }),
      ]),
  );

  // ── Import (administrator only) ──
  const template = new File(
    [readFileSync("docs/import/sablona-importu.xlsx")],
    "sablona-importu.xlsx",
  );
  const importForm = (mode: string) => {
    const data = form({ mode });
    data.set("file", template);
    return data;
  };
  const everyone = () => rows(employee, sql`true`);
  for (const who of ["ea", "la", "mg"] as const)
    await denied(
      ctx,
      `importAction(apply) as ${who}`,
      () =>
        ctx.call(who, "import", "importAction", [PREV, importForm("apply")]),
      everyone,
    );
  await reached(
    ctx,
    "importAction(preview) as administrator writes nothing",
    () =>
      ctx.call("ad", "import", "importAction", [PREV, importForm("preview")]),
    (res) =>
      assert(
        Array.isArray((res.value as { sheets?: unknown[] } | null)?.sheets),
        "no preview",
      ),
  );

  // ── Period close and reopen ──
  const closes = () => rows(periodClose, eq(periodClose.month, CLOSED_MONTH));
  const exports = () =>
    rows(periodExport, eq(periodExport.month, CLOSED_MONTH));
  for (const who of ["ea", "la", "lb", "ad"] as const)
    await denied(
      ctx,
      `closePeriodAction as ${who}`,
      () =>
        ctx.call(who, "ts", "closePeriodAction", [
          CLOSED_MONTH,
          PREV,
          form({}),
        ]),
      closes,
    );
  await allowed(
    ctx,
    "closePeriodAction as manager (payroll snapshot v1)",
    () =>
      ctx.call("mg", "ts", "closePeriodAction", [CLOSED_MONTH, PREV, form({})]),
    exports,
    {
      check: (res) =>
        assert(
          formState(res).ok === true,
          `not closed: ${JSON.stringify(res.value)}`,
        ),
    },
  );
  for (const who of ["ea", "la", "ad"] as const)
    await denied(
      ctx,
      `reopenPeriodAction as ${who}`,
      () =>
        ctx.call(who, "ts", "reopenPeriodAction", [
          CLOSED_MONTH,
          [ids[who]],
          PREV,
          form({ reason: "x" }),
        ]),
      closes,
    );
}

/** Reopening last: the export checks need the closed month first. */
export async function reopenAction(ctx: Ctx) {
  const { fx } = ctx;
  ctx.report.section("Uzavřený měsíc a znovuotevření");
  const entriesOn = () =>
    rows(
      timeEntry,
      and(
        eq(timeEntry.employeeId, fx.ids.ea),
        eq(timeEntry.workDate, "2016-01-05"),
      )!,
    );
  await denied(
    ctx,
    "timelineAction: manager writes into the closed month",
    () =>
      ctx.call("mg", "timeline", "timelineAction", [
        {
          employeeId: fx.ids.ea,
          date: "2016-01-05",
          reason: "x",
          command: {
            type: "create",
            start: 900,
            end: 960,
            kind: "work",
            jobId: fx.jobs.j1,
            workTypeId: fx.workTypes.job,
          },
        },
      ]),
    entriesOn,
  );
  await denied(
    ctx,
    "createStandbyAction: manager in the closed month",
    () =>
      ctx.call("mg", "ts", "createStandbyAction", [
        PREV,
        form({
          employeeId: fx.ids.ea,
          startDate: "2016-01-05",
          startTime: "18:00",
          endDate: "2016-01-05",
          endTime: "20:00",
          reason: "x",
        }),
      ]),
    () => rows(standby, eq(standby.employeeId, fx.ids.ea)),
  );
  await allowed(
    ctx,
    "reopenPeriodAction(ea) as manager (queues an e-mail to ea)",
    () =>
      ctx.call("mg", "ts", "reopenPeriodAction", [
        CLOSED_MONTH,
        [fx.ids.ea],
        PREV,
        form({ reason: "secchk-reopen-reason" }),
      ]),
    () => rows(notification, eq(notification.employeeId, fx.ids.ea)),
  );
}
