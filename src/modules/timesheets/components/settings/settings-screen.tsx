import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { calendarDate } from "@/i18n/format";
import type { SettingsPageData } from "../../module-settings";
import { SETTING_FIELDS, settingInputValue } from "../../rules/settings-change";
import { SettingsForm } from "./settings-form";

/** Nastavení docházky (timesheets manager): the form and the history of changes by valid_from. */
export function SettingsScreen({ data }: { data: SettingsPageData }) {
  const t = useTranslations("timesheets.settings");
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <SettingsForm current={data.current} today={data.today} />
        <Card>
          <CardContent className="flex flex-col gap-1">
            <h2 className="text-lg font-bold">{t("historyTitle")}</h2>
            <ul className="flex flex-col">
              {data.history.map((version) => (
                <li
                  key={version.validFrom}
                  className="flex flex-col gap-1.5 border-b border-[#eef1f5] py-3 last:border-b-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">
                      {t("historyFrom", {
                        date: calendarDate(version.validFrom),
                      })}
                    </span>
                    {version.planned && (
                      <Badge variant="info">{t("planned")}</Badge>
                    )}
                  </div>
                  <ul className="flex flex-col gap-0.5 text-sm">
                    {version.items.map((item) => (
                      <li
                        key={item.field}
                        className="flex justify-between gap-3"
                      >
                        <span className="text-muted-foreground">
                          {t(`fields.${item.field}.label`)}
                        </span>
                        <span className="font-medium whitespace-nowrap tabular-nums">
                          {t(`value.${SETTING_FIELDS[item.field].kind}`, {
                            value: settingInputValue(item.field, item.value),
                          })}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
