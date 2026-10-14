// How a job is shown to workers (docs/design.md, Zobrazení zakázky). Pure, client-safe.

/** Job colours (prototypes in docs/design/prototypes); on the timeline, chips and totals. */
export const JOB_PALETTE = [
  "#0e7c72",
  "#3a68a8",
  "#7a4fb5",
  "#b45309",
  "#0f766e",
  "#be185d",
  "#4d7c0f",
  "#1d4ed8",
] as const;

/** Colour of work without a job (overhead). */
export const NO_JOB_COLOR = "#5b6877";

export const isJobColor = (value: string): boolean =>
  /^#[0-9a-f]{6}$/i.test(value);

/**
 * The same job has the same colour on every day and screen: the override set in job administration,
 * otherwise one of the palette picked by the id (FNV-1a hash).
 */
export function jobColor(job: { id: string; color?: string | null }): string {
  if (job.color && isJobColor(job.color)) return job.color;
  let hash = 0x811c9dc5;
  for (let i = 0; i < job.id.length; i++) {
    hash ^= job.id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return JOB_PALETTE[hash % JOB_PALETTE.length];
}

/** Czech legal forms, longest first; matched at the end of a company name. */
const LEGAL_FORM =
  /[\s,]+(spol\.\s*s\s*r\.\s*o\.?|s\.\s*r\.\s*o\.?|a\.\s*s\.?|v\.\s*o\.\s*s\.?|k\.\s*s\.?|z\.\s*s\.?|z\.\s*ú\.?|o\.\s*p\.\s*s\.?|s\.\s*p\.?|se)\s*$/i;

/** Company name without the legal form, to keep labels short: "Strojírny Vysočina s.r.o." → "Strojírny Vysočina". */
export function customerShortName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  const short = trimmed.replace(LEGAL_FORM, "").trim();
  return short || trimmed;
}

export type JobLabelInput = {
  name: string;
  customerName: string | null;
  siteName: string | null;
};

/**
 * "Firma, místo" – how workers know a job (no job number). Missing parts are left out;
 * without both the job name is used.
 */
export function jobLabel(job: JobLabelInput): string {
  const parts = [
    job.customerName ? customerShortName(job.customerName) : "",
    job.siteName?.trim() ?? "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : job.name;
}

/**
 * Key that identifies a site of a customer by its short name ("Jihlava, hala A"): case, spacing and
 * surrounding blanks do not matter. Job form and import reuse an existing site with the same key.
 */
export function siteKey(customerId: string | null, siteName: string): string {
  const name = siteName.trim().replace(/\s+/g, " ").toLocaleLowerCase("cs");
  return `${customerId ?? "-"}|${name}`;
}
