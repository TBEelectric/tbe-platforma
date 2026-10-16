import { io } from "next/cache";
import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ModuleTile } from "@/components/launcher/module-tile";
import { Brand } from "@/components/shell/brand";
import { HeaderUser, UserPlaceholder } from "@/components/shell/user-chip";
import { requireUser } from "@/lib/current-user";
import { capitalize } from "@/i18n/format";
import { todayInPrague } from "@/lib/dates";
import type { Actor } from "@/modules/core";
import { platformModules } from "@/modules/registry";
import { getLauncherTasks } from "@/modules/timesheets";
import { LauncherTasks } from "@/modules/timesheets/components/launcher-tasks";

async function Today() {
  await io();
  const format = await getFormatter();
  return (
    <>{capitalize(format.dateTime(new Date(), "long"), await getLocale())}</>
  );
}

/** „Čeká na vás“: the user's tasks across modules (so far only timesheets). */
async function Waiting({ actor }: { actor: Actor }) {
  await io();
  const now = new Date();
  const tasks = await getLauncherTasks(actor, now);
  return <LauncherTasks tasks={tasks} today={todayInPrague(now)} />;
}

// Auth check blocks the page on the server; layouts do not protect pages, so every page checks itself.
export const instant = false;

export default async function LauncherPage() {
  const user = await requireUser();
  const t = await getTranslations("launcher");
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-[72px] items-center justify-between bg-sidebar px-4 sm:px-8">
        <Link href="/" className="no-underline">
          <Brand />
        </Link>
        <Suspense fallback={<UserPlaceholder />}>
          <HeaderUser />
        </Suspense>
      </header>
      <main className="mx-auto w-full max-w-[1168px] px-4 py-8 sm:px-8 sm:py-16">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-[30px] leading-tight font-bold sm:text-[34px]">
              {t("greeting")}
            </h1>
            <p className="mt-2 text-base text-muted-foreground">
              <Suspense
                fallback={<span className="invisible">{t("today")}</span>}
              >
                <Today />
              </Suspense>{" "}
              · {t("chooseModule")}
            </p>
          </div>
          <Suspense fallback={null}>
            <Waiting actor={user.actor} />
          </Suspense>
        </div>
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {platformModules.map((module) => (
            <li key={module.id} className="grid">
              <ModuleTile module={module} />
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
