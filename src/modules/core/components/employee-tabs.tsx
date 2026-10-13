import { LinkTabs } from "@/components/link-tabs";

export function EmployeeTabs({
  active,
  showImport,
}: {
  active: string;
  showImport: boolean;
}) {
  const tabs = [
    { href: "/timesheets/employees", label: "Zaměstnanci" },
    { href: "/timesheets/employees/teams", label: "Party" },
    ...(showImport
      ? [{ href: "/timesheets/employees/import", label: "Import z Excelu" }]
      : []),
  ];
  return <LinkTabs tabs={tabs} active={active} />;
}
