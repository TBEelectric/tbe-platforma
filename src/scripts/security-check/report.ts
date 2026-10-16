// Results of the check and coverage of actions and routes (every one of the build must have a case).

export type Result = {
  suite: string;
  name: string;
  ok: boolean;
  detail?: string;
};

export class CheckFailure extends Error {}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new CheckFailure(message);
}

export class Report {
  readonly results: Result[] = [];
  private readonly covered = new Set<string>();
  private suite = "";

  section(name: string) {
    this.suite = name;
    console.log(`\n── ${name}`);
  }

  /** Marks an action ("file#name") or a route ("/jobs/[id]/page") as checked. */
  cover(...keys: string[]) {
    for (const key of keys) this.covered.add(key);
  }

  async check(name: string, fn: () => Promise<void>): Promise<boolean> {
    try {
      await fn();
      this.results.push({ suite: this.suite, name, ok: true });
      console.log(`  ok    ${name}`);
      return true;
    } catch (error) {
      const detail =
        error instanceof CheckFailure
          ? error.message
          : `unexpected error: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`;
      this.results.push({ suite: this.suite, name, ok: false, detail });
      console.log(
        `  FAIL  ${name}\n        ${detail.split("\n").join("\n        ")}`,
      );
      return false;
    }
  }

  /** Every action and route of the build has a case; a new one without a case fails the check. */
  async coverage(actions: string[], routes: string[]) {
    this.section("Pokrytí");
    for (const [kind, keys] of [
      ["action", actions],
      ["route", routes],
    ] as const)
      await this.check(
        `every ${kind} has a case (${keys.length})`,
        async () => {
          const missing = keys.filter((k) => !this.covered.has(k));
          assert(missing.length === 0, `no case for: ${missing.join(", ")}`);
        },
      );
  }

  get failed(): Result[] {
    return this.results.filter((r) => !r.ok);
  }

  summary(): string {
    const failed = this.failed;
    const lines = [
      `\n${this.results.length - failed.length}/${this.results.length} checks passed`,
    ];
    for (const r of failed)
      lines.push(`  FAIL  [${r.suite}] ${r.name}: ${r.detail}`);
    return lines.join("\n");
  }
}
