import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import { cn } from "@/lib/utils";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "TBE platforma",
  description: "Interní aplikace TBE electric",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="cs"
      className={cn("h-full font-sans antialiased", figtree.variable)}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
