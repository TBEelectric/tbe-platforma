import { and, asc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { createFormatter, createTranslator } from "next-intl";
import { toAppLocale, type AppLocale } from "@/i18n/config";
import { calendarDate } from "@/i18n/format";
import { formats } from "@/i18n/formats";
import { msg } from "@/i18n/messages";
import { addDays, APP_TIME_ZONE, monthStart, todayInPrague } from "@/lib/dates";
import { db, type DbOrTx } from "@/lib/db";
import { UserError } from "@/lib/form-state";
import { appUrl, sendMail } from "@/lib/mail";
import {
  employee,
  employment,
  insertAudited,
  publicHoliday,
  team,
  user,
  type Actor,
  type ChangeContext,
} from "../core";
import { managerIds } from "./approval";
import { getMonth, getTeamMonth, type MonthView } from "./month-data";
import { monthEnd } from "./rules/month-summary";
import {
  approveRecipients,
  canRemind,
  closeRecipients,
  confirmRecipients,
  dailyRunDue,
  emailContent,
  manualReminderError,
  missingDayRecipients,
  missingDayRefDate,
  monthRemindersDue,
  reminderLogKey,
  renderEmail,
  type Contact,
  type EmailContent,
  type MonthOfEmployee,
  type MonthReminder,
  type ReminderKind,
} from "./rules/reminders";
import { resolveSettings } from "./rules/settings";
import { ownerOf } from "./timesheet-flow";
import {
  absence,
  notification,
  reminderLog,
  timeEntry,
  timesheet,
  timesheetSettings,
} from "./schema";

// Připomínky and e-mails (step 4.5): loads data, lets rules/reminders.ts decide, records reminder_log
// (or notification.sent_at) and sends in one transaction. A failed send rolls the record back, so the
// next run tries again; a recorded reminder is never sent twice.

type Writer = ChangeContext & { actor: Actor };

/** Reads every month and team like the timesheets manager (the worker has no signed-in user). */
const SYSTEM_VIEWER: Actor = {
  employeeId: "",
  isAdmin: true,
  isTimesheetsManager: true,
  ledTeamIds: [],
  tracksTime: false,
};

type Recipient = Contact & { name: string; locale: AppLocale };

async function loadRecipients(ids: string[]): Promise<Map<string, Recipient>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({
      employeeId: employee.id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      active: employee.active,
      archivedAt: employee.archivedAt,
      locale: user.locale,
    })
    .from(employee)
    .leftJoin(user, eq(user.employeeId, employee.id))
    .where(inArray(employee.id, ids));
  return new Map(
    rows.map((r) => [
      r.employeeId,
      {
        employeeId: r.employeeId,
        active: r.active && r.archivedAt === null,
        email: r.email,
        name: `${r.firstName} ${r.lastName}`,
        locale: toAppLocale(r.locale),
      },
    ]),
  );
}

async function holidayDates(): Promise<string[]> {
  const rows = await db
    .select({ date: publicHoliday.date })
    .from(publicHoliday);
  return rows.map((r) => r.date);
}

async function sentKeys(
  kind: ReminderKind,
  refDate: string,
): Promise<Set<string>> {
  const rows = await db
    .select()
    .from(reminderLog)
    .where(and(eq(reminderLog.kind, kind), eq(reminderLog.refDate, refDate)));
  return new Set(rows.map((r) => reminderLogKey({ ...r, kind })));
}

/** The e-mail in the recipient's language, ready to send. */
async function compose(recipient: Recipient, content: EmailContent) {
  const messages = (await import(`../../../messages/${recipient.locale}.json`))
    .default;
  const t = createTranslator({
    locale: recipient.locale,
    messages,
    formats,
    timeZone: APP_TIME_ZONE,
  });
  const format = createFormatter({
    locale: recipient.locale,
    timeZone: APP_TIME_ZONE,
    formats,
  });
  return renderEmail({
    email: emailContent(content),
    t,
    formatDay: (d) => format.dateTime(calendarDate(d), "dayMonth"),
    appUrl,
    name: recipient.name,
  });
}

/**
 * Records the reminder in reminder_log and sends it, in one transaction: when the row already exists
 * (another run, a restart) nothing is sent; when sending fails the row is rolled back. `audit` writes
 * the row through insertAudited (manual reminders by a user). Returns whether it was sent.
 */
