import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMinutes } from "@/lib/duration";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  detail,
  valueClassName,
}: {
  label: string;
  value: string;
  detail: string;
  valueClassName?: string;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-1">
        <span className="text-sm text-muted-foreground sm:text-[15px]">
          {label}
        </span>
        <span
          className={cn(
            "text-2xl leading-tight font-bold tabular-nums sm:text-[30px]",
            valueClassName,
          )}
        >
          {value}
        </span>
        <span className="text-[13px] text-muted-foreground sm:text-sm">
          {detail}
        </span>
      </CardContent>
    </Card>
  );
}

export function BreakdownCard({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: Array<{
    key: string;
    label: string;
    detail?: string;
    color?: string;
    minutes: number;
  }>;
  empty: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col text-[15px]">
        {rows.length === 0 && <p className="text-muted-foreground">{empty}</p>}
        {rows.map((row) => (
          <div
            key={row.key}
            className="flex items-baseline justify-between gap-3 border-b border-border py-2 first:pt-0 last:border-b-0 last:pb-0"
          >
            <span className="flex min-w-0 items-start gap-2">
              {row.color && (
                <span
                  aria-hidden
                  className="mt-[7px] size-2.5 shrink-0 rounded-full"
                  style={{ background: row.color }}
                />
              )}
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{row.label}</span>
                {row.detail && (
                  <span className="truncate text-sm text-muted-foreground">
                    {row.detail}
                  </span>
                )}
              </span>
            </span>
            <span className="font-bold tabular-nums">
              {formatMinutes(row.minutes)}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
