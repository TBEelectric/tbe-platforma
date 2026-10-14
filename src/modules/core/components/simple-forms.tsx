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
import { NativeSelect } from "@/components/ui/native-select";
import { initialFormState, type FormState } from "@/lib/form-state";

type Option = { id: string; label: string };
type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export function TeamForm({
  action,
  employees,
  initial,
  submitLabel,
}: {
  action: Action;
  employees: Option[];
  initial?: { name: string; leadEmployeeId: string | null };
  submitLabel: string;
}) {
  const t = useTranslations();
  const [state, formAction] = useActionState(action, initialFormState);
  const f = useFields(state);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field {...f.field("name")} label={t("core.form.teamName")}>
          <Input
            {...f.control("name")}
            defaultValue={valueOf(state, "name", initial?.name)}
          />
        </Field>
        <Field {...f.field("leadEmployeeId")} label={t("core.form.lead")}>
          <NativeSelect
            {...f.control("leadEmployeeId")}
            defaultValue={valueOf(
              state,
              "leadEmployeeId",
              initial?.leadEmployeeId ?? "",
            )}
          >
            <option value="">{t("core.form.noLead")}</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <div>
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}

export function JobForm({
  action,
  customers,
  initial,
  submitLabel,
}: {
  action: Action;
  customers: Option[];
  initial?: {
    code: string;
    name: string;
    customerId: string | null;
    status: "active" | "closed";
  };
  submitLabel: string;
}) {
  const t = useTranslations();
  const [state, formAction] = useActionState(action, initialFormState);
  const f = useFields(state);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field {...f.field("code")} label={t("core.form.jobCode")}>
          <Input
            {...f.control("code")}
            inputMode="numeric"
            defaultValue={valueOf(state, "code", initial?.code)}
          />
        </Field>
        <Field {...f.field("name")} label={t("core.fields.name")}>
          <Input
            {...f.control("name")}
            defaultValue={valueOf(state, "name", initial?.name)}
          />
        </Field>
        <Field {...f.field("customerId")} label={t("core.fields.customer")}>
          <NativeSelect
            {...f.control("customerId")}
            defaultValue={valueOf(
              state,
              "customerId",
              initial?.customerId ?? "",
            )}
          >
            <option value="">{t("core.form.noCustomer")}</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field
          {...f.field("status")}
          label={t("core.fields.status")}
          hint={t("core.form.jobStatusHint")}
        >
          <NativeSelect
            {...f.control("status")}
            defaultValue={valueOf(state, "status", initial?.status ?? "active")}
          >
            {(["active", "closed"] as const).map((value) => (
              <option key={value} value={value}>
                {t(`core.jobStatus.${value}`)}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <div>
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}

export function CustomerForm({
  action,
  initial,
  submitLabel,
}: {
  action: Action;
  initial?: { name: string; ico: string | null };
  submitLabel: string;
}) {
  const t = useTranslations();
  const [state, formAction] = useActionState(action, initialFormState);
  const f = useFields(state);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field {...f.field("name")} label={t("core.form.customerName")}>
          <Input
            {...f.control("name")}
            defaultValue={valueOf(state, "name", initial?.name)}
          />
        </Field>
        <Field
          {...f.field("ico")}
          label={t("core.form.ico")}
          hint={t("core.form.icoHint")}
        >
          <Input
            {...f.control("ico")}
            inputMode="numeric"
            defaultValue={valueOf(state, "ico", initial?.ico)}
          />
        </Field>
      </div>
      <div>
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
