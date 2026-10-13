import { io } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";
import { ModuleTile } from "@/components/launcher/module-tile";
import { Brand } from "@/components/shell/brand";
import { HeaderUser, UserPlaceholder } from "@/components/shell/user-chip";
import { formatLongDate } from "@/lib/dates";
import { platformModules } from "@/modules/registry";

async function Today() {
  await io();
  return <>{formatLongDate(new Date())}</>;
}

export default function LauncherPage() {
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
          Dobrý den
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          <Suspense fallback={<span className="invisible">Dnes</span>}>
            <Today />
          </Suspense>{" "}
          · vyberte, s čím chcete pracovat
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
