"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { FormMessage } from "@/components/form/form-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initialFormState } from "@/lib/form-state";
import { cancelAbsenceAction, decideAbsenceAction } from "../../actions";

function ActionButton({
  formAction,
  variant,
  confirm,
  children,
}: {
  formAction: (formData: FormData) => void;
  variant?: "default" | "outline" | "destructive";
  confirm?: string;
  children: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      formAction={formAction}
      disabled={pending}
      onClick={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      {children}
    </Button>
  );
}

/** Approve / reject a request; rejecting needs a reason. */
export function DecideAbsence({ id }: { id: string }) {
  const [approveState, approve] = useActionState(
    decideAbsenceAction.bind(null, id, "approve"),
    initialFormState,
  );
  const [rejectState, reject] = useActionState(
    decideAbsenceAction.bind(null, id, "reject"),
    initialFormState,
  );
  const state = rejectState.errors ? rejectState : approveState;
  return (
    <form className="flex flex-col gap-2">
      <FormMessage state={state} />
      <div className="flex flex-wrap gap-2">
        <Input
          name="reason"
          aria-label="Důvod (povinný při zamítnutí)"
          placeholder="Důvod (při zamítnutí povinný)"
          className="min-w-48 flex-1"
        />
        <ActionButton formAction={approve}>Schválit</ActionButton>
        <ActionButton formAction={reject} variant="outline">
          Zamítnout
        </ActionButton>
      </div>
    </form>
  );
}

/** Cancel an absence; someone else's needs a reason. */
export function CancelAbsence({
  id,
  needsReason,
}: {
  id: string;
  needsReason: boolean;
}) {
  const [state, cancel] = useActionState(
    cancelAbsenceAction.bind(null, id),
    initialFormState,
  );
  return (
    <form className="flex flex-col gap-2">
      <FormMessage state={state} />
      <div className="flex flex-wrap gap-2">
        {needsReason && (
          <Input
            name="reason"
            aria-label="Důvod zrušení"
            placeholder="Důvod zrušení"
            className="min-w-48 flex-1"
          />
        )}
        <ActionButton
          formAction={cancel}
          variant="outline"
          confirm="Zrušit absenci?"
        >
          Zrušit
        </ActionButton>
      </div>
    </form>
  );
}
