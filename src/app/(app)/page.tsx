import { io } from "next/cache";
import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ModuleTile } from "@/components/launcher/module-tile";
import { Brand } from "@/components/shell/brand";
import { HeaderUser, UserPlaceholder } from "@/components/shell/user-chip";
import { requireUser } from "@/lib/current-user";
import { capitalize } from "@/i18n/format";
import { platformModules } from "@/modules/registry";

async function Today() {
  await io();
  const format = await getFormatter();
  return <>{capitalize(format.dateTime(new Date(), "long"), await getLocale())}</>;
}

// Auth check blocks the page on the server; layouts do not protect pages, so every page checks itself.
export const instant = false;

export default async function LauncherPage() {
  await requireUser();
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
