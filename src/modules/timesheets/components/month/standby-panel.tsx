"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  Field,
  FormMessage,
  SubmitButton,
  useFields,
  valueOf,
} from "@/components/form/form-parts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { initialFormState, type FormState } from "@/lib/form-state";
import {
  createStandbyAction,
  deleteStandbyAction,
  updateStandbyAction,
} from "../../actions";

/** One standby of the month as Prague dates and times, with its label for the list. */
export type StandbyItem = {
  id: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  note: string | null;
  label: string;
  duration: string;
};

/**
 * Standby (pohotovost) of the month: a list, and a panel to add, change or delete one. Read-only when
 * the month is locked or the viewer may not write the employee's time; the server checks again.
 */
export function StandbyPanel({
  employeeId,
  items,
  canWrite,
  locked,
  needsReason,
  defaultDate,
}: {
  employeeId: string;
  items: StandbyItem[];
  canWrite: boolean;
  locked: boolean;
  /** Someone else's standby: every change needs a reason. */
  needsReason: boolean;
  defaultDate: string;
}) {
  const t = useTranslations("timesheets.month");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StandbyItem | null>(null);
  const editable = canWrite && !locked;

  const openPanel = (item: StandbyItem | null) => {
    setEditing(item);
    setOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>{t("standbyTitle")}</CardTitle>
        {editable && (
          <Button
            variant="outline"
            size="icon"
            aria-label={t("standbyAdd")}
            title={t("standbyAdd")}
            onClick={() => openPanel(null)}
          >
            <Plus />
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-1 text-[15px]">
        {items.length === 0 && (
          <p className="text-muted-foreground">{t("standbyNone")}</p>
        )}
        {items.map((item) => (
          <div
            key={item.id}
            className="flex min-h-11 items-center justify-between gap-3 border-b border-border py-1.5 last:border-b-0"
          >
            <span className="flex min-w-0 flex-col">
              <span>{item.label}</span>
              {item.note && (
                <span className="truncate text-sm text-muted-foreground">
                  {item.note}
                </span>
              )}
            </span>
            <span className="flex items-center gap-2">
              <span className="font-bold tabular-nums">{item.duration}</span>
              {editable && (
                <Button variant="outline" onClick={() => openPanel(item)}>
                  {t("standbyEdit")}
                </Button>
              )}
            </span>
          </div>
        ))}
        {canWrite && locked && items.length > 0 && (
          <p className="pt-1 text-sm text-muted-foreground">
            {t("standbyLocked")}
          </p>
        )}
        {!canWrite && (
          <p className="pt-1 text-sm text-muted-foreground">
            {t("standbyReadOnly")}
          </p>
        )}
      </CardContent>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {editing ? t("standbyEdit") : t("standbyAdd")}
            </SheetTitle>
          </SheetHeader>
          {open && (
            <StandbyForm
              key={editing?.id ?? "new"}
              employeeId={employeeId}
              item={editing}
              needsReason={needsReason}
              defaultDate={defaultDate}
              onDone={() => setOpen(false)}
            />
          )}
        </SheetContent>
      </Sheet>
    </Card>
  );
}

function StandbyForm({
  employeeId,
  item,
  needsReason,
  defaultDate,
  onDone,
}: {
  employeeId: string;
  item: StandbyItem | null;
  needsReason: boolean;
  defaultDate: string;
  onDone: () => void;
}) {
  const t = useTranslations("timesheets.month");
  const [saveState, save] = useActionState(
    item ? updateStandbyAction.bind(null, item.id) : createStandbyAction,
    initialFormState,
  );
  const [deleteState, remove] = useActionState(
    async (prev: FormState, formData: FormData) =>
      item ? deleteStandbyAction(item.id, prev, formData) : prev,
    initialFormState,
  );
  // The delete form shares the fields; show whichever answered last with an error.
  const state = deleteState.errors ? deleteState : saveState;
  const f = useFields(state);

  useEffect(() => {
    if (saveState.ok || deleteState.ok) onDone();
  }, [saveState, deleteState, onDone]);

  return (
    <form action={save} className="flex flex-col gap-4 px-4 pb-6">
      <FormMessage state={state} />
      <input type="hidden" name="employeeId" value={employeeId} />
      <div className="grid grid-cols-2 gap-3">
        <Field {...f.field("startDate")} label={t("standbyStartDate")}>
          <Input
            {...f.control("startDate")}
            type="date"
            defaultValue={valueOf(
              state,
              "startDate",
              item?.startDate ?? defaultDate,
            )}
          />
        </Field>
        <Field {...f.field("startTime")} label={t("standbyStartTime")}>
          <Input
            {...f.control("startTime")}
            type="time"
            defaultValue={valueOf(
              state,
              "startTime",
              item?.startTime ?? "06:00",
            )}
          />
        </Field>
        <Field {...f.field("endDate")} label={t("standbyEndDate")}>
          <Input
            {...f.control("endDate")}
            type="date"
            defaultValue={valueOf(
              state,
              "endDate",
              item?.endDate ?? defaultDate,
            )}
          />
        </Field>
        <Field {...f.field("endTime")} label={t("standbyEndTime")}>
          <Input
            {...f.control("endTime")}
            type="time"
            defaultValue={valueOf(state, "endTime", item?.endTime ?? "22:00")}
          />
        </Field>
      </div>
      <Field {...f.field("note")} label={t("standbyNote")}>
        <Input
          {...f.control("note")}
          defaultValue={valueOf(state, "note", item?.note ?? "")}
        />
      </Field>
      {needsReason && (
        <Field
          {...f.field("reason")}
          label={t("standbyReason")}
          hint={t("standbyReasonHint")}
        >
          <Input
            {...f.control("reason")}
            defaultValue={valueOf(state, "reason", "")}
          />
        </Field>
      )}
      <div className="flex flex-wrap gap-2">
        <SubmitButton>{t("standbySave")}</SubmitButton>
        {item && (
          <DeleteButton formAction={remove} confirm={t("standbyConfirmDelete")}>
            {t("standbyDelete")}
          </DeleteButton>
        )}
      </div>
    </form>
  );
}

function DeleteButton({
  formAction,
  confirm,
  children,
}: {
  formAction: (formData: FormData) => void;
  confirm: string;
  children: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="outline"
      formAction={formAction}
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm(confirm)) event.preventDefault();
      }}
    >
      {children}
    </Button>
  );
}
