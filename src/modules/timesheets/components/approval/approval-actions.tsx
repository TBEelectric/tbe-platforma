"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Field, FormMessage, valueOf } from "@/components/form/form-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initialFormState } from "@/lib/form-state";
import { cn } from "@/lib/utils";
import {
  bulkApproveAction,
  decideTimesheetAction,
  setOvertimeAction,
} from "../../actions";

/** Submit button that submits its own server action (several buttons share one form). */
function ActionButton({
  action,
  disabled,
  variant,
  className,
  children,
}: {
  action: (formData: FormData) => void;
  disabled?: boolean;
  variant?: "default" | "outline";
  className?: string;
  children: ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      formAction={action}
      variant={variant}
      disabled={disabled || pending}
      className={className}
    >
      {children}
    </Button>
  );
}

/**
 * Detail of a timesheet: the return reason and „Schválit“ / „Vrátit k opravě“. What the viewer may do
 * comes from approvalOverview (the same rules the server action checks again); a refused button
 * carries the reason as its hint.
 */
export function DecisionForm({
  employeeId,
  month,
  canApprove,
  approveHint,
  canReturn,
  returnHint,
  selfApproval,
}: {
  employeeId: string;
  month: string;
  canApprove: boolean;
  approveHint?: string;
  canReturn: boolean;
  returnHint?: string;
  selfApproval: boolean;
}) {
  const t = useTranslations("timesheets.approval");
  const [approveState, approve] = useActionState(
    decideTimesheetAction.bind(null, employeeId, month, "approve"),
    initialFormState,
  );
  const [returnState, back] = useActionState(
    decideTimesheetAction.bind(null, employeeId, month, "return"),
    initialFormState,
  );
  const reasonId = `reason-${employeeId}`;
  const hint = !canApprove ? approveHint : !canReturn ? returnHint : undefined;
  return (
    <form className="flex flex-col gap-3">
      <FormMessage state={approveState} />
      <FormMessage state={returnState} />
      {selfApproval && (
        <p className="rounded-lg bg-info px-3 py-2.5 text-sm text-info-foreground">
          {t("selfApprovalNote")}
        </p>
      )}
      {canReturn && (
        <Field
          id={reasonId}
          label={t("reason")}
          error={returnState.errors?.reason}
        >
          <textarea
            id={reasonId}
            name="reason"
            rows={3}
            placeholder={t("reasonPlaceholder")}
            defaultValue={valueOf(returnState, "reason", "")}
            aria-invalid={returnState.errors?.reason ? true : undefined}
            aria-describedby={
              returnState.errors?.reason ? `${reasonId}-error` : undefined
            }
            className="min-h-20 w-full resize-y rounded-lg border border-input bg-card px-3 py-2 text-[15px] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
          />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3" title={hint}>
        <ActionButton action={approve} disabled={!canApprove}>
          {t("approve")}
        </ActionButton>
        <ActionButton
          action={back}
          disabled={!canReturn}
          variant="outline"
          className="border-[#e0b684] text-[#9a4a06] hover:bg-warning"
        >
          {t("return")}
        </ActionButton>
      </div>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </form>
  );
}

/** „Schválit N bez upozornění“: approves the listed confirmed timesheets (the server checks each again). */
export function BulkApprove({
  month,
  employeeIds,
  className,
}: {
  month: string;
  employeeIds: string[];
  className?: string;
}) {
  const t = useTranslations("timesheets.approval");
  const count = employeeIds.length;
  const [state, action] = useActionState(
    bulkApproveAction.bind(null, month, employeeIds),
    initialFormState,
  );
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(t("bulkQuestion", { count })))
          event.preventDefault();
      }}
      className={cn("flex flex-col gap-2", className)}
    >
      <FormMessage state={state} />
      <span title={count === 0 ? t("bulkNone") : undefined}>
        <BulkButton disabled={count === 0}>{t("bulk", { count })}</BulkButton>
      </span>
      {count === 0 && <span className="sr-only">{t("bulkNone")}</span>}
    </form>
  );
}

function BulkButton({
  disabled,
  children,
}: {
  disabled: boolean;
  children: ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled || pending}>
      {children}
    </Button>
  );
}

/** „Připomenout“ for an employee who has not confirmed; wired to the worker in step 4.5. */
export function RemindButton({ className }: { className?: string }) {
  const t = useTranslations("timesheets.approval");
  return (
    <span title={t("remindHint")} className={className}>
      <Button variant="outline" size="sm" disabled>
        {t("remind")}
      </Button>
    </span>
  );
}

/**
 * Overtime mark of one interval: the button opens a small reason field (a reason is always required,
 * rules/month-changes.ts); saving sets or clears the mark. Remounted by its key after the change.
 */
export function OvertimeToggle({
  entryId,
  overtime,
}: {
  entryId: string;
  overtime: boolean;
}) {
  const t = useTranslations("timesheets.approval");
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(
    setOvertimeAction.bind(null, entryId, !overtime),
    initialFormState,
  );
  const label = overtime ? t("overtimeClear") : t("overtimeMark");
  if (!open)
    return (
      <>
        <FormMessage state={state} />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
        >
          {label}
        </Button>
      </>
    );
  return (
    <form action={action} className="flex flex-col gap-2">
      <FormMessage state={state} />
      <Field
        id={`overtime-${entryId}`}
        label={t("overtimeReason")}
        error={state.errors?.reason}
      >
        <Input
          id={`overtime-${entryId}`}
          name="reason"
          autoFocus
          placeholder={t("overtimeReasonPlaceholder")}
          defaultValue={valueOf(state, "reason", "")}
          aria-invalid={state.errors?.reason ? true : undefined}
          aria-describedby={
            state.errors?.reason ? `overtime-${entryId}-error` : undefined
          }
        />
      </Field>
      <div className="flex gap-2">
        <OvertimeSubmit>{t("overtimeSave")}</OvertimeSubmit>
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
          {t("overtimeCancel")}
        </Button>
      </div>
    </form>
  );
}

function OvertimeSubmit({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {children}
    </Button>
  );
}
