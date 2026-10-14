"use client";

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
import { initialFormState } from "@/lib/form-state";
import { createAbsenceAction } from "../../actions";
import { ABSENCE_TYPES } from "../../rules/absence";
import { ABSENCE_TYPE_LABELS } from "../../rules/time-entry";

const capitalize = (text: string) =>
  text.charAt(0).toLocaleUpperCase("cs-CZ") + text.slice(1);

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
        <Field {...f.field("employeeId")} label="Zaměstnanec">
          <NativeSelect
            {...f.control("employeeId")}
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          >
            {selfId && <option value={selfId}>Já (žádost ke schválení)</option>}
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
      <Field {...f.field("type")} label="Typ">
        <NativeSelect
          {...f.control("type")}
          defaultValue={valueOf(state, "type", "vacation")}
        >
          {ABSENCE_TYPES.map((t) => (
            <option key={t} value={t}>
              {capitalize(ABSENCE_TYPE_LABELS[t])}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field {...f.field("dateFrom")} label="Od">
          <Input
            {...f.control("dateFrom")}
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </Field>
        <Field {...f.field("dateTo")} label="Do">
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
        label="Hodin"
        hint="Jen u absence na část jednoho dne (např. lékař). Prázdné = celé dny podle úvazku."
      >
        <Input
          {...f.control("hours")}
          inputMode="decimal"
          defaultValue={valueOf(state, "hours", "")}
        />
      </Field>
      <Field {...f.field("note")} label="Poznámka">
        <Input
          {...f.control("note")}
          placeholder="Volitelné"
          defaultValue={valueOf(state, "note", "")}
        />
      </Field>
      {!forSelf && (
        <Field
          {...f.field("reason")}
          label="Důvod zápisu za zaměstnance"
          hint="Absence se rovnou schválí; důvod se uloží do historie změn."
        >
          <Input
            {...f.control("reason")}
            defaultValue={valueOf(state, "reason", "")}
          />
        </Field>
      )}
      <div>
        <SubmitButton>
          {forSelf ? "Odeslat žádost" : "Zapsat absenci"}
        </SubmitButton>
      </div>
    </form>
  );
}
