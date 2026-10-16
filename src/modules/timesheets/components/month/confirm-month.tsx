"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/form/form-parts";
import { calendarDate } from "@/i18n/format";
import { initialFormState } from "@/lib/form-state";
import { cn } from "@/lib/utils";
import { confirmTimesheetAction } from "../../actions";

/**
 * „Potvrdit měsíc“; disabled while the rules say the month cannot be confirmed yet, with the reason
 * as the button's hint (a disabled button gets no hover, so the wrapper carries the title).
 */
export function ConfirmMonth({
  month,
  label,
  disabled,
  hint,
  className,
}: {
  month: string;
  label: string;
  disabled: boolean;
  hint?: string;
  className?: string;
}) {
  const t = useTranslations("timesheets.month");
  const [state, formAction] = useActionState(
    confirmTimesheetAction.bind(null, month),
    initialFormState,
  );
  return (
    <form
      action={formAction}
      // Confirming locks the month for the employee; ask first so a misclick costs nothing.
      onSubmit={(event) => {
        if (
          !window.confirm(t("confirmQuestion", { month: calendarDate(month) }))
        )
          event.preventDefault();
      }}
      className={cn("flex flex-col gap-2", className)}
    >
      <FormMessage state={state} />
      <span title={hint} className="flex flex-col">
        <SubmitButton disabled={disabled}>{label}</SubmitButton>
      </span>
      {hint && <span className="sr-only">{hint}</span>}
    </form>
  );
}
