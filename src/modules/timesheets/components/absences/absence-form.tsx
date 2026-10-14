"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import {
  Field,
  FormMessage,
  SubmitButton,
  useFields,
  valueOf,
} from "@/components/form/form-parts";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { capitalize } from "@/i18n/format";
import { initialFormState } from "@/lib/form-state";
import { createAbsenceAction } from "../../actions";
import { ABSENCE_TYPES } from "../../rules/absence";

/**
 * New absence: the own one is a request; a team lead or the manager can pick someone else, then it
 * is approved at once and needs a reason.
 */
export function AbsenceForm({
  selfId,
  employees,
  today,
}: {
  /** null when the actor has no own attendance. */
  selfId: string | null;
  employees: Array<{ id: string; label: string }>;
  today: string;
}) {
  const t = useTranslations("timesheets");
  const locale = useLocale();
  const [state, formAction] = useActionState(
    createAbsenceAction,
    initialFormState,
  );
  const f = useFields(state);
  const [employeeId, setEmployeeId] = useState(
    valueOf(state, "employeeId", selfId ?? employees[0]?.id ?? ""),
  );
  const forSelf = employeeId === selfId;
  const [dateFrom, setDateFrom] = useState(valueOf(state, "dateFrom", today));

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormMessage state={state} />
      {employees.length > 0 ? (
        <Field {...f.field("employeeId")} label={t("absences.employee")}>
          <NativeSelect
            {...f.control("employeeId")}
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          >
            {selfId && <option value={selfId}>{t("absences.self")}</option>}
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      ) : (
        <input type="hidden" name="employeeId" value={employeeId} />
      )}
      <Field {...f.field("type")} label={t("absences.type")}>
        <NativeSelect
          {...f.control("type")}
          defaultValue={valueOf(state, "type", "vacation")}
        >
          {ABSENCE_TYPES.map((type) => (
            <option key={type} value={type}>
              {capitalize(t(`absenceType.${type}`), locale)}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field {...f.field("dateFrom")} label={t("absences.from")}>
          <Input
            {...f.control("dateFrom")}
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </Field>
        <Field {...f.field("dateTo")} label={t("absences.to")}>
          <Input
            {...f.control("dateTo")}
            type="date"
            min={dateFrom}
            defaultValue={valueOf(state, "dateTo", dateFrom)}
          />
        </Field>
      </div>
      <Field
        {...f.field("hours")}
        label={t("absences.hoursLabel")}
        hint={t("absences.hoursHint")}
      >
        <Input
          {...f.control("hours")}
          inputMode="decimal"
          defaultValue={valueOf(state, "hours", "")}
        />
      </Field>
      <Field {...f.field("note")} label={t("absences.note")}>
        <Input
          {...f.control("note")}
          placeholder={t("absences.optional")}
          defaultValue={valueOf(state, "note", "")}
        />
      </Field>
      {!forSelf && (
        <Field
          {...f.field("reason")}
          label={t("absences.reason")}
          hint={t("absences.reasonHint")}
        >
          <Input
            {...f.control("reason")}
            defaultValue={valueOf(state, "reason", "")}
          />
        </Field>
      )}
      <div>
        <SubmitButton>
          {forSelf ? t("absences.submitRequest") : t("absences.record")}
        </SubmitButton>
      </div>
    </form>
  );
}
