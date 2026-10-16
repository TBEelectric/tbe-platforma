/** A file name part without diacritics and spaces: "výkaz 2026-10 Novák Jan" → "vykaz-2026-10-novak-jan". */
export function fileSlug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
