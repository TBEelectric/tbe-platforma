"use client";

import { useActionState, useEffect, useState } from "react";
import {
  Field,
  FormMessage,
  SubmitButton,
  useFields,
  valueOf,
} from "@/components/form/form-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { initialFormState, type FormState } from "@/lib/form-state";
import { cn } from "@/lib/utils";
import {
  createTimeEntryAction,
  deleteTimeEntryAction,
  updateTimeEntryAction,
} from "../../actions";
import type { DayEntryView, DayView } from "../../day";

/** A new interval has nothing to delete. */
async function noDelete(): Promise<FormState> {
  return initialFormState;
}

export type EntryDefaults = {
  from?: string;
  to?: string;
  kind?: "work" | "break";
  jobId?: string | null;
  workTypeId?: string | null;
  note?: string | null;
};

/**
 * Add or edit one interval. On a desktop the fields sit in two rows; in the phone sheet they stack.
 * After a successful save `onDone` is called (the parent remounts the form with new defaults).
 */
export function EntryForm({
  view,
  entry,
  defaults,
  needsReason,
  compact,
  onDone,
  onCancel,
}: {
  view: Pick<DayView, "date" | "employee" | "jobs" | "workTypes">;
  entry?: DayEntryView;
  defaults?: EntryDefaults;
  needsReason: boolean;
  /** Stacked layout for the phone sheet. */
  compact?: boolean;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [state, formAction] = useActionState(
    entry ? updateTimeEntryAction.bind(null, entry.id) : createTimeEntryAction,
    initialFormState,
  );
  const [deleteState, deleteAction] = useActionState(
    entry ? deleteTimeEntryAction.bind(null, entry.id) : noDelete,
    initialFormState,
  );
  const f = useFields(state.errors ? state : deleteState);

  const initial: EntryDefaults = entry
    ? {
        from: entry.from,
        to: entry.to,
        kind: entry.kind,
        jobId: entry.jobId,
        workTypeId: entry.workTypeId,
        note: entry.note,
      }
    : (defaults ?? {});
  const [kind, setKind] = useState(
    valueOf(state, "kind", initial.kind ?? "work"),
  );
  const [workTypeId, setWorkTypeId] = useState(
    valueOf(state, "workTypeId", initial.workTypeId ?? ""),
  );
  const requiresJob =
    view.workTypes.find((w) => w.id === workTypeId)?.requiresJob ?? true;

  useEffect(() => {
    if (state.ok || deleteState.ok) onDone();
  }, [state, deleteState, onDone]);

  const isWork = kind === "work";
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormMessage state={state.errors ? state : deleteState} />
      <input type="hidden" name="employeeId" value={view.employee.id} />
      <input type="hidden" name="workDate" value={view.date} />
      <div
        className={cn(
          "grid grid-cols-2 gap-3",
          !compact && "lg:grid-cols-[8.5rem_8.5rem_10rem_minmax(0,1fr)]",
        )}
      >
        <Field {...f.field("from")} label="Od">
          <Input
            {...f.control("from")}
            type="time"
            defaultValue={valueOf(state, "from", initial.from)}
          />
        </Field>
        <Field {...f.field("to")} label="Do">
          <Input
            {...f.control("to")}
            type="time"
            defaultValue={valueOf(state, "to", initial.to)}
          />
        </Field>
        <Field
          {...f.field("kind")}
          label="Typ"
          className="col-span-2 lg:col-span-1"
        >
          <NativeSelect
            {...f.control("kind")}
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="work">Práce</option>
            <option value="break">Přestávka</option>
          </NativeSelect>
        </Field>
        {isWork && (
          <Field
            {...f.field("jobId")}
            label="Zakázka"
            className={cn("col-span-2", !compact && "lg:col-span-1")}
          >
            <NativeSelect
              {...f.control("jobId")}
              defaultValue={valueOf(state, "jobId", initial.jobId ?? "")}
            >
              <option value="">
                {requiresJob ? "Vyberte zakázku" : "Bez zakázky"}
              </option>
              {view.jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.code} – {j.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}
      </div>
      <div
        className={cn(
          "grid grid-cols-1 gap-3",
          !compact && "lg:grid-cols-[12rem_minmax(0,1fr)_auto] lg:items-end",
        )}
      >
        {isWork ? (
          <Field {...f.field("workTypeId")} label="Druh práce">
            <NativeSelect
              {...f.control("workTypeId")}
              value={workTypeId}
              onChange={(e) => setWorkTypeId(e.target.value)}
            >
              <option value="">Vyberte</option>
              {view.workTypes.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        ) : (
          <div className="hidden lg:block" />
        )}
        <Field {...f.field("note")} label="Poznámka">
          <Input
            {...f.control("note")}
            placeholder="Volitelné"
            defaultValue={valueOf(state, "note", initial.note)}
          />
        </Field>
        {!compact && (
          <Buttons
            editing={!!entry}
            deleteAction={entry ? deleteAction : undefined}
            onCancel={onCancel}
          />
        )}
      </div>
      {needsReason && (
        <Field
          {...f.field("reason")}
          label="Důvod zápisu za zaměstnance"
          hint="Povinné, uloží se do historie změn."
        >
          <Input
            {...f.control("reason")}
            defaultValue={valueOf(state, "reason", "")}
          />
        </Field>
      )}
      {compact && (
        <Buttons
          editing={!!entry}
          deleteAction={entry ? deleteAction : undefined}
          onCancel={onCancel}
          full
        />
      )}
    </form>
  );
}

function Buttons({
  editing,
  deleteAction,
  onCancel,
  full,
}: {
  editing: boolean;
  deleteAction?: (formData: FormData) => void;
  onCancel?: () => void;
  full?: boolean;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", full && "flex-col-reverse")}>
      {editing && deleteAction && (
        <Button
          type="submit"
          variant="destructive"
          formAction={deleteAction}
          className={cn(full && "w-full")}
          onClick={(event) => {
            if (!window.confirm("Smazat interval? Zůstane v historii změn."))
              event.preventDefault();
          }}
        >
          Smazat
        </Button>
      )}
      {onCancel && (
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className={cn(full && "w-full")}
        >
          Zrušit
        </Button>
      )}
      <SubmitButton className={cn(full && "w-full")}>
        {editing ? "Uložit" : "Přidat"}
      </SubmitButton>
    </div>
  );
}
