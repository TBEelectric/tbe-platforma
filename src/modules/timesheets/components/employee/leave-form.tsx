"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import {
  Field,
  FormMessage,
  SubmitButton,
  useFields,
  valueOf,
} from "@/components/form/form-parts";
import { Input } from "@/components/ui/input";
import { initialFormState, type FormState } from "@/lib/form-state";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export function LeaveForm({
  action,
  year,
  initial,
}: {
  action: Action;
  year: number;
  initial?: { hoursEntitled: number; hoursCarriedOver: number };
}) {
  const t = useTranslations();
  const [state, formAction] = useActionState(action, initialFormState);
  const f = useFields(state);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormMessage state={state} />
      <input type="hidden" name="year" value={year} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          {...f.field("hoursEntitled")}
          label={t("core.form.leaveEntitled", { year: String(year) })}
        >
          <Input
            {...f.control("hoursEntitled")}
            inputMode="decimal"
            defaultValue={valueOf(
              state,
              "hoursEntitled",
              initial?.hoursEntitled ?? "",
            )}
          />
        </Field>
        <Field
          {...f.field("hoursCarriedOver")}
          label={t("core.form.leaveCarried")}
        >
          <Input
            {...f.control("hoursCarriedOver")}
            inputMode="decimal"
            defaultValue={valueOf(
              state,
              "hoursCarriedOver",
              initial?.hoursCarriedOver ?? "",
            )}
          />
        </Field>
      </div>
      <div>
        <SubmitButton>{t("core.form.saveLeave")}</SubmitButton>
      </div>
    </form>
  );
}
