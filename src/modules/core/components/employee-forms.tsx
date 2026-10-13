"use client";

import { useActionState } from "react";
import {
  CheckboxField,
  Field,
  FormMessage,
  SubmitButton,
  useFields,
  valueOf,
} from "@/components/form/form-parts";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { initialFormState, type FormState } from "@/lib/form-state";
import { EMPLOYMENT_TYPES, SCHEDULE_TYPES } from "../rules/forms";

type Option = { id: string; label: string };
type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

type EmployeeValues = {
  personalNumber: string;
  firstName: string;
  lastName: string;
  email: string | null;
  tracksTime: boolean;
};

type EmploymentValues = {
  type: "hpp" | "dpp" | "dpc";
  validFrom: string;
  validTo?: string | null;
  weeklyHours: number | null;
  scheduleType: "flexible" | "uneven";
};

function EmployeeFields({
  state,
  initial,
  canEditEmail,
}: {
  state: FormState;
  initial?: EmployeeValues;
  canEditEmail: boolean;
}) {
  const f = useFields(state);
  return (
    <>
      <Field {...f.field("personalNumber")} label="Osobní číslo">
        <Input
          {...f.control("personalNumber")}
          defaultValue={valueOf(
            state,
            "personalNumber",
            initial?.personalNumber,
          )}
        />
      </Field>
      <Field {...f.field("lastName")} label="Příjmení">
        <Input
          {...f.control("lastName")}
          defaultValue={valueOf(state, "lastName", initial?.lastName)}
        />
      </Field>
      <Field {...f.field("firstName")} label="Jméno">
        <Input
          {...f.control("firstName")}
          defaultValue={valueOf(state, "firstName", initial?.firstName)}
        />
      </Field>
      <Field
        {...f.field("email")}
        label="Přihlašovací e-mail (Google)"
        hint={
          canEditEmail
            ? "S e-mailem se zaměstnanec může přihlásit."
            : "Mění jen administrátor."
        }
      >
        <Input
          {...f.control("email")}
          type="email"
          inputMode="email"
          autoComplete="off"
          readOnly={!canEditEmail}
          className={canEditEmail ? undefined : "bg-muted"}
          defaultValue={valueOf(state, "email", initial?.email)}
        />
      </Field>
      <div className="sm:col-span-2">
        <CheckboxField
          name="tracksTime"
          label="Eviduje docházku"
          defaultChecked={
            state.values
              ? state.values.tracksTime === "on"
              : (initial?.tracksTime ?? true)
          }
        />
      </div>
    </>
  );
}

