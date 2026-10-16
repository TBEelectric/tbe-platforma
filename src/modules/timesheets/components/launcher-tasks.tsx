import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { calendarDate } from "@/i18n/format";
import { cn } from "@/lib/utils";
import type { LauncherTask } from "../rules/launcher-tasks";

/** Launcher card „Čeká na vás“ (01-launcher); nothing when no task waits. */
export async function LauncherTasks({
  tasks,
  today,
}: {
  tasks: LauncherTask[];
  today: string;
}) {
  if (tasks.length === 0) return null;
  const t = await getTranslations("launcher.tasks");

  const text = (task: LauncherTask): string => {
    switch (task.kind) {
      case "missingDay":
        return task.more > 0
          ? t("missingDayMore", {
              date: calendarDate(task.date),
              more: task.more,
            })
          : t("missingDay", { date: calendarDate(task.date) });
      case "returned":
        return t("returned", { month: calendarDate(task.month) });
      case "confirm":
        return t("confirm", { month: calendarDate(task.month) });
      case "approve":
        return t(task.leads ? "approveLeads" : "approve", {
          count: task.count,
          month: calendarDate(task.month),
        });
      case "close":
        return t("close", { month: calendarDate(task.month) });
    }
  };
  const detail = (task: LauncherTask): string | null =>
    task.kind === "returned"
      ? t("returnedReason", { reason: task.reason })
      : task.kind === "close" && task.remaining > 0
        ? t("closeRemaining", { remaining: task.remaining })
        : null;
  const urgent = (task: LauncherTask) =>
    task.kind === "missingDay" || task.kind === "returned";

  return (
    <section
      aria-labelledby="launcher-tasks-title"
      className="rounded-xl border border-border bg-card px-5 pt-4 pb-1 lg:w-[505px] lg:shrink-0"
    >
      <h2 id="launcher-tasks-title" className="pb-3 text-base font-bold">
        {t("title")}
      </h2>
      <ul>
        {tasks.map((task) => {
          const extra = detail(task);
          return (
            <li
              key={`${task.kind}-${task.href}`}
              className="border-t border-border"
            >
              <Link
                href={task.href}
                className="-mx-2 flex min-h-[52px] items-center gap-3 rounded-lg px-2 py-2.5 text-foreground no-underline hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <Badge
                  variant={urgent(task) ? "warning" : "soft"}
                  className="shrink-0"
                >
                  {t("module")}
                </Badge>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px]">{text(task)}</span>
                  {extra && (
                    <span className="block text-[13px] break-words text-muted-foreground">
                      {extra}
                    </span>
                  )}
                </span>
                {task.due && (
                  <span
                    className={cn(
                      "shrink-0 text-[13px]",
                      task.due < today
                        ? "font-semibold text-warning-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {task.due === today
                      ? t("today")
                      : t("dueBy", { date: calendarDate(task.due) })}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
