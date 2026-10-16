"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import {
  Field,
  FormMessage,
  SubmitButton,
  useFields,
  valueOf,
} from "@/components/form/form-parts";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { initialFormState } from "@/lib/form-state";
import { saveSettingsAction } from "../../actions";
import {
  SETTING_FIELDS,
  SETTING_GROUPS,
  settingInputValue,
  type SettingKind,
} from "../../rules/settings-change";
import type { TimesheetSettings } from "../../rules/settings";

const INPUT: Record<
  SettingKind,
  { type: string; inputMode?: "numeric" | "decimal"; placeholder?: string }
> = {
  time: { type: "time" },
  duration: { type: "text", inputMode: "numeric", placeholder: "H:MM" },
  minutes: { type: "number", inputMode: "numeric" },
  day: { type: "number", inputMode: "numeric" },
  workdays: { type: "number", inputMode: "numeric" },
  hours: { type: "text", inputMode: "decimal" },
};

/**
 * Nastavení modulu: every threshold and deadline in sections, and the date from which the change
 * applies. The server action validates with the same schema (rules/settings-change.ts).
 */
export function SettingsForm({
  current,
  today,
}: {
  current: TimesheetSettings;
  today: string;
}) {
  const t = useTranslations("timesheets.settings");
  const [state, action] = useActionState(saveSettingsAction, initialFormState);
  const f = useFields(state);
  return (
    <form action={action} className="flex flex-col gap-5">
      <FormMessage state={state} />
      {SETTING_GROUPS.map((group) => (
        <Card key={group.id}>
          <CardContent className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-bold">
                {t(`groups.${group.id}.title`)}
              </h2>
              <p className="text-sm text-muted-foreground sm:text-[15px]">
                {t(`groups.${group.id}.description`)}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {group.fields.map((field) => {
                const { kind, min, max } = SETTING_FIELDS[field];
                const input = INPUT[kind];
                const numeric = input.type === "number";
                return (
                  <Field
                    key={field}
                    {...f.field(field)}
                    label={t(`fields.${field}.label`)}
                    hint={t(`fields.${field}.hint`)}
                  >
                    <Input
                      {...f.control(field)}
                      type={input.type}
                      inputMode={input.inputMode}
                      placeholder={input.placeholder}
                      min={numeric ? min : undefined}
                      max={numeric ? max : undefined}
                      step={numeric ? 1 : undefined}
                      required
                      defaultValue={valueOf(
                        state,
                        field,
                        settingInputValue(field, current[field]),
                      )}
                      className="sm:max-w-48"
                    />
                  </Field>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <Field
            {...f.field("validFrom")}
            label={t("validFrom")}
            hint={t("validFromHint")}
          >
            <Input
              {...f.control("validFrom")}
              type="date"
              required
              min={today}
              defaultValue={valueOf(state, "validFrom", today)}
              className="sm:max-w-48"
            />
          </Field>
          <SubmitButton className="sm:mt-6 sm:self-start">
            {t("save")}
          </SubmitButton>
        </CardContent>
      </Card>
    </form>
  );
}
