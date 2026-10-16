"use client";

import { useTranslations } from "next-intl";
import { useId, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { FormState } from "@/lib/form-state";
import { cn } from "@/lib/utils";

/**
 * Ids and ARIA props for the fields of one form. Ids are unique per form (useId), so several
 * forms on one page do not clash.
 */
export function useFields(state: FormState) {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;
  return {
    /** Props for the input/select: id, name, aria-invalid, aria-describedby. */
    control: (name: string) => {
      const error = state.errors?.[name];
      return {
        id: id(name),
        name,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error ? `${id(name)}-error` : undefined,
      };
    },
    /** Props for <Field>: id and error message. */
    field: (name: string) => ({ id: id(name), error: state.errors?.[name] }),
  };
}

/** Label, control and error message. Use with useFields(): <Field {...f.field("x")} label="…"><Input {...f.control("x")} /></Field> */
export function Field({
  id,
  label,
  error,
  hint,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("grid content-start gap-1.5", className)}>
      <Label htmlFor={id} className="text-[13px] font-semibold text-[#3a4756]">
        {label}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** Checkbox with a 44 px touch target. */
export function CheckboxField({
  name,
  label,
  defaultChecked,
  disabled,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px] has-disabled:cursor-default has-disabled:opacity-60">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        disabled={disabled}
        className="size-5 accent-primary"
      />
      {label}
    </label>
  );
}

export function SubmitButton({
  children,
  className,
  disabled,
}: {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const t = useTranslations("common");
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} className={className}>
      {pending ? t("saving") : children}
    </Button>
  );
}

/** Success message or an error not tied to a field. */
export function FormMessage({ state }: { state: FormState }) {
  const error = state.errors?._form;
  if (error) {
    return (
      <p
        role="alert"
        className="rounded-lg bg-warning px-4 py-3 text-[15px] text-warning-foreground"
      >
        {error}
      </p>
    );
  }
  if (state.ok && state.message) {
    return (
      <p
        role="status"
        className="rounded-lg bg-success px-4 py-3 text-[15px] text-success-foreground"
      >
        {state.message}
      </p>
    );
  }
  return null;
}

/** Value to show in a field: what the user submitted (after an error), else the stored value. */
export function valueOf(
  state: FormState,
  name: string,
  fallback: string | number | null | undefined,
): string {
  return state.values?.[name] ?? (fallback == null ? "" : String(fallback));
}
