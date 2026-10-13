// Placeholder for timesheets screens that are not built yet.
// A real screen is a static route (e.g. app/timesheets/day/page.tsx), which takes precedence over this one.
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { timesheetsMenu } from "@/modules/timesheets";

// Temporary page: blocking navigation is fine, no need for a streamed shell.
export const instant = false;

const plannedMilestone: Record<string, number> = {
  day: 3,
  month: 4,
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

  return (
    <>
      <PageHeader title={item.label} subtitle="Připravujeme" />
      <Card>
        <CardContent className="text-[15px] text-muted-foreground">
          Tato obrazovka vznikne v milníku {plannedMilestone[section]} podle
          plánu vývoje.
        </CardContent>
      </Card>
    </>
  );
}
