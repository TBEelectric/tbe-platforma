import { useTranslations } from "next-intl";
import { LinkTabs } from "@/components/link-tabs";

export function JobTabs({ active }: { active: string }) {
  const t = useTranslations("core.tabs");
  return (
    <LinkTabs
      tabs={[
        { href: "/timesheets/jobs", label: t("jobs") },
        { href: "/timesheets/jobs/customers", label: t("customers") },
      ]}
      active={active}
    />
  );
}
