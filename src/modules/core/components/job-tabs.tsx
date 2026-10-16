import { useTranslations } from "next-intl";
import { LinkTabs } from "@/components/link-tabs";

export function JobTabs({ active }: { active: string }) {
  const t = useTranslations("core.tabs");
  return (
    <LinkTabs
      tabs={[
        { href: "/jobs", label: t("jobs") },
        { href: "/jobs/customers", label: t("customers") },
      ]}
      active={active}
    />
  );
}
