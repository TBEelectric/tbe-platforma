import { customerShortName } from "@/modules/core/shared";

// Choosing a job on the timeline (docs/design.md, Mobil – zápis dne na ose): job buttons in the
// panel and the full picker with sections and diacritics-insensitive search.

/** Recently used jobs shown as buttons in the panel (plus the job of the selected entry). */
export const JOB_CHIPS_MAX = 4;
/** Size of the "Naposledy použité" section of the picker. */
export const RECENT_SECTION_MAX = 5;

export type PickerJob = {
  id: string;
  number: string;
  name: string;
  customerName: string | null;
  siteName: string | null;
};

/** Ids of the employee's jobs, most recently used first (work entries; overhead without a job skipped). */
export function recentJobIds(
  uses: Array<{ jobId: string | null; usedAt: Date }>,
): string[] {
  const ids: string[] = [];
  for (const use of [...uses].sort(
    (a, b) => b.usedAt.getTime() - a.usedAt.getTime(),
  ))
    if (use.jobId && !ids.includes(use.jobId)) ids.push(use.jobId);
  return ids;
}

/**
 * Job buttons in the panel: up to 4 recently used active jobs, always also the job of the selected
 * entry (first). Without any history the team's jobs (a new member sees them as buttons).
 */
export function jobChipIds(input: {
  recentIds: string[];
  currentJobId: string | null;
  teamJobIds: string[];
  activeJobIds: string[];
}): string[] {
  const active = new Set(input.activeJobIds);
  const chips = input.recentIds
    .filter((id) => active.has(id))
    .slice(0, JOB_CHIPS_MAX);
  if (input.currentJobId && !chips.includes(input.currentJobId))
    chips.unshift(input.currentJobId);
  if (chips.length === 0)
    return input.teamJobIds.filter((id) => active.has(id));
  return chips;
}

/** Lower case without diacritics: "Úvaly" and "uvaly" match. */
export function normalizeSearch(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Every word of the query is found in the number, name, customer or site. */
export function matchesJob(job: PickerJob, query: string): boolean {
  const haystack = normalizeSearch(
    [job.number, job.name, job.customerName ?? "", job.siteName ?? ""].join(
      " ",
    ),
  );
  return normalizeSearch(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

export type JobSectionKey = "results" | "recent" | "team" | "all";
export type JobSection = { key: JobSectionKey; jobs: PickerJob[] };

const byCustomer = (a: PickerJob, b: PickerJob) =>
  customerShortName(a.customerName ?? "").localeCompare(
    customerShortName(b.customerName ?? ""),
    "cs",
  ) ||
  (a.siteName ?? "").localeCompare(b.siteName ?? "", "cs") ||
  a.number.localeCompare(b.number, "cs");

/**
 * Picker sections over the active jobs. With a query one section of results (none when nothing
 * matches); without it Naposledy použité (5), Zakázky party, Všechny aktivní (other than the team's,
 * by company). Empty sections are left out; closed jobs are not in `jobs` and never shown.
 */
export function jobSections(
  jobs: PickerJob[],
  input: { recentIds: string[]; teamJobIds: string[]; query: string },
): JobSection[] {
  if (input.query.trim()) {
    const hits = jobs
      .filter((j) => matchesJob(j, input.query))
      .sort(byCustomer);
    return hits.length ? [{ key: "results", jobs: hits }] : [];
  }
  const byId = new Map(jobs.map((j) => [j.id, j]));
  const pick = (ids: string[]) =>
    ids
      .map((id) => byId.get(id))
      .filter((j): j is PickerJob => j !== undefined);
  const recent = pick(input.recentIds).slice(0, RECENT_SECTION_MAX);
  const team = pick(input.teamJobIds).sort(byCustomer);
  const teamIds = new Set(team.map((j) => j.id));
  const all = jobs.filter((j) => !teamIds.has(j.id)).sort(byCustomer);
  const sections: JobSection[] = [
    { key: "recent", jobs: recent },
    { key: "team", jobs: team },
    { key: "all", jobs: all },
  ];
  return sections.filter((s) => s.jobs.length > 0);
}
