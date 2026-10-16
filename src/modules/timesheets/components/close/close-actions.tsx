"use client";

import { Check, Info, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Field, FormMessage, valueOf } from "@/components/form/form-parts";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { calendarDate } from "@/i18n/format";
import { initialFormState, type FormState } from "@/lib/form-state";
import { cn } from "@/lib/utils";
import { closePeriodAction, reopenPeriodAction } from "../../actions";

/** One item of the checks before closing, already translated. */
export type CheckItem = {
  code: string;
  level: "ok" | "error" | "info";
  title: string;
  detail: string;
};

const MARK = {
  ok: { icon: Check, className: "bg-success text-success-foreground" },
  error: {
    icon: TriangleAlert,
    className: "bg-warning text-warning-foreground",
  },
  info: { icon: Info, className: "bg-info text-info-foreground" },
} as const;

/** The round mark of a check: ✓ ok, ! error, i info (with a text for screen readers). */
export function CheckMark({
  level,
  label,
}: {
  level: CheckItem["level"];
  label: string;
}) {
  const { icon: Icon, className } = MARK[level];
  return (
    <span
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full",
        className,
      )}
    >
      <Icon className="size-3.5" strokeWidth={2.4} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** List of the checks (Kontrola před uzávěrkou; also in the close dialog). */
