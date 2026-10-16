// Placeholder for timesheets screens that are not built yet.
// A real screen is a static route (e.g. app/timesheets/day/page.tsx), which takes precedence over this one.
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermission } from "@/lib/current-user";
import { timesheetsMenu } from "@/modules/timesheets";

// Blocks on the auth check; layouts do not protect pages, so every page checks itself.
export const instant = false;

const plannedMilestone: Record<string, number> = {
  day: 3,
  absences: 3,
  approval: 4,
  close: 4,
  jobs: 2,
  employees: 2,
  settings: 3,
};

function findItem(section: string) {
  return timesheetsMenu.find((item) => item.href === `/timesheets/${section}`);
}

export function generateStaticParams() {
  return timesheetsMenu.map((item) => ({
    section: item.href.split("/").at(-1)!,
  }));
}

export default async function PlaceholderPage({
  params,
}: PageProps<"/timesheets/[section]">) {
  const { section } = await params;
  const item = findItem(section);
  if (!item) notFound();
  await requirePermission(item.visible);
  const t = await getTranslations();

  return (
    <>
      <PageHeader
        title={t(item.label)}
        subtitle={t("timesheets.placeholder.subtitle")}
      />
      <Card>
        <CardContent className="text-[15px] text-muted-foreground">
          {t("timesheets.placeholder.text", {
            milestone: plannedMilestone[section],
          })}
        </CardContent>
      </Card>
    </>
  );
}
