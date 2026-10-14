"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { jobLabel } from "@/modules/core/shared";
import type { TimelineDay } from "../../timeline";
import {
  loadTimelineDayAction,
  timelineAction,
  type TimelineActionInput,
} from "../../timeline-actions";
import {
  jobChipIds,
  localAdjust,
  localCreate,
  localDelete,
  localSetKind,
  SNAP_FINE,
  type AdjustAction,
  type AxisRange,
  type DayTemplateItem,
  type MessageKey,
  type TimelineEntry,
} from "../../shared";

type Command = TimelineActionInput["command"];
/** Looks up the saved id of an entry created a moment ago (the server assigns real ids). */
type Resolve = (id: string) => string;

/**
 * State of the phone timeline: the day as shown (changed at once, "optimistic") and the queue that
 * saves the changes one by one through the server action from 3b.5. After a failed save the day is
 * loaded again and the message is shown. While changes are waiting, a saved day never overwrites
 * the picture, so a quick second change is not lost.
 */
export function useTimeline({
  initial,
  employeeId,
  reason,
}: {
  initial: TimelineDay;
  employeeId: string;
  /** Required (non-empty) when writing for someone else. */
  reason: string | null;
}) {
  const [day, setDay] = useState(initial);
  const [entries, setEntries] = useState<TimelineEntry[]>(initial.entries);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<
    { key: MessageKey } | { text: "saveFailed" } | null
  >(null);

  const queue = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef(0);
  const generation = useRef(0);
  const savedIds = useRef(new Set(initial.entries.map((e) => e.id)));
  const idMap = useRef(new Map<string, string>());
  const tempCounter = useRef(0);
  const reasonRef = useRef(reason);
  useEffect(() => {
    reasonRef.current = reason;
  }, [reason]);

  const apply = useCallback((next: TimelineDay) => {
    savedIds.current = new Set(next.entries.map((e) => e.id));
    setDay(next);
    setEntries(next.entries);
    setSelectedId((id) => {
      const mapped = id ? (idMap.current.get(id) ?? id) : null;
      return mapped && next.entries.some((e) => e.id === mapped)
        ? mapped
        : null;
    });
    idMap.current.clear();
  }, []);

  const recover = useCallback(
    async (error: { key: MessageKey } | { text: "saveFailed" }) => {
      generation.current++;
      pending.current = 0;
      setMessage(error);
      try {
        const fresh = await loadTimelineDayAction(employeeId, initial.date);
        if (fresh) apply(fresh);
      } catch {
        // Offline: the picture stays as it is; the message says nothing was saved.
      }
    },
    [apply, employeeId, initial.date],
  );

  const enqueue = useCallback(
    (build: (resolve: Resolve) => Command, tempId?: string) => {
      const mine = generation.current;
      pending.current++;
      queue.current = queue.current.then(async () => {
        if (mine !== generation.current) return;
        const resolve: Resolve = (id) => idMap.current.get(id) ?? id;
        try {
          const res = await timelineAction({
            employeeId,
            date: initial.date,
            reason: reasonRef.current,
            command: build(resolve),
          });
          if (mine !== generation.current) return;
          if (!res.ok) return recover({ key: res.error });
          if (tempId) {
            const created = res.day.entries.find(
              (e) => !savedIds.current.has(e.id),
            );
            if (created) idMap.current.set(tempId, created.id);
          }
          savedIds.current = new Set(res.day.entries.map((e) => e.id));
          pending.current--;
          if (pending.current === 0) {
            apply(res.day);
          }
        } catch {
          if (mine === generation.current)
            await recover({ text: "saveFailed" });
        }
      });
    },
    [apply, employeeId, initial.date, recover],
  );

  /**
   * Job and work type of a new entry: the last used job (or the team's) and the default work type.
   * Without any history, the first active job by company – until the job picker arrives (3b.7).
   */
  const defaults = useCallback(() => {
    const active = day.jobs.filter((j) => j.active);
    const [jobId] = jobChipIds({
      recentIds: day.recentJobIds,
      currentJobId: null,
      teamJobIds: day.teamJobIds,
      activeJobIds: active.map((j) => j.id),
    });
    const fallback = [...active].sort((a, b) =>
      jobLabel(a).localeCompare(jobLabel(b), "cs"),
    )[0];
    return {
      jobId: jobId ?? fallback?.id ?? null,
      workTypeId: day.defaultWorkTypeId,
    };
  }, [day]);

  /** A new work entry needs a job unless the default work type is overhead; says why not. */
  const ensureCanCreate = useCallback((): boolean => {
    const { jobId, workTypeId } = defaults();
    const needsJob =
      day.workTypes.find((w) => w.id === workTypeId)?.requiresJob ?? true;
    if (jobId || !needsJob) return true;
    setMessage({ key: "timesheets.timeline.noJobForNew" });
    return false;
  }, [day.workTypes, defaults]);

  const nextTempId = () => `tmp-${++tempCounter.current}`;

  /** Saves a new entry that the gesture has already drawn (as `tempId`). */
  const commitCreate = useCallback(
    (tempId: string, range: AxisRange) => {
      const fields = defaults();
      enqueue(
        () => ({ type: "create", ...range, kind: "work", ...fields }),
        tempId,
      );
    },
    [defaults, enqueue],
  );

  /** Saves a finished drag / −/+ of an edge or of the whole entry. */
  const commitAdjust = useCallback(
    (id: string, action: AdjustAction, delta: number, step: 5 | 15) => {
      enqueue((resolve) => ({
        type: "adjust",
        id: resolve(id),
        action,
        delta,
        step,
      }));
    },
    [enqueue],
  );

  /** −/+ in the panel. Returns false when the neighbour is already as short as it can be. */
  const nudge = useCallback(
    (action: "start" | "end", delta: number): boolean => {
      if (!selectedId) return false;
      const next = localAdjust(
        entries,
        day.blocked,
        selectedId,
        action,
        delta,
        {
          maxEnd: day.maxEnd,
          step: SNAP_FINE,
        },
      );
      if (!next) {
        setMessage({ key: "timesheets.errors.cannotMove" });
        return false;
      }
      setEntries(next);
      commitAdjust(selectedId, action, delta, SNAP_FINE);
      return true;
    },
    [commitAdjust, day, entries, selectedId],
  );

  const setKind = useCallback(
    (kind: "work" | "break") => {
      const current = entries.find((e) => e.id === selectedId);
      if (!selectedId || !current || current.kind === kind) return;
      const fields = defaults();
      setEntries(localSetKind(entries, selectedId, kind, fields));
      const id = selectedId;
      enqueue((resolve) =>
        kind === "break"
          ? {
              type: "update",
              id: resolve(id),
              kind,
              jobId: null,
              workTypeId: null,
            }
          : { type: "update", id: resolve(id), kind, ...fields },
      );
    },
    [defaults, enqueue, entries, selectedId],
  );

  /** Job of the selected entry (a break becomes work with the default work type). */
  const setJob = useCallback(
    (jobId: string) => {
      const current = entries.find((e) => e.id === selectedId);
      if (!selectedId || !current) return;
      const workTypeId =
        current.kind === "work" && current.workTypeId
          ? current.workTypeId
          : defaults().workTypeId;
      const id = selectedId;
      setEntries(
        entries.map((e) =>
          e.id === id ? { ...e, kind: "work", jobId, workTypeId } : e,
        ),
      );
      enqueue((resolve) => ({
        type: "update",
        id: resolve(id),
        kind: "work",
        jobId,
        workTypeId,
      }));
    },
    [defaults, enqueue, entries, selectedId],
  );

  const setWorkType = useCallback(
    (workTypeId: string) => {
      if (!selectedId) return;
      const id = selectedId;
      setEntries(entries.map((e) => (e.id === id ? { ...e, workTypeId } : e)));
      enqueue((resolve) => ({
        type: "update",
        id: resolve(id),
        workTypeId,
      }));
    },
    [enqueue, entries, selectedId],
  );

  /** "Obvyklý den" / "Jako včera": the server fills the empty day; the result replaces the picture. */
  const fill = useCallback(
    (source: "usual" | "yesterday") => {
      enqueue(() => ({ type: "fill", source }));
    },
    [enqueue],
  );

  const remove = useCallback(() => {
    if (!selectedId) return;
    const id = selectedId;
    setEntries(localDelete(entries, id));
    setSelectedId(null);
    enqueue((resolve) => ({ type: "delete", id: resolve(id) }));
  }, [enqueue, entries, selectedId]);

  return {
    day,
    entries,
    setEntries,
    selectedId,
    select: setSelectedId,
    message,
    setMessage,
    nextTempId,
    ensureCanCreate,
    commitCreate,
    commitAdjust,
    nudge,
    setKind,
    setJob,
    setWorkType,
    fill,
    setOwnTemplate: (items: DayTemplateItem[]) =>
      setDay((d) => ({ ...d, template: { items, source: "own" } })),
    /** Team jobs changed (pin): only the lists are replaced, never the entries being saved. */
    setTeamJobIds: (teamJobIds: string[]) =>
      setDay((d) => ({ ...d, teamJobIds })),
    remove,
    createLocal: (id: string, range: AxisRange) =>
      setEntries((list) =>
        localCreate(list, id, range, { kind: "work", ...defaults() }),
      ),
  };
}
