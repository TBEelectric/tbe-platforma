"use client";

import { FileSpreadsheet, Upload } from "lucide-react";
import { startTransition, useActionState, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { importAction, type ImportState } from "../import/actions";
import type { SheetPreview } from "../import/preview";

const STATUS = {
  new: { label: "Nový", variant: "soft" },
  update: { label: "Změna", variant: "info" },
  unchanged: { label: "Beze změny", variant: "neutral" },
  error: { label: "Chyba", variant: "warning" },
} as const;

function SheetTable({
  sheet,
  showUnchanged,
}: {
  sheet: SheetPreview;
  showUnchanged: boolean;
}) {
  const rows = sheet.rows.filter(
    (r) => showUnchanged || r.status !== "unchanged",
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          List {sheet.sheet}
          <span className="flex flex-wrap gap-1.5 text-sm font-normal">
            {(Object.keys(STATUS) as Array<keyof typeof STATUS>).map((s) =>
              sheet.counts[s] ? (
                <Badge key={s} variant={STATUS[s].variant}>
                  {STATUS[s].label}: {sheet.counts[s]}
                </Badge>
              ) : null,
            )}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sheet.headerError ? (
          <p
            role="alert"
            className="rounded-lg bg-warning px-4 py-3 text-[15px] text-warning-foreground"
          >
            {sheet.headerError}
          </p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground">Žádné změny.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-[13px] text-muted-foreground">
                  <th className="border-b border-border bg-[#f8fafb] px-3 py-2.5 font-semibold">
                    Řádek
                  </th>
                  <th className="border-b border-border bg-[#f8fafb] px-3 py-2.5 font-semibold">
                    Stav
                  </th>
                  <th className="border-b border-border bg-[#f8fafb] px-3 py-2.5 font-semibold">
                    Záznam
                  </th>
                  <th className="border-b border-border bg-[#f8fafb] px-3 py-2.5 font-semibold">
                    Změny / chyby
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.row}
                    className="border-b border-[#eef1f5] align-top last:border-0"
                  >
                    <td className="px-3 py-2.5 tabular-nums">{r.row}</td>
                    <td className="px-3 py-2.5">
                      <Badge variant={STATUS[r.status].variant}>
                        {STATUS[r.status].label}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 font-semibold whitespace-nowrap">
                      {r.label}
                    </td>
                    <td className="px-3 py-2.5">
                      <ul className="flex flex-col gap-0.5">
                        {r.errors.map((e) => (
                          <li key={e} className="text-warning-foreground">
                            {e}
                          </li>
                        ))}
                        {r.changes.map((c) => (
                          <li key={c}>{c}</li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ImportPanel() {
  const [state, formAction, pending] = useActionState<ImportState, FormData>(
    importAction,
    {},
  );
  const [file, setFile] = useState<File | null>(null);
  const [showUnchanged, setShowUnchanged] = useState(false);

  const submit = (mode: "preview" | "apply") => {
    if (!file) return;
    const data = new FormData();
    data.set("file", file);
    data.set("mode", mode);
    startTransition(() => formAction(data));
  };

  const sheets = state.sheets ?? [];
  const hasErrors = sheets.some((s) => s.headerError || s.counts.error > 0);
  const changes = sheets.reduce(
    (n, s) => n + s.counts.new + s.counts.update,
    0,
  );
  const previewed =
    sheets.length > 0 && !state.saved && state.fileName === file?.name;

  return (
    <div className="flex flex-col gap-5">
      <Card className="max-w-3xl">
        <CardContent className="flex flex-col gap-4">
          <label className="flex min-h-11 cursor-pointer flex-wrap items-center gap-3 rounded-lg border border-dashed border-input px-4 py-3">
            <FileSpreadsheet className="size-6 text-primary" />
            <span className="flex-1 text-[15px]">
              {file ? file.name : "Vyberte vyplněnou šablonu (.xlsx)"}
            </span>
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <span className="text-sm font-semibold text-accent-foreground underline">
              Vybrat soubor
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!file || pending}
              onClick={() => submit("preview")}
            >
              <Upload />{" "}
              {pending ? "Kontroluji…" : "Zkontrolovat a zobrazit náhled"}
            </Button>
            {previewed && (
              <Button
                type="button"
                disabled={hasErrors || changes === 0 || pending}
                onClick={() => submit("apply")}
              >
                {pending ? "Ukládám…" : `Uložit změny (${changes})`}
              </Button>
            )}
          </div>
          {state.error && (
            <p
              role="alert"
              className="rounded-lg bg-warning px-4 py-3 text-[15px] text-warning-foreground"
            >
              {state.error}
            </p>
          )}
          {state.saved && (
            <p
              role="status"
              className="rounded-lg bg-success px-4 py-3 text-[15px] text-success-foreground"
            >
              Import uložen: {changes} záznamů nových nebo změněných. Všechny
              změny jsou v historii změn.
            </p>
          )}
          {previewed && hasErrors && (
            <p className="text-[15px] text-warning-foreground">
              Opravte chyby v souboru a zkontrolujte ho znovu. Dokud jsou v
              souboru chyby, nic se neuloží.
            </p>
          )}
        </CardContent>
      </Card>

      {sheets.length > 0 && (
        <>
          <label className="flex min-h-11 items-center gap-3 text-[15px]">
            <input
              type="checkbox"
              className="size-5 accent-primary"
              checked={showUnchanged}
              onChange={(e) => setShowUnchanged(e.target.checked)}
            />
            Zobrazit i řádky beze změny
          </label>
          {sheets.map((s) => (
            <SheetTable key={s.sheet} sheet={s} showUnchanged={showUnchanged} />
          ))}
        </>
      )}
    </div>
  );
}