function EmploymentFields({
  state,
  initial,
  withValidTo,
}: {
  state: FormState;
  initial?: EmploymentValues;
  withValidTo?: boolean;
}) {
  const f = useFields(state);
  return (
    <>
      <Field {...f.field("type")} label="Typ úvazku">
        <NativeSelect
          {...f.control("type")}
          defaultValue={valueOf(state, "type", initial?.type ?? "hpp")}
        >
          {Object.entries(EMPLOYMENT_TYPES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field
        {...f.field("weeklyHours")}
        label="Hodin týdně"
        hint="U DPP prázdné"
      >
        <Input
          {...f.control("weeklyHours")}
          inputMode="decimal"
          defaultValue={valueOf(
            state,
            "weeklyHours",
            initial?.weeklyHours ?? (initial ? null : 40),
          )}
        />
      </Field>
      <Field {...f.field("scheduleType")} label="Režim">
        <NativeSelect
          {...f.control("scheduleType")}
          defaultValue={valueOf(
            state,
            "scheduleType",
            initial?.scheduleType ?? "flexible",
          )}
        >
          {Object.entries(SCHEDULE_TYPES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field {...f.field("validFrom")} label="Platnost od">
        <Input
          {...f.control("validFrom")}
          type="date"
          defaultValue={valueOf(state, "validFrom", initial?.validFrom)}
        />
      </Field>
      {withValidTo && (
        <Field
          {...f.field("validTo")}
          label="Platnost do"
          hint="Prázdné = trvá"
        >
          <Input
            {...f.control("validTo")}
            type="date"
            defaultValue={valueOf(state, "validTo", initial?.validTo)}
          />
        </Field>
      )}
    </>
  );
}

const grid = "grid gap-4 sm:grid-cols-2";

export function NewEmployeeForm({
  action,
  teams,
  canEditEmail,
}: {
  action: Action;
  teams: Option[];
  canEditEmail: boolean;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const f = useFields(state);
  return (
    <form action={formAction} className="flex flex-col gap-6">
      <FormMessage state={state} />
      <section className={grid}>
        <EmployeeFields state={state} canEditEmail={canEditEmail} />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">Úvazek a parta</h2>
        <div className={grid}>
          <EmploymentFields state={state} />
          <Field {...f.field("teamId")} label="Parta">
            <NativeSelect
              {...f.control("teamId")}
              defaultValue={valueOf(state, "teamId", "")}
            >
              <option value="">Bez party</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
      </section>
      <div>
        <SubmitButton>Založit zaměstnance</SubmitButton>
      </div>
    </form>
  );
}

export function EditEmployeeForm({
  action,
  initial,
  canEditEmail,
}: {
  action: Action;
  initial: EmployeeValues;
  canEditEmail: boolean;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormMessage state={state} />
      <div className={grid}>
        <EmployeeFields
          state={state}
          initial={initial}
          canEditEmail={canEditEmail}
        />
      </div>
      <div>
        <SubmitButton>Uložit</SubmitButton>
      </div>
    </form>
  );
}

export function EmploymentForm({
  action,
  initial,
  submitLabel,
  withValidTo,
}: {
  action: Action;
  initial?: EmploymentValues;
  submitLabel: string;
  withValidTo?: boolean;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormMessage state={state} />
      <div className={grid}>
        <EmploymentFields
          state={state}
          initial={initial}
          withValidTo={withValidTo}
        />
      </div>
      <div>
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}

export function TeamChangeForm({
  action,
  teams,
  currentTeamId,
  today,
}: {
  action: Action;
  teams: Option[];
  currentTeamId: string | null;
  today: string;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const f = useFields(state);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormMessage state={state} />
      <div className={grid}>
        <Field {...f.field("teamId")} label="Parta">
          <NativeSelect
            {...f.control("teamId")}
            defaultValue={valueOf(state, "teamId", currentTeamId ?? "")}
          >
            <option value="">Bez party</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field {...f.field("validFrom")} label="Od">
          <Input
            {...f.control("validFrom")}
            type="date"
            defaultValue={valueOf(state, "validFrom", today)}
          />
        </Field>
      </div>
      <div>
        <SubmitButton>Změnit partu</SubmitButton>
      </div>
    </form>
  );
}

export function LeaveForm({
  action,
  year,
  initial,
}: {
  action: Action;
  year: number;
  initial?: { hoursEntitled: number; hoursCarriedOver: number };
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const f = useFields(state);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormMessage state={state} />
      <input type="hidden" name="year" value={year} />
      <div className={grid}>
        <Field {...f.field("hoursEntitled")} label={`Nárok ${year} (h)`}>
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
        <Field {...f.field("hoursCarriedOver")} label="Převod z loňska (h)">
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
        <SubmitButton>Uložit nárok</SubmitButton>
      </div>
    </form>
  );
}

export function RolesForm({
  action,
  initial,
}: {
  action: Action;
  initial: { admin: boolean; timesheetsManager: boolean };
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const checked = (name: keyof typeof initial) =>
    state.values ? state.values[name] === "on" : initial[name];
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormMessage state={state} />
      {state.errors?.admin && (
        <p className="text-sm text-destructive">{state.errors.admin}</p>
      )}
      <CheckboxField
        name="admin"
        label="Administrátor (role a přístupy, zakázky, zaměstnanci)"
        defaultChecked={checked("admin")}
      />
      <CheckboxField
        name="timesheetsManager"
        label="Správce docházky (uzávěrka, export, zaměstnanci, zakázky)"
        defaultChecked={checked("timesheetsManager")}
      />
      <div>
        <SubmitButton>Uložit role</SubmitButton>
      </div>
    </form>
  );
}
