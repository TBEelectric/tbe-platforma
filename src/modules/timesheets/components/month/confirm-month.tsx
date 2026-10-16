"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/form/form-parts";
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
  const [state, formAction] = useActionState(
    confirmTimesheetAction.bind(null, month),
    initialFormState,
  );
  return (
    <form action={formAction} className={cn("flex flex-col gap-2", className)}>
      <FormMessage state={state} />
      <span title={hint} className="flex flex-col">
        <SubmitButton disabled={disabled}>{label}</SubmitButton>
      </span>
      {hint && <span className="sr-only">{hint}</span>}
    </form>
  );
}