async function deliver(
  recipient: Recipient,
  key: { kind: ReminderKind; refDate: string },
  content: EmailContent,
  audit?: Writer,
): Promise<boolean> {
  if (!recipient.email) return false;
  const mail = await compose(recipient, content);
  return db.transaction(async (tx) => {
    const values = { employeeId: recipient.employeeId, ...key };
    if (audit) {
      const [existing] = await tx
        .select({ id: reminderLog.id })
        .from(reminderLog)
        .where(
          and(
            eq(reminderLog.employeeId, values.employeeId),
            eq(reminderLog.kind, key.kind),
            eq(reminderLog.refDate, key.refDate),
          ),
        );
      if (existing) return false;
      await insertAudited(tx, audit, "reminder_log", reminderLog, values);
    } else {
      const inserted = await tx
        .insert(reminderLog)
        .values(values)
        .onConflictDoNothing()
        .returning({ id: reminderLog.id });
      if (inserted.length === 0) return false;
    }
    await sendMail({ to: recipient.email!, ...mail });
    return true;
  });
}

/** Sends to each recipient; one failure is logged and does not stop the others. */
async function deliverAll(
  jobs: Array<{
    recipient: Recipient | undefined;
    key: { kind: ReminderKind; refDate: string };
    content: EmailContent;
  }>,
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  for (const job of jobs) {
    if (!job.recipient) continue;
    try {
      if (await deliver(job.recipient, job.key, job.content)) sent++;
    } catch (error) {
      failed++;
      console.error(
        `Reminder ${job.key.kind} ${job.key.refDate} to ${job.recipient.employeeId} failed:`,
        error,
      );
    }
  }
  return { sent, failed };
}

// ── Daily run (worker) ──

/** Missing-day reminders about one working day. */
async function remindMissingDay(date: string, holidays: string[]) {
  const month = monthStart(date);
  const people = await db
    .select({
      employeeId: employee.id,
      tracksTime: employee.tracksTime,
    })
    .from(employee)
    .where(
      and(
        eq(employee.active, true),
        eq(employee.tracksTime, true),
        isNull(employee.archivedAt),
      ),
    );
  const ids = people.map((p) => p.employeeId);
  if (ids.length === 0) return { sent: 0, failed: 0 };
  const [recipients, employments, entries, absences, sheets, sent] =
    await Promise.all([
      loadRecipients(ids),
      db
        .select()
        .from(employment)
        .where(
          and(
            inArray(employment.employeeId, ids),
            isNull(employment.archivedAt),
          ),
        ),
      db
        .selectDistinct({ employeeId: timeEntry.employeeId })
        .from(timeEntry)
        .where(
          and(inArray(timeEntry.employeeId, ids), eq(timeEntry.workDate, date)),
        ),
      db
        .select()
        .from(absence)
        .where(
          and(
            inArray(absence.employeeId, ids),
            isNull(absence.archivedAt),
            lte(absence.dateFrom, date),
            gte(absence.dateTo, date),
          ),
        ),
      db
        .select({ employeeId: timesheet.employeeId, status: timesheet.status })
        .from(timesheet)
        .where(
          and(inArray(timesheet.employeeId, ids), eq(timesheet.month, month)),
        ),
      sentKeys("missing_day", date),
    ]);
  const chosen = missingDayRecipients({
    date,
    holidays,
    sent,
    employees: people.map((p) => ({
      ...recipients.get(p.employeeId)!,
      tracksTime: p.tracksTime,
      employments: employments.filter((e) => e.employeeId === p.employeeId),
      entryDates: entries.some((e) => e.employeeId === p.employeeId)
        ? [date]
        : [],
      absences: absences.filter((a) => a.employeeId === p.employeeId),
      status:
        sheets.find((s) => s.employeeId === p.employeeId)?.status ?? "open",
    })),
  });
  return deliverAll(
    chosen.map((id) => ({
      recipient: recipients.get(id),
      key: { kind: "missing_day", refDate: date },
      content: { kind: "missing_day", date },
    })),
  );
}

const monthOfEmployee = (
  view: MonthView,
  contact: Contact | undefined,
): MonthOfEmployee => ({
  employeeId: view.employee.id,
  active: contact?.active ?? false,
  email: contact?.email ?? null,
  status: view.status,
  periodClosed: view.periodClosed,
  missingDays: view.summary.missingDays,
});

