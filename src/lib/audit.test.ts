import { describe, expect, it, vi } from "vitest";
import { buildAuditChange, writeAudit, type DbExecutor } from "./audit";

describe("buildAuditChange", () => {
  it("stores the full record on create, without bookkeeping timestamps", () => {
    const created = new Date("2026-10-13T08:00:00Z");
    expect(
      buildAuditChange(null, {
        id: "e1",
        firstName: "Jan",
        createdAt: created,
        updatedAt: created,
      }),
    ).toEqual({
      before: null,
      after: { id: "e1", firstName: "Jan" },
    });
  });

  it("stores only changed fields on update", () => {
    expect(
      buildAuditChange(
        { id: "e1", firstName: "Jan", lastName: "Novák", active: true },
        { id: "e1", firstName: "Jan", lastName: "Nováček", active: false },
      ),
    ).toEqual({
      before: { lastName: "Novák", active: true },
      after: { lastName: "Nováček", active: false },
    });
  });

  it("returns null when nothing changed (dates compared by value, updatedAt ignored)", () => {
    expect(
      buildAuditChange(
        { at: new Date("2026-01-01T00:00:00Z"), updatedAt: new Date(1) },
        { at: new Date("2026-01-01T00:00:00Z"), updatedAt: new Date(2) },
      ),
    ).toBeNull();
  });

  it("serializes dates as ISO strings and treats undefined as null", () => {
    expect(
      buildAuditChange(
        { archivedAt: undefined },
        { archivedAt: new Date("2026-10-13T10:00:00Z") },
      ),
    ).toEqual({
      before: { archivedAt: null },
      after: { archivedAt: "2026-10-13T10:00:00.000Z" },
    });
  });

  it("compares nested values structurally", () => {
    expect(
      buildAuditChange({ roles: ["admin"] }, { roles: ["admin"] }),
    ).toBeNull();
    expect(
      buildAuditChange({ roles: ["admin"] }, { roles: [] }),
    ).not.toBeNull();
  });
});

describe("writeAudit", () => {
  function fakeTx() {
    const values = vi.fn().mockResolvedValue(undefined);
    const tx = { insert: vi.fn(() => ({ values })) } as unknown as DbExecutor;
    return { tx, values };
  }

  it("inserts the change with actor, entity, action and trimmed reason", async () => {
    const { tx, values } = fakeTx();
    const written = await writeAudit(tx, {
      actorUserId: "u1",
      entity: "employee",
      entityId: "e1",
      action: "update",
      before: { active: true },
      after: { active: false },
      reason: "  odchod z firmy ",
    });
    expect(written).toBe(true);
    expect(values).toHaveBeenCalledWith({
      actorUserId: "u1",
      entity: "employee",
      entityId: "e1",
      action: "update",
      before: { active: true },
      after: { active: false },
      reason: "odchod z firmy",
    });
  });

  it("writes nothing when the record did not change", async () => {
    const { tx, values } = fakeTx();
    const written = await writeAudit(tx, {
      actorUserId: null,
      entity: "job",
      entityId: "j1",
      action: "update",
      before: { name: "A" },
      after: { name: "A" },
    });
    expect(written).toBe(false);
    expect(values).not.toHaveBeenCalled();
  });
});
