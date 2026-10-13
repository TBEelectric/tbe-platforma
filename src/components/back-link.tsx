import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export function BackLink({
  href,
  children,
}: {
  href: string;
  children: string;
}) {
  return (
    <Link
      href={href}
      className="-mb-2 inline-flex min-h-11 items-center gap-1 self-start text-sm"
    >
      <ChevronLeft className="size-4" /> {children}
    </Link>
  );
}