const fullName = (v: MonthView) =>
  `${v.employee.firstName} ${v.employee.lastName}`;

/** One month reminder (confirm, approve or close) about last month. */
async function remindMonth(due: MonthReminder, now: Date) {
  const { month, kind } = due;
  const key = { kind, refDate: month };
  const [{ employees: views }, sent, managers] = await Promise.all([
    getTeamMonth(SYSTEM_VIEWER, month, "all", now),
    sentKeys(kind, month),
    managerIds(),
  ]);

  if (kind === "confirm_start" || kind === "confirm_deadline") {
    const recipients = await loadRecipients(views.map((v) => v.employee.id));
    const chosen = confirmRecipients({
      kind,
      month,
      sent,
      employees: views.map((v) =>
        monthOfEmployee(v, recipients.get(v.employee.id)),
      ),
    });
    return deliverAll(
      chosen.map((e) => ({
        recipient: recipients.get(e.employeeId),
        key,
        content: {
          kind,
          month,
          deadline: due.deadline,
          missingDays: e.missingDays,
        },
      })),
    );
  }

  if (kind === "approve") {
    const today = todayInPrague(now);
    const [owners, teams] = await Promise.all([
      Promise.all(views.map((v) => ownerOf(db, v.employee.id, month, today))),
      db
        .select({ id: team.id, leadEmployeeId: team.leadEmployeeId })
        .from(team)
        .where(isNull(team.archivedAt)),
    ]);
    const leads = teams.flatMap((t) => t.leadEmployeeId ?? []);
    const recipients = await loadRecipients([
      ...new Set([...leads, ...managers]),
    ]);
    const chosen = approveRecipients({
      month,
      timesheets: views.map((v, i) => ({ owner: owners[i], status: v.status })),
      teams,
      managers,
      contacts: [...recipients.values()],
      sent,
    });
    return deliverAll(
      chosen.map((c) => ({
        recipient: recipients.get(c.employeeId),
        key,
        content: {
          kind,
          month,
          deadline: due.deadline,
          names: c.waiting.map((id) =>
            fullName(views.find((v) => v.employee.id === id)!),
          ),
        },
      })),
    );
  }

  const recipients = await loadRecipients(managers);
  const chosen = closeRecipients({
    month,
    periodClosed: views.some((v) => v.periodClosed),
    managers: [...recipients.values()],
    sent,
  });
  return deliverAll(
    chosen.map((id) => ({
      recipient: recipients.get(id),
      key,
      content: {
        kind: "close",
        month,
        deadline: due.deadline,
        approved: views.filter(
          (v) => v.status === "approved" || v.status === "closed",
        ).length,
        total: views.length,
      },
    })),
  );
}

/**
 * The daily reminders, when due (a working day from reminder_time in Prague). Safe to call any number
 * of times a day: reminder_log keeps every reminder to one e-mail. Returns null when not due.
 */
export async function runDailyReminders(
  now: Date = new Date(),
): Promise<{ sent: number; failed: number } | null> {
  const today = todayInPrague(now);
  const [settingRows, holidays] = await Promise.all([
    db.select().from(timesheetSettings),
    holidayDates(),
  ]);
  const settings = resolveSettings(settingRows, today);
  if (!dailyRunDue({ now, reminderTime: settings.reminderTime, holidays }))
    return null;

  const results: Array<{ sent: number; failed: number }> = [];
  const missingDate = missingDayRefDate(
    today,
    settings.missingDayReminderDelayDays,
    holidays,
  );
  if (missingDate) results.push(await remindMissingDay(missingDate, holidays));

  const lastMonth = monthStart(addDays(monthStart(today), -1));
  const due = monthRemindersDue({
    today,
    holidays,
    deadlines: resolveSettings(settingRows, monthEnd(lastMonth)),
  });
  for (const reminder of due) results.push(await remindMonth(reminder, now));
  return {
    sent: results.reduce((sum, r) => sum + r.sent, 0),
    failed: results.reduce((sum, r) => sum + r.failed, 0),
  };
}

// ── Notification queue (returned timesheet, reopened month) ──

/**
 * Sends queued notifications (sent_at empty) and sets sent_at, each in its own transaction with the
 * row locked (SKIP LOCKED: two workers never take the same row). A recipient without an e-mail or no
 * longer active is marked as handled without sending.
 */
