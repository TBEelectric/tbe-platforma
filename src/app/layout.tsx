import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TBE platforma",
  description: "Interní aplikace TBE electric",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="cs" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
