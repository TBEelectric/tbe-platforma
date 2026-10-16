import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { calendarDate, capitalize } from "@/i18n/format";
import { translate } from "@/i18n/messages";
import { formatMinutes } from "@/lib/duration";
import { cn } from "@/lib/utils";
import type { MonthLookups, MonthView } from "../../month-data";
import type { ApprovalRow } from "../../rules/approval-overview";
import type { HistoryEvent } from "../../rules/audit-history";
import { DecisionForm, OvertimeToggle, RemindButton } from "./approval-actions";
import { toDetailEntry, EntryRow } from "../month/entry-row";
import { BreakdownRows } from "../month/month-cards";
import { STATUS_VARIANT } from "./status";

/** Detail of one timesheet in Schvalování (docs/design/screens/04-schvalovani). */
export function ApprovalDetail({
  view,
  approval,
  lookups,
  history,
  canMarkOvertime,
  canRemind,
  openAllHref,
  backHref,
  className,
}: {
  view: MonthView;
  approval: ApprovalRow;
  lookups: MonthLookups;
  history: HistoryEvent[] | null;
  /** The viewer may mark overtime on this timesheet's work intervals. */
  canMarkOvertime: boolean;
  /** The viewer may send „Připomenout“ to this employee. */
  canRemind: boolean;
  openAllHref: string;
  /** Phone: back to the list. */
  backHref: string;
  className?: string;
}) {
  const t = useTranslations("timesheets");
  const root = useTranslations();
  const format = useFormatter();
  const locale = useLocale();
  const s = view.summary;
  const month = s.month;
  const name = `${view.employee.firstName} ${view.employee.lastName}`;
  const when =
    view.status === "confirmed"
      ? view.confirmedAt
      : view.status === "approved"
        ? view.approvedAt
        : null;
  const subtitle = when
    ? t(
        view.status === "confirmed"
          ? "approval.detailConfirmed"
          : "approval.detailApproved",
        { month: calendarDate(month), when },
      )
    : view.status === "open"
      ? t("approval.detailNotConfirmed", { month: calendarDate(month) })
      : t("approval.detailMonthOnly", { month: calendarDate(month) });

  const workEntries = view.entries
    .filter((e) => e.kind === "work")
    .map((e) => ({ entry: e, detail: toDetailEntry(e, lookups) }));
  const days = [...new Set(workEntries.map((e) => e.entry.workDate))].sort();
  // The same rule the server action applies (reason is asked for in the toggle itself).
  const toggleable = canMarkOvertime && !view.locked;

  return (
    <Card className={className}>
      <CardContent className="flex flex-col gap-5">
        <Link
          href={backHref}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "w-fit lg:hidden",
          )}
        >
          <ArrowLeft data-icon="inline-start" />
          {t("approval.backToList")}
        </Link>

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-bold">{name}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <Badge variant={STATUS_VARIANT[view.status]}>
            {capitalize(t(`status.${view.status}`), locale)}
          </Badge>
        </div>

        {view.status === "open" && view.returnReason && (
          <p className="rounded-lg bg-warning px-3 py-2.5 text-sm text-warning-foreground">
            {t("approval.returned", { reason: view.returnReason })}
          </p>
        )}

        <section
          aria-labelledby="approval-warnings"
          className="flex flex-col gap-2"
        >
          <h3 id="approval-warnings" className="text-[15px] font-bold">
            {t("approval.warnings")}
          </h3>
          {s.warnings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("approval.noWarnings")}
            </p>
          ) : (
            s.warnings.map((w, i) => (
              <p
                key={`${w.code}-${w.date ?? i}`}
                className="flex items-start gap-3 rounded-[10px] bg-warning px-3 py-2.5 text-sm text-warning-foreground"
              >
                <span className="shrink-0 rounded-full bg-white/60 px-2.5 py-0.5 text-xs font-bold">
                  {t(`approval.warningCode.${w.code}`)}
                </span>
                <span>
                  {w.date &&
                    `${format.dateTime(calendarDate(w.date), "dayMonth")}: `}
                  {translate(root, w.message)}
                </span>
              </p>
            ))
          )}
        </section>

        <section
          aria-labelledby="approval-jobs"
          className="flex flex-col gap-2"
        >
          <h3 id="approval-jobs" className="text-[15px] font-bold">
            {t("approval.byJob")}
          </h3>
          <BreakdownRows
            rows={s.byJob.map((j) => {
              const job = lookups.jobs.find((x) => x.id === j.jobId);
              return {
                key: j.jobId ?? "none",
                label: job ? job.label : t("month.noJob"),
                detail: job && job.name !== job.label ? job.name : undefined,
                color: job?.color,
                minutes: j.minutes,
              };
            })}
            empty={t("month.nothingYet")}
          />
          <p className="flex items-baseline justify-between gap-3 border-t border-border pt-2 text-[15px]">
            <span>{t("approval.overtimeTotal")}</span>
            <span className="font-bold tabular-nums">
              {s.worked.overtimeMinutes > 0
                ? formatMinutes(s.worked.overtimeMinutes)
                : t("approval.overtimeNone")}
            </span>
          </p>
        </section>

        <details className="group rounded-[10px] border border-border">
          <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 px-3 text-[15px] font-bold">
            <span>
              {t("approval.intervals")} ({workEntries.length})
            </span>
          </summary>
          <div className="flex max-h-[28rem] flex-col gap-3 overflow-y-auto border-t border-border px-3 py-3">
            {days.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {t("approval.intervalsEmpty")}
              </p>
            )}
            {days.map((date) => (
              <div key={date}>
                <h4 className="mb-1 text-[13px] font-semibold text-muted-foreground">
                  {capitalize(
                    format.dateTime(calendarDate(date), "weekday"),
                    locale,
                  )}
                </h4>
                <ul>
                  {workEntries
                    .filter((e) => e.entry.workDate === date)
                    .map(({ detail }) => (
                      <EntryRow
                        key={detail.id}
                        entry={detail}
                        extra={
                          toggleable && (
                            <OvertimeToggle
                              key={`${detail.id}-${detail.overtime}`}
                              entryId={detail.id}
                              overtime={detail.overtime}
                            />
                          )
                        }
                      />
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </details>

        <details className="rounded-[10px] border border-border">
          <summary className="flex min-h-11 cursor-pointer items-center px-3 text-[15px] font-bold">
            {t("approval.history")}
            {history ? ` (${history.length})` : ""}
          </summary>
          <ul className="flex max-h-80 flex-col gap-2.5 overflow-y-auto border-t border-border px-3 py-3 text-sm">
            {(history ?? []).length === 0 && (
              <li className="text-muted-foreground">
                {t("approval.historyEmpty")}
              </li>
            )}
            {(history ?? []).map((event) => (
              <li key={event.id} className="flex flex-col">
                <span className="font-semibold">
                  {t(`approval.historyKind.${event.kind}`)}
                  {event.date &&
                    ` · ${format.dateTime(calendarDate(event.date), "dayMonth")}${event.time ? ` ${event.time}` : ""}`}
                </span>
                <span className="text-[13px] text-muted-foreground">
                  {event.actorName
                    ? t("approval.historyBy", {
                        actor: event.actorName,
                        when: event.at,
                      })
                    : t("approval.historySystem", { when: event.at })}
                  {event.selfApproval &&
                    ` · ${t("approval.historySelfApproval")}`}
                </span>
                {event.reason && (
                  <span className="text-[13px] text-muted-foreground">
                    {t("approval.historyReason", { reason: event.reason })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </details>

        <Link
          href={openAllHref}
          className="text-[15px] font-semibold underline"
        >
          {t("approval.openAll")}
        </Link>

        {view.status === "open" ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted px-3 py-3">
            <span className="text-sm text-muted-foreground">
              {t("approval.waitingConfirm")}
            </span>
            {canRemind && !view.periodClosed && (
              <RemindButton
                key={view.employee.id}
                employeeId={view.employee.id}
                month={month}
              />
            )}
          </div>
        ) : (
          <DecisionForm
            key={`${view.employee.id}-${view.status}`}
            employeeId={view.employee.id}
            month={month}
            canApprove={approval.canApprove}
            approveHint={
              approval.approveError
                ? translate(root, approval.approveError)
                : undefined
            }
            canReturn={approval.canReturn}
            returnHint={
              approval.returnError
                ? translate(root, approval.returnError)
                : undefined
            }
            selfApproval={approval.selfApproval}
          />
        )}
      </CardContent>
    </Card>
  );
}
