/**
 * The menu item to highlight for a path: the longest href that equals the path or is its parent,
 * so that on /employees/teams only „Party“ is active, not also „Zaměstnanci“ (/employees).
 */
export function activeHref(
  pathname: string,
  hrefs: string[],
): string | undefined {
  return hrefs
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .reduce<string | undefined>(
      (best, href) =>
        best === undefined || href.length > best.length ? href : best,
      undefined,
    );
}
