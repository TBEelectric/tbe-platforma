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
    { href: "/employees", label: t("employees") },
    { href: "/employees/teams", label: t("teams") },
    ...(showImport ? [{ href: "/employees/import", label: t("import") }] : []),
  ];
  return <LinkTabs tabs={tabs} active={active} />;
}