export function CheckList({
  checks,
  levelLabel,
}: {
  checks: CheckItem[];
  levelLabel: Record<CheckItem["level"], string>;
}) {
  return (
    <ul className="flex flex-col">
      {checks.map((c) => (
        <li
          key={c.code}
          className="flex items-start gap-3 border-b border-[#eef1f5] py-2.5 last:border-b-0"
        >
          <CheckMark level={c.level} label={levelLabel[c.level]} />
          <div className="min-w-0 text-sm sm:text-[15px]">
            <p className="font-semibold">{c.title}</p>
            <p className="text-muted-foreground">{c.detail}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Closes the dialog after a successful submit. */
function useCloseOnSuccess(state: FormState, close: () => void) {
  useEffect(() => {
    if (state.ok) close();
  }, [state, close]);
}

function Submit({
  children,
  disabled,
}: {
  children: ReactNode;
  disabled?: boolean;
}) {
  const t = useTranslations("common");
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled || pending}>
      {pending ? t("saving") : children}
    </Button>
  );
}

/**
 * „Uzavřít měsíc“: disabled while periodCloseError refuses (its reason is the hint); the dialog
 * shows the checks again and the version that will be stored. The server action checks everything again.
 */
export function CloseMonth({
  month,
  closed,
  version,
  error,
  checks,
  levelLabel,
}: {
  month: string;
  /** The month is closed now. */
  closed: boolean;
  /** Version of the snapshot this close creates. */
  version: number;
  /** Why closing is not possible now (translated), or null. */
  error: string | null;
  checks: CheckItem[];
  levelLabel: Record<CheckItem["level"], string>;
}) {
  const t = useTranslations("timesheets.close");
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(
    closePeriodAction.bind(null, month),
    initialFormState,
  );
  useCloseOnSuccess(state, () => setOpen(false));
  const label = t("closeMonth", { month: calendarDate(month) });
  return (
    <div className="flex flex-col gap-2">
      <span title={error ?? undefined} className="flex flex-col">
        <Button disabled={error !== null} onClick={() => setOpen(true)}>
          {label}
        </Button>
      </span>
      {error && <span className="sr-only">{error}</span>}
      {/* After a reopen the old „closed“ message would be stale. */}
      {state.ok && closed && <FormMessage state={state} />}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("closeQuestion", { month: calendarDate(month) })}
            </DialogTitle>
            <DialogDescription>
              {t("closeDescription", { version })}
            </DialogDescription>
          </DialogHeader>
          <CheckList checks={checks} levelLabel={levelLabel} />
          <form action={action} className="flex flex-col gap-3">
            {!state.ok && <FormMessage state={state} />}
            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>
                {t("cancel")}
              </DialogClose>
              <Submit>{t("closeConfirm")}</Submit>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * „Znovu otevřít“ a closed month: a reason and the employees whose timesheet goes back to open
 * (the others stay approved). The next close stores the next version.
 */
export function ReopenMonth({
  month,
  nextVersion,
  employees,
}: {
  month: string;
  nextVersion: number;
  employees: Array<{ employeeId: string; name: string }>;
}) {
  const t = useTranslations("timesheets.close");
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  const [state, action] = useActionState(
    (prev: FormState, formData: FormData) =>
      reopenPeriodAction(
        month,
        formData.getAll("employeeIds").map(String),
        prev,
        formData,
      ),
    initialFormState,
  );
  useCloseOnSuccess(state, () => setOpen(false));
  const toggle = (id: string, on: boolean) =>
    setChosen((list) => (on ? [...list, id] : list.filter((x) => x !== id)));
  const all = chosen.length === employees.length;
  const employeesError = state.errors?.employeeIds;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center text-[15px] font-medium text-primary underline underline-offset-4 hover:text-primary/80"
      >
        {t("reopen")}
      </button>
      {state.ok && <FormMessage state={state} />}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("reopenTitle", { month: calendarDate(month) })}
            </DialogTitle>
            <DialogDescription>
              {t("reopenDescription", { version: nextVersion })}
            </DialogDescription>
          </DialogHeader>
          <form action={action} className="flex flex-col gap-4">
            {!state.ok && <FormMessage state={state} />}
            <Field
              id={`reopen-reason-${month}`}
              label={t("reopenReason")}
              error={state.errors?.reason}
            >
              <textarea
                id={`reopen-reason-${month}`}
                name="reason"
                rows={2}
                placeholder={t("reopenReasonPlaceholder")}
                defaultValue={valueOf(state, "reason", "")}
                aria-invalid={state.errors?.reason ? true : undefined}
                aria-describedby={
                  state.errors?.reason
                    ? `reopen-reason-${month}-error`
                    : undefined
                }
                className="min-h-16 w-full resize-y rounded-lg border border-input bg-card px-3 py-2 text-[15px] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
              />
            </Field>
            <fieldset
              className="flex flex-col gap-1"
              aria-describedby={
                employeesError ? `reopen-employees-${month}-error` : undefined
              }
            >
              <div className="flex items-center justify-between gap-2">
                <legend className="text-[13px] font-semibold text-[#3a4756]">
                  {t("reopenEmployees")}
                </legend>
                <button
                  type="button"
                  onClick={() =>
                    setChosen(all ? [] : employees.map((e) => e.employeeId))
                  }
                  className="min-h-11 text-sm font-medium text-primary underline underline-offset-4"
                >
                  {all ? t("reopenNone") : t("reopenAll")}
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto rounded-lg border border-border px-3">
                {employees.map((e) => (
                  <label
                    key={e.employeeId}
                    className="flex min-h-11 cursor-pointer items-center gap-3 border-b border-[#eef1f5] text-[15px] last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      name="employeeIds"
                      value={e.employeeId}
                      checked={chosen.includes(e.employeeId)}
                      onChange={(event) =>
                        toggle(e.employeeId, event.target.checked)
                      }
                      className="size-5 accent-primary"
                    />
                    {e.name}
                  </label>
                ))}
              </div>
              {employeesError && (
                <p
                  id={`reopen-employees-${month}-error`}
                  className="text-sm text-destructive"
                >
                  {employeesError}
                </p>
              )}
            </fieldset>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>
                {t("cancel")}
              </DialogClose>
              <Submit>{t("reopenConfirm")}</Submit>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** „Připomenout chybějícím“; e-mail reminders come with the worker (step 4.5), until then disabled. */
export function RemindMissing() {
  const t = useTranslations("timesheets.close");
  return (
    <span title={t("remindHint")} className="flex flex-col">
      <Button variant="outline" disabled>
        {t("remindMissing")}
      </Button>
      <span className="sr-only">{t("remindHint")}</span>
    </span>
  );
}

/** CSV of hours per job for any period (GET to the export route; the browser downloads the file). */
export function JobHoursExport({
  from: initialFrom,
  to: initialTo,
}: {
  from: string;
  to: string;
}) {
  const t = useTranslations("timesheets.close");
  const [from, setFrom] = useState(initialFrom);
  return (
    <form
      method="get"
      action="/timesheets/export/job-hours"
      className="flex flex-col gap-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <Field id="job-hours-from" label={t("jobHoursFrom")}>
          <Input
            id="job-hours-from"
            name="from"
            type="date"
            required
            defaultValue={initialFrom}
            onChange={(event) => setFrom(event.target.value)}
          />
        </Field>
        <Field id="job-hours-to" label={t("jobHoursTo")}>
          <Input
            id="job-hours-to"
            name="to"
            type="date"
            required
            min={from}
            defaultValue={initialTo}
          />
        </Field>
      </div>
      <p className="text-sm text-muted-foreground">{t("jobHoursHint")}</p>
      <button
        type="submit"
        className={cn(buttonVariants({ variant: "outline" }), "self-start")}
      >
        {t("jobHoursDownload")}
      </button>
    </form>
  );
}
