/** Result of a form server action (used with useActionState). */
export type FormState = {
  ok?: boolean;
  /** Success or general error message shown above the form. */
  message?: string;
  /** Field errors by field name; "_form" for errors not tied to a field. */
  errors?: Record<string, string>;
  /** Submitted values, so the form keeps them after a failed submit. */
  values?: Record<string, string>;
};

export const initialFormState: FormState = {};

export function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$")) values[key] = value;
  }
  return values;
}

/** Thrown by services for expected business errors; actions turn it into a FormState. */
export class UserError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
  }
}

type PgError = { code?: string; constraint?: string; cause?: unknown };

/** Postgres error code and constraint name (Drizzle wraps the driver error in `cause`). */
export function pgError(error: unknown): {
  code?: string;
  constraint?: string;
} {
  let current = error as PgError | undefined;
  while (current) {
    if (current.code)
      return { code: current.code, constraint: current.constraint };
    current = current.cause as PgError | undefined;
  }
  return {};
}
