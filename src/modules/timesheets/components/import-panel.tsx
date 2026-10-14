"use client";

import { FileSpreadsheet, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { startTransition, useActionState, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { translate } from "@/i18n/messages";
import { importAction, type ImportState } from "../import/actions";
import type { SheetPreview } from "../import/preview";

const STATUS_VARIANT = {
  new: "soft",
  update: "info",
  unchanged: "neutral",
  error: "warning",
} as const;

function SheetTable({
  sheet,
  showUnchanged,
}: {
  sheet: SheetPreview;
  showUnchanged: boolean;
}) {
  const t = useTranslations();
  const rows = sheet.rows.filter(
    (r) => showUnchanged || r.status !== "unchanged",
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {t("import.sheet", { sheet: sheet.sheet })}
          <span className="flex flex-wrap gap-1.5 text-sm font-normal">
            {(
              Object.keys(STATUS_VARIANT) as Array<keyof typeof STATUS_VARIANT>
            ).map((s) =>
              sheet.counts[s] ? (
                <Badge key={s} variant={STATUS_VARIANT[s]}>
                  {t(`import.status.${s}`)}: {sheet.counts[s]}
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
            {translate(t, sheet.headerError)}
          </p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground">{t("import.noChanges")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-[13px] text-muted-foreground">
                  <th className="border-b border-border bg-[#f8fafb] px-3 py-2.5 font-semibold">
                    {t("import.columns.row")}
                  </th>
                  <th className="border-b border-border bg-[#f8fafb] px-3 py-2.5 font-semibold">
                    {t("import.columns.status")}
                  </th>
                  <th className="border-b border-border bg-[#f8fafb] px-3 py-2.5 font-semibold">
                    {t("import.columns.record")}
                  </th>
                  <th className="border-b border-border bg-[#f8fafb] px-3 py-2.5 font-semibold">
                    {t("import.columns.changes")}
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
                      <Badge variant={STATUS_VARIANT[r.status]}>
                        {t(`import.status.${r.status}`)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 font-semibold whitespace-nowrap">
                      {r.label ?? t("import.rowLabel", { row: r.row })}
                    </td>
                    <td className="px-3 py-2.5">
                      <ul className="flex flex-col gap-0.5">
                        {r.errors.map((e, i) => (
                          <li key={`e${i}`} className="text-warning-foreground">
                            {translate(t, e)}
                          </li>
                        ))}
                        {r.changes.map((c, i) => (
                          <li key={`c${i}`}>{translate(t, c)}</li>
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
  const t = useTranslations();
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
              {file ? file.name : t("import.chooseFile")}
            </span>
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <span className="text-sm font-semibold text-accent-foreground underline">
              {t("import.pickFile")}
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!file || pending}
              onClick={() => submit("preview")}
            >
              <Upload /> {pending ? t("import.checking") : t("import.preview")}
            </Button>
            {previewed && (
              <Button
                type="button"
                disabled={hasErrors || changes === 0 || pending}
                onClick={() => submit("apply")}
              >
                {pending
                  ? t("common.saving")
                  : t("import.save", { count: changes })}
              </Button>
            )}
          </div>
          {state.error && (
            <p
              role="alert"
              className="rounded-lg bg-warning px-4 py-3 text-[15px] text-warning-foreground"
            >
              {translate(t, state.error)}
            </p>
          )}
          {state.saved && (
            <p
              role="status"
              className="rounded-lg bg-success px-4 py-3 text-[15px] text-success-foreground"
            >
              {t("import.saved", { count: changes })}
            </p>
          )}
          {previewed && hasErrors && (
            <p className="text-[15px] text-warning-foreground">
              {t("import.fixErrors")}
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
            {t("import.showUnchanged")}
          </label>
          {sheets.map((s) => (
            <SheetTable key={s.sheet} sheet={s} showUnchanged={showUnchanged} />
          ))}
        </>
      )}
    </div>
  );
}
