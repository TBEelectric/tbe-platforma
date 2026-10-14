import { pragueInstant } from "@/lib/dates";
import { formatMinutes } from "@/lib/duration";
import type { DayEntryView } from "../../day";

const HOUR = 3_600_000;

/** Horizontal bar of the day: work coloured by job, breaks grey, axis at least 6:00–16:00. */
export function DayTimeline({
  date,
  entries,
}: {
  date: string;
  entries: DayEntryView[];
}) {
  const midnight = pragueInstant(date, "00:00")!.getTime();
  const hourOf = (ms: number) => (ms - midnight) / HOUR;
  const first = Math.min(
    6,
    ...entries.map((e) => Math.floor(hourOf(e.startMs))),
  );
  const last = Math.max(16, ...entries.map((e) => Math.ceil(hourOf(e.endMs))));
  const from = first % 2 === 0 ? first : first - 1;
  const to = last % 2 === 0 ? last : last + 1;
  const span = to - from;
  const ticks = Array.from({ length: span / 2 + 1 }, (_, i) => from + i * 2);
  const pct = (hour: number) => `${((hour - from) / span) * 100}%`;

  return (
    <div aria-hidden className="select-none">
      <div className="relative h-8 overflow-hidden rounded-lg bg-[#eef1f4]">
        {entries.map((e) => {
          const start = hourOf(e.startMs);
          const end = hourOf(e.endMs);
          return (
            <div
              key={e.id}
              title={`${e.from}–${e.to} ${e.jobLabel ?? ""} (${formatMinutes(e.minutes)})`}
              className="absolute inset-y-0 rounded-md border-x border-white"
              style={{
                left: pct(start),
                width: `calc(${pct(end)} - ${pct(start)})`,
                background: e.kind === "break" ? "#cfd6de" : e.color,
                opacity:
                  e.kind === "work" && e.workTypeCode === "cesta" ? 0.6 : 1,
              }}
            />
          );
        })}
      </div>
      <div className="relative mt-1.5 h-4 text-[12px] text-muted-foreground">
        {ticks.map((h) => (
          <span
            key={h}
            className="absolute -translate-x-1/2 tabular-nums first:translate-x-0 last:-translate-x-full"
            style={{ left: pct(h) }}
          >
            {h % 24}:00
          </span>
        ))}
      </div>
    </div>
  );
}
