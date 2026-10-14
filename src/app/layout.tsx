import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Figtree } from "next/font/google";
import { cn } from "@/lib/utils";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

// The language comes from the signed-in user (src/i18n/request.ts); every page blocks on the session anyway.
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common");
  return { title: t("appName"), description: t("appDescription") };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      className={cn("h-full font-sans antialiased", figtree.variable)}
    >
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
