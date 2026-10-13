import { LinkTabs } from "@/components/link-tabs";

export function JobTabs({ active }: { active: string }) {
  return (
    <LinkTabs
      tabs={[
        { href: "/timesheets/jobs", label: "Zakázky" },
        { href: "/timesheets/jobs/customers", label: "Zákazníci" },
      ]}
      active={active}
    />
  );
}
