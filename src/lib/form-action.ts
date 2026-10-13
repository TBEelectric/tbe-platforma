import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { requirePermission, type CurrentUser } from "@/lib/current-user";
import { UserError, formValues, type FormState } from "@/lib/form-state";
import { fieldErrors, type Actor } from "@/modules/core/shared";

/**
 * Shared body of form server actions: requirePermission (server-side check) → Zod validation →
 * run (audited service) → revalidate. Business errors (UserError) become field errors.
 */
export async function handleFormAction<S extends z.ZodType>(
  check: (actor: Actor) => boolean,
  schema: S,
  formData: FormData,
  run: (user: CurrentUser, data: z.infer<S>) => Promise<FormState | void>,
  revalidate: string,
): Promise<FormState> {
  const user = await requirePermission(check);
  const values = formValues(formData);
  const parsed = schema.safeParse(values);
  if (!parsed.success)
    return { ok: false, errors: fieldErrors(parsed.error), values };
  try {
    const result = await run(user, parsed.data);
    revalidatePath(revalidate, "layout");
    return result ?? { ok: true, message: "Uloženo." };
  } catch (error) {
    if (error instanceof UserError) {
      return {
        ok: false,
        errors: { [error.field ?? "_form"]: error.message },
        values,
      };
    }
    throw error;
  }
}
