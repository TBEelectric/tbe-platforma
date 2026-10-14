import { msg, type Msg } from "@/i18n/messages";
import { addDays } from "@/lib/dates";

type Period = { id: string; validFrom: string; validTo: string | null };

export type PeriodPlan =
  | { ok: true; close: { id: string; validTo: string } | null }
  | { ok: false; error: Msg };

/**
 * A new period (employment, team membership) starting on `validFrom` follows the latest one.
 * The latest open period is closed the day before. A start on or before the latest start is refused:
 * history is changed by editing the existing record, not by inserting into the middle.
 */
export function planFollowingPeriod(
  existing: Period[],
  validFrom: string,
): PeriodPlan {
  const latest = [...existing].sort((a, b) =>
    b.validFrom.localeCompare(a.validFrom),
  )[0];
  if (!latest) return { ok: true, close: null };
  if (validFrom <= latest.validFrom) {
    return { ok: false, error: msg("core.errors.startAfterLatest") };
  }
  if (latest.validTo && latest.validTo < validFrom)
    return { ok: true, close: null };
  return {
    ok: true,
    close: { id: latest.id, validTo: addDays(validFrom, -1) },
  };
}

/** The period valid on a date, if any. */
export function periodOn<T extends Period>(
  periods: T[],
  date: string,
): T | undefined {
  return periods.find(
    (p) => p.validFrom <= date && (p.validTo === null || p.validTo >= date),
  );
}

/**
 * The last administrator cannot lose the role, and nobody can remove their own administrator role
 * (prevents locking everyone out).
 */
export function adminRemovalError(input: {
  isSelf: boolean;
  otherActiveAdmins: number;
}): Msg | null {
  if (input.isSelf) return msg("core.errors.ownAdminRole");
  if (input.otherActiveAdmins === 0) return msg("core.errors.lastAdmin");
  return null;
}