export async function sendPendingNotifications(
  now: Date = new Date(),
): Promise<{ sent: number; failed: number }> {
  const pending = await db
    .select({ id: notification.id })
    .from(notification)
    .where(isNull(notification.sentAt))
    .orderBy(asc(notification.createdAt))
    .limit(100);
  let sent = 0;
  let failed = 0;
  for (const { id } of pending) {
    try {
      const done = await db.transaction(async (tx: DbOrTx) => {
        const [row] = await tx
          .select()
          .from(notification)
          .where(and(eq(notification.id, id), isNull(notification.sentAt)))
          .for("update", { skipLocked: true });
        if (!row) return false;
        const recipient = (await loadRecipients([row.employeeId])).get(
          row.employeeId,
        );
        if (recipient?.active && recipient.email) {
          const data = row.data as { reason?: string };
          const mail = await compose(recipient, {
            kind: row.kind as "timesheet_returned" | "timesheet_reopened",
            month: row.month,
            reason: data.reason ?? "",
          });
          await sendMail({ to: recipient.email, ...mail });
        } else
          console.log(
            `Notification ${row.id} (${row.kind}): no e-mail or inactive employee, not sent.`,
          );
        await tx
          .update(notification)
          .set({ sentAt: now })
          .where(eq(notification.id, row.id));
        return true;
      });
      if (done) sent++;
    } catch (error) {
      failed++;
      console.error(`Notification ${id} failed:`, error);
    }
  }
  return { sent, failed };
}

// ── „Připomenout“ by hand ──

/** One employee's open timesheet of the month (Schvalování → Připomenout). */
export async function remindEmployee(
  writer: Writer,
  employeeId: string,
  month: string,
  now: Date = new Date(),
): Promise<{ name: string }> {
  const view = await getMonth(writer.actor, employeeId, month, now);
  if (!view) throw new UserError(msg("errors.notFound"));
  if (!canRemind(writer.actor, { employeeId, teamId: view.teamId }))
    throw new UserError(msg("timesheets.reminders.errors.cannotRemind"));
  const today = todayInPrague(now);
  const recipient = (await loadRecipients([employeeId])).get(employeeId);
  const target = monthOfEmployee(view, recipient);
  const error = manualReminderError({
    employee: target,
    today,
    sent: await sentKeys("manual", today),
  });
  if (error || !recipient) throw new UserError(error ?? msg("errors.notFound"));
  const sent = await sendManual(writer, recipient, target, month, today);
  if (!sent)
    throw new UserError(msg("timesheets.reminders.errors.alreadyToday"));
  return { name: recipient.name };
}

/**
 * Everyone whose timesheet of the month is still open (Uzávěrka → Připomenout chybějícím): only the
 * employees the writer may remind; others are counted as skipped.
 */
export async function remindMissing(
  writer: Writer,
  month: string,
  now: Date = new Date(),
): Promise<{ count: number; skipped: number }> {
  const { employees: views } = await getTeamMonth(
    writer.actor,
    month,
    "all",
    now,
  );
  const open = views.filter(
    (v) =>
      v.status === "open" &&
      canRemind(writer.actor, { employeeId: v.employee.id, teamId: v.teamId }),
  );
  const today = todayInPrague(now);
  const [recipients, sent] = await Promise.all([
    loadRecipients(open.map((v) => v.employee.id)),
    sentKeys("manual", today),
  ]);
  let count = 0;
  let skipped = 0;
  for (const view of open) {
    const recipient = recipients.get(view.employee.id);
    const target = monthOfEmployee(view, recipient);
    if (!recipient || manualReminderError({ employee: target, today, sent })) {
      skipped++;
      continue;
    }
    try {
      if (await sendManual(writer, recipient, target, month, today)) count++;
      else skipped++;
    } catch {
      // Logged in sendManual; the others still get theirs.
      skipped++;
    }
  }
  return { count, skipped };
}

async function sendManual(
  writer: Writer,
  recipient: Recipient,
  target: MonthOfEmployee,
  month: string,
  today: string,
): Promise<boolean> {
  try {
    return await deliver(
      recipient,
      { kind: "manual", refDate: today },
      { kind: "manual", month, missingDays: target.missingDays },
      writer,
    );
  } catch (error) {
    if (error instanceof UserError) throw error;
    console.error(`Manual reminder to ${recipient.employeeId} failed:`, error);
    throw new UserError(msg("timesheets.reminders.errors.sendFailed"));
  }
}
