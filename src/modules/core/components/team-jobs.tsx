"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import {
  Field,
  FormMessage,
  SubmitButton,
  useFields,
} from "@/components/form/form-parts";
import { NativeSelect } from "@/components/ui/native-select";
import { initialFormState, type FormState } from "@/lib/form-state";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

/** Pins one of the not yet pinned active jobs to the team. */
export function PinJobForm({
  action,
  jobs,
}: {
  action: Action;
  jobs: Array<{ id: string; label: string }>;
}) {
  const t = useTranslations();
  const [state, formAction] = useActionState(action, initialFormState);
  const f = useFields(state);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormMessage state={state} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-64 flex-1">
          <Field {...f.field("jobId")} label={t("core.teamJobs.choose")}>
            <NativeSelect {...f.control("jobId")} defaultValue="">
              <option value="" disabled>
                {t("core.teamJobs.choose")}
              </option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <SubmitButton>{t("core.teamJobs.pin")}</SubmitButton>
      </div>
    </form>
  );
}
