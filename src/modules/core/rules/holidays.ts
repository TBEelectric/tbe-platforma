// Czech public holidays (zákon č. 245/2000 Sb.). Pure function; dates as "YYYY-MM-DD".

export type PublicHoliday = { date: string; name: string };

const FIXED: Array<[month: number, day: number, name: string]> = [
  [1, 1, "Den obnovy samostatného českého státu, Nový rok"],
  [5, 1, "Svátek práce"],
  [5, 8, "Den vítězství"],
  [7, 5, "Den slovanských věrozvěstů Cyrila a Metoděje"],
  [7, 6, "Den upálení mistra Jana Husa"],
  [9, 28, "Den české státnosti"],
  [10, 28, "Den vzniku samostatného československého státu"],
  [11, 17, "Den boje za svobodu a demokracii a Mezinárodní den studentstva"],
  [12, 24, "Štědrý den"],
  [12, 25, "1. svátek vánoční"],
  [12, 26, "2. svátek vánoční"],
];

/** Good Friday is a public holiday since 2016. */
const GOOD_FRIDAY_SINCE = 2016;
const FIRST_SUPPORTED_YEAR = 2001;

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Shifts a "YYYY-MM-DD" date by whole days (calendar arithmetic in UTC, no time zone involved). */
function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Western (Gregorian) Easter Sunday, anonymous Gregorian algorithm (Meeus/Jones/Butcher). */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return isoDate(year, month, day);
}

export function czechPublicHolidays(year: number): PublicHoliday[] {
  if (!Number.isInteger(year) || year < FIRST_SUPPORTED_YEAR) {
    throw new RangeError(`Unsupported year ${year}`);
  }
  const easter = easterSunday(year);
  const holidays: PublicHoliday[] = FIXED.map(([month, day, name]) => ({
    date: isoDate(year, month, day),
    name,
  }));
  if (year >= GOOD_FRIDAY_SINCE)
    holidays.push({ date: addDays(easter, -2), name: "Velký pátek" });
  holidays.push({ date: addDays(easter, 1), name: "Velikonoční pondělí" });
  return holidays.sort((x, y) => x.date.localeCompare(y.date));
}
