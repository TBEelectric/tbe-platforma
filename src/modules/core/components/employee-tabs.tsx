import { useTranslations } from "next-intl";
import { LinkTabs } from "@/components/link-tabs";

export function EmployeeTabs({
  active,
  showImport,
}: {
  active: string;
  showImport: boolean;
}) {
  const t = useTranslations("core.tabs");
  const tabs = [
    { href: "/timesheets/employees", label: t("employees") },
    { href: "/timesheets/employees/teams", label: t("teams") },
    ...(showImport
      ? [{ href: "/timesheets/employees/import", label: t("import") }]
      : []),
  ];
  return <LinkTabs tabs={tabs} active={active} />;
}
