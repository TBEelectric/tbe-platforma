import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import type { z } from "zod";
import { msg, translate, type Msg } from "@/i18n/messages";
import { requirePermission, type CurrentUser } from "@/lib/current-user";
import { UserError, formValues, type FormState } from "@/lib/form-state";
import { fieldErrors, type Actor } from "@/modules/core/shared";

/**
 * Shared body of form server actions: requirePermission (server-side check) → Zod validation →
 * run (audited service) → revalidate. Business errors (UserError) become field errors. `run` may
 * return the success message (default "Uloženo."); all messages are translated here. `revalidate`
 * null: the action changes nothing the pages show (e.g. sending a reminder), so nothing re-renders.
 */
export async function handleFormAction<S extends z.ZodType>(
  check: (actor: Actor) => boolean,
  schema: S,
  formData: FormData,
  run: (user: CurrentUser, data: z.infer<S>) => Promise<Msg | void>,
  revalidate: string | null,
): Promise<FormState> {
  const user = await requirePermission(check);
  const t = await getTranslations();
  const values = formValues(formData);
  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const [field, message] of Object.entries(fieldErrors(parsed.error)))
      errors[field] = translate(t, message);
    return { ok: false, errors, values };
  }
  try {
    const result = await run(user, parsed.data);
    if (revalidate) revalidatePath(revalidate, "layout");
    return {
      ok: true,
      message: translate(t, result ?? msg("common.saved")),
    };
  } catch (error) {
    if (error instanceof UserError) {
      return {
        ok: false,
        errors: { [error.field ?? "_form"]: translate(t, error.msg) },
        values,
      };
    }
    throw error;
  }
}
