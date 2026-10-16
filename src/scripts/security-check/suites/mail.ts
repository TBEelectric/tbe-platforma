import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { addDays, isWeekend, pragueInstant } from "@/lib/dates";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/mail";
import { employee, roleAssignment } from "@/modules/core/schema";
import {
  runDailyReminders,
  sendPendingNotifications,
} from "@/modules/timesheets/reminders";
import { notification } from "@/modules/timesheets/schema";
import { BASE_URL } from "../config";
import type { Ctx } from "../context";
import {
  absenceMark,
  nameMark,
  noteMark,
  PERSON_CODES,
  standbyMark,
  type Person,
} from "../fixtures";
import { parseMails, type Mail } from "../mail-log";
import { assert } from "../report";

// E-mails: with SMTP_HOST empty sendMail only logs them, so the check reads the server output
// (manual reminders) and runs the worker's functions here with console.log captured. Every e-mail
// goes to the affected person only, carries nobody else's data and links only to BETTER_AUTH_URL.

/** Captures what console.log prints while fn runs (sendMail logs e-mails there). */
async function captured(fn: () => Promise<unknown>): Promise<string> {
  const original = console.log;
  let out = "";
  console.log = (...args: unknown[]) => {
    out += `${args.map(String).join(" ")}\n`;
  };
  try {
    await fn();
  } finally {
    console.log = original;
  }
  return out;
}

const markers = (p: Person) => [
  nameMark(p),
  noteMark(p),
  absenceMark(p),
  standbyMark(p),
];

export async function mailSuite(ctx: Ctx, phase: "manual" | "worker") {
  const { fx, report } = ctx;
  const { ids } = fx;
  const emailOf = (p: Person) => `secchk-${p}@example.invalid`;
  const personOf = new Map(PERSON_CODES.map((p) => [emailOf(p), p]));

  // Who may appear in someone's e-mail: themselves; a lead their team; a manager everyone.
  const managers = new Set(
    (
      await db
        .select({ email: employee.email })
        .from(roleAssignment)
        .innerJoin(employee, eq(employee.id, roleAssignment.employeeId))
        .where(
          and(
            eq(roleAssignment.role, "manager"),
            isNull(roleAssignment.archivedAt),
          ),
        )
    ).map((r) => r.email?.toLowerCase()),
  );
  const visible: Partial<Record<Person, Person[]>> = {
    la: ["ea", "ec", "la", "ar", "de"],
    lb: ["eb", "lb", "ar"],
  };
  const validate = (mails: Mail[]) => {
    const problems: string[] = [];
    for (const m of mails) {
      const to = m.to.toLowerCase();
      const own = personOf.get(to);
      const allowedPeople: Person[] = managers.has(to)
        ? PERSON_CODES
        : own
          ? (visible[own] ?? [own])
          : [];
      for (const p of PERSON_CODES.filter((p) => !allowedPeople.includes(p)))
        if (
          markers(p).some(
            (mark) => m.text.includes(mark) || m.subject.includes(mark),
          )
        )
          problems.push(`${m.to} gets ${p}'s data ("${m.subject}")`);
      for (const url of m.text.match(/https?:\/\/[^\s)>"]+/g) ?? [])
        if (!url.startsWith(`${BASE_URL}/`))
          problems.push(`${m.to}: link ${url}`);
      if (!/^[^@\s]+@[^@\s]+$/.test(m.to))
        problems.push(`bad recipient ${m.to}`);
    }
    return problems;
  };

  if (phase === "manual") {
    report.section("E-maily: ruční připomínky (výstup serveru)");
    const mails = parseMails(ctx.server.output());
    await report.check(
      "manual reminders reached only the affected people",
      async () => {
        assert(appUrl === BASE_URL, `links use ${appUrl}, not BETTER_AUTH_URL`);
        assert(
          mails.some((m) => m.to === emailOf("eb")),
          "the reminder of lead B to eb was not sent",
        );
        const problems = validate(mails);
        assert(problems.length === 0, problems.slice(0, 5).join("; "));
      },
    );
    return;
  }

  report.section("E-maily: fronta notification a denní připomínky (worker)");
  await report.check(
    "queued notifications go to the employee only",
    async () => {
      const queued = await db
        .select()
        .from(notification)
        .where(isNull(notification.sentAt));
      assert(
        queued.some(
          (n) => n.employeeId === ids.eb && n.kind === "timesheet_returned",
        ),
        "the returned month of eb is not queued",
      );
      assert(
        queued.some(
          (n) => n.employeeId === ids.ea && n.kind === "timesheet_reopened",
        ),
        "the reopened month of ea is not queued",
      );
      const mails = parseMails(
        await captured(() => sendPendingNotifications(new Date())),
      );
      const toEb = mails.filter((m) => m.to === emailOf("eb"));
      assert(toEb.length === 1, `${toEb.length} e-mails to eb`);
      assert(
        toEb[0].text.includes("secchk-return-reason"),
        "the reason is missing",
      );
      assert(
        mails.some(
          (m) =>
            m.to === emailOf("ea") && m.text.includes("secchk-reopen-reason"),
        ),
        "no e-mail to ea about the reopened month",
      );
      const problems = validate(mails);
      assert(problems.length === 0, problems.slice(0, 5).join("; "));
      const sent = await db
        .select()
        .from(notification)
        .where(
          and(
            eq(notification.employeeId, ids.eb),
            isNotNull(notification.sentAt),
          ),
        );
      assert(sent.length > 0, "sent_at not set");
    },
  );

  await report.check(
    "daily reminders of a whole month: nobody gets others' data",
    async () => {
      let mails: Mail[] = [];
      for (
        let day = fx.p1;
        day.slice(0, 7) === fx.p1.slice(0, 7);
        day = addDays(day, 1)
      ) {
        if (isWeekend(day)) continue;
        const now = pragueInstant(day, "08:00")!;
        mails = mails.concat(
          parseMails(await captured(() => runDailyReminders(now))),
        );
      }
      assert(mails.length > 0, "no reminder was sent");
      assert(
        mails.some((m) => personOf.has(m.to.toLowerCase())),
        "no reminder for the employees of the check",
      );
      const problems = validate(mails);
      assert(problems.length === 0, problems.slice(0, 5).join("; "));
    },
  );
}
