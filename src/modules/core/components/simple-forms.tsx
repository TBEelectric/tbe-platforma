"use client";

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
import { JOB_STATUSES } from "../rules/forms";

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
  const [state, formAction] = useActionState(action, initialFormState);
  const f = useFields(state);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field {...f.field("name")} label="Název party">
          <Input
            {...f.control("name")}
            defaultValue={valueOf(state, "name", initial?.name)}
          />
        </Field>
        <Field {...f.field("leadEmployeeId")} label="Vedoucí">
          <NativeSelect
            {...f.control("leadEmployeeId")}
            defaultValue={valueOf(
              state,
              "leadEmployeeId",
              initial?.leadEmployeeId ?? "",
            )}
          >
            <option value="">Bez vedoucího</option>
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
  const [state, formAction] = useActionState(action, initialFormState);
  const f = useFields(state);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field {...f.field("code")} label="Číslo zakázky">
          <Input
            {...f.control("code")}
            inputMode="numeric"
            defaultValue={valueOf(state, "code", initial?.code)}
          />
        </Field>
        <Field {...f.field("name")} label="Název">
          <Input
            {...f.control("name")}
            defaultValue={valueOf(state, "name", initial?.name)}
          />
        </Field>
        <Field {...f.field("customerId")} label="Zákazník">
          <NativeSelect
            {...f.control("customerId")}
            defaultValue={valueOf(
              state,
              "customerId",
              initial?.customerId ?? "",
            )}
          >
            <option value="">Bez zákazníka</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field
          {...f.field("status")}
          label="Stav"
          hint="Na uzavřenou zakázku nejde zapisovat hodiny."
        >
          <NativeSelect
            {...f.control("status")}
            defaultValue={valueOf(state, "status", initial?.status ?? "active")}
          >
            {Object.entries(JOB_STATUSES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
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
  const [state, formAction] = useActionState(action, initialFormState);
  const f = useFields(state);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field {...f.field("name")} label="Název zákazníka">
          <Input
            {...f.control("name")}
            defaultValue={valueOf(state, "name", initial?.name)}
          />
        </Field>
        <Field {...f.field("ico")} label="IČO" hint="8 číslic, nepovinné">
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
