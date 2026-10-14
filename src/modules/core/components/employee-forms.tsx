"use client";

import { useTranslations } from "next-intl";
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
  const t = useTranslations();
  const f = useFields(state);
  return (
    <>
      <Field
        {...f.field("personalNumber")}
        label={t("core.fields.personalNumber")}
      >
        <Input
          {...f.control("personalNumber")}
          defaultValue={valueOf(
            state,
            "personalNumber",
            initial?.personalNumber,
          )}
        />
      </Field>
      <Field {...f.field("lastName")} label={t("core.fields.lastName")}>
        <Input
          {...f.control("lastName")}
          defaultValue={valueOf(state, "lastName", initial?.lastName)}
        />
      </Field>
      <Field {...f.field("firstName")} label={t("core.fields.firstName")}>
        <Input
          {...f.control("firstName")}
          defaultValue={valueOf(state, "firstName", initial?.firstName)}
        />
      </Field>
      <Field
        {...f.field("email")}
        label={t("core.form.signInEmail")}
        hint={
          canEditEmail
            ? t("core.form.signInEmailHint")
            : t("core.form.signInEmailAdminOnly")
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
          label={t("core.form.tracksTime")}
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
  const t = useTranslations();
  const f = useFields(state);
  return (
    <>
      <Field {...f.field("type")} label={t("core.form.employmentType")}>
        <NativeSelect
          {...f.control("type")}
          defaultValue={valueOf(state, "type", initial?.type ?? "hpp")}
        >
          {(["hpp", "dpp", "dpc"] as const).map((value) => (
            <option key={value} value={value}>
              {t(`core.employmentType.${value}`)}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field
        {...f.field("weeklyHours")}
        label={t("core.form.weeklyHours")}
        hint={t("core.form.weeklyHoursHint")}
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
      <Field {...f.field("scheduleType")} label={t("core.form.scheduleType")}>
        <NativeSelect
          {...f.control("scheduleType")}
          defaultValue={valueOf(
            state,
            "scheduleType",
            initial?.scheduleType ?? "flexible",
          )}
        >
          {(["flexible", "uneven"] as const).map((value) => (
            <option key={value} value={value}>
              {t(`core.scheduleType.${value}`)}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field {...f.field("validFrom")} label={t("core.form.validFrom")}>
        <Input
          {...f.control("validFrom")}
          type="date"
          defaultValue={valueOf(state, "validFrom", initial?.validFrom)}
        />
      </Field>
      {withValidTo && (
        <Field
          {...f.field("validTo")}
          label={t("core.form.validTo")}
          hint={t("core.form.validToHint")}
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
  const t = useTranslations();
  const [state, formAction] = useActionState(action, initialFormState);
  const f = useFields(state);
  return (
    <form action={formAction} className="flex flex-col gap-6">
      <FormMessage state={state} />
      <section className={grid}>
        <EmployeeFields state={state} canEditEmail={canEditEmail} />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">
          {t("core.form.employmentAndTeam")}
        </h2>
        <div className={grid}>
          <EmploymentFields state={state} />
          <Field {...f.field("teamId")} label={t("core.form.team")}>
            <NativeSelect
              {...f.control("teamId")}
              defaultValue={valueOf(state, "teamId", "")}
            >
              <option value="">{t("core.form.noTeam")}</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
      </section>
      <div>
        <SubmitButton>{t("core.form.createEmployee")}</SubmitButton>
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
  const t = useTranslations();
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
        <SubmitButton>{t("core.form.save")}</SubmitButton>
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
  const t = useTranslations();
  const [state, formAction] = useActionState(action, initialFormState);
  const f = useFields(state);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormMessage state={state} />
      <div className={grid}>
        <Field {...f.field("teamId")} label={t("core.form.team")}>
          <NativeSelect
            {...f.control("teamId")}
            defaultValue={valueOf(state, "teamId", currentTeamId ?? "")}
          >
            <option value="">{t("core.form.noTeam")}</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field {...f.field("validFrom")} label={t("core.form.from")}>
          <Input
            {...f.control("validFrom")}
            type="date"
            defaultValue={valueOf(state, "validFrom", today)}
          />
        </Field>
      </div>
      <div>
        <SubmitButton>{t("core.form.changeTeam")}</SubmitButton>
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
  const t = useTranslations();
  const [state, formAction] = useActionState(action, initialFormState);
  const f = useFields(state);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormMessage state={state} />
      <input type="hidden" name="year" value={year} />
      <div className={grid}>
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

export function RolesForm({
  action,
  initial,
}: {
  action: Action;
  initial: { admin: boolean; timesheetsManager: boolean };
}) {
  const t = useTranslations();
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
        label={t("core.form.roleAdmin")}
        defaultChecked={checked("admin")}
      />
      <CheckboxField
        name="timesheetsManager"
        label={t("core.form.roleManager")}
        defaultChecked={checked("timesheetsManager")}
      />
      <div>
        <SubmitButton>{t("core.form.saveRoles")}</SubmitButton>
      </div>
    </form>
  );
}
