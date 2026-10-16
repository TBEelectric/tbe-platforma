"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/form/form-parts";
import { initialFormState } from "@/lib/form-state";
import { cn } from "@/lib/utils";
import { confirmTimesheetAction } from "../../actions";

/** „Potvrdit měsíc“; disabled while the rules say the month cannot be confirmed yet (the bar says why). */
export function ConfirmMonth({
  month,
  disabled,
  className,
}: {
  month: string;
  disabled: boolean;
  className?: string;
}) {
  const t = useTranslations("timesheets.month");
  const [state, formAction] = useActionState(
    confirmTimesheetAction.bind(null, month),
    initialFormState,
  );
  return (
    <form action={formAction} className={cn("flex flex-col gap-2", className)}>
      <FormMessage state={state} />
      <SubmitButton disabled={disabled}>{t("confirm")}</SubmitButton>
    </form>
  );
}
