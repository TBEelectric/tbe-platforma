"use server";

import readExcelFile from "read-excel-file/node";
import { revalidatePath } from "next/cache";
import { msg, type Msg } from "@/i18n/messages";
import { db, type DbOrTx } from "@/lib/db";
import { todayInPrague } from "@/lib/dates";
import { requirePermission } from "@/lib/current-user";
import { canManageAccess } from "../../core/shared";
import {
  EMPLOYEE_SHEET,
  JOB_SHEET,
  parseEmployeeSheet,
  parseJobSheet,
  type Cell,
} from "./parse";
import { planEmployeeImport, planJobImport } from "./plan";
import {
  hasErrors,
  sheetPreview,
  validRows,
  type SheetPreview,
} from "./preview";
import {
  loadEmployeeSnapshot,
  loadJobSnapshot,
  saveEmployeePlan,
  saveJobPlan,
} from "./store";

export type ImportState = {
  fileName?: string;
  sheets?: SheetPreview[];
  /** File-level problem (not an .xlsx, missing sheet…); translated by the client. */
  error?: Msg;
  saved?: boolean;
};

// Next.js limits server action bodies to 1 MB by default; the template is ~25 kB.
const MAX_SIZE = 1024 * 1024;

class ImportChanged extends Error {}

/**
 * mode "preview": parse and plan, nothing is written.
 * mode "apply": parse and plan again inside one transaction and save, only when there are no errors.
 * Administrator only: the import sets sign-in e-mails and roles.
 */
export async function importAction(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const user = await requirePermission(canManageAccess);
  const file = formData.get("file");
  const mode = formData.get("mode") === "apply" ? "apply" : "preview";
  if (!(file instanceof File) || file.size === 0)
    return { error: msg("import.fileErrors.noFile") };
  if (file.size > MAX_SIZE) return { error: msg("import.fileErrors.tooLarge") };

  let sheets: { sheet: string; data: Cell[][] }[];
  try {
    sheets = (await readExcelFile(
      Buffer.from(await file.arrayBuffer()),
    )) as typeof sheets;
  } catch {
    return {
      fileName: file.name,
      error: msg("import.fileErrors.unreadable"),
    };
  }
  const data = (name: string) => sheets.find((s) => s.sheet === name)?.data;
  const employeeData = data(EMPLOYEE_SHEET);
  const jobData = data(JOB_SHEET);
  if (!employeeData && !jobData) {
    return {
      fileName: file.name,
      error: msg("import.fileErrors.missingSheets", {
        employees: EMPLOYEE_SHEET,
        jobs: JOB_SHEET,
      }),
    };
  }

  const employeesParsed = employeeData
    ? parseEmployeeSheet(employeeData)
    : null;
  const jobsParsed = jobData ? parseJobSheet(jobData) : null;
  const today = todayInPrague();
  const year = Number(today.slice(0, 4));

  const plan = async (tx: DbOrTx) => {
    const employeeSnapshot = employeesParsed
      ? await loadEmployeeSnapshot(tx, today, year)
      : null;
    const employeePlan = employeesParsed
      ? planEmployeeImport(validRows(employeesParsed), employeeSnapshot!)
      : null;
    const jobPlan = jobsParsed
      ? planJobImport(validRows(jobsParsed), await loadJobSnapshot(tx))
      : null;
    const previews: SheetPreview[] = [];
    if (employeesParsed)
      previews.push(
        sheetPreview(EMPLOYEE_SHEET, employeesParsed, employeePlan!.previews),
      );
    if (jobsParsed)
      previews.push(sheetPreview(JOB_SHEET, jobsParsed, jobPlan!.previews));
    return { employeeSnapshot, employeePlan, jobPlan, previews };
  };

  if (mode === "preview") {
    const { previews } = await plan(db);
    return { fileName: file.name, sheets: previews };
  }

  try {
    const previews = await db.transaction(async (tx) => {
      const result = await plan(tx);
      if (hasErrors(result.previews)) throw new ImportChanged();
      const ctx = { userId: user.userId };
      // Jobs first: independent of employees; employees then teams, leads, leave, roles.
      if (result.jobPlan) await saveJobPlan(tx, ctx, result.jobPlan);
      if (result.employeePlan)
        await saveEmployeePlan(
          tx,
          ctx,
          result.employeePlan,
          result.employeeSnapshot!,
        );
      return result.previews;
    });
    revalidatePath("/timesheets", "layout");
    return { fileName: file.name, sheets: previews, saved: true };
  } catch (error) {
    if (error instanceof ImportChanged) {
      const { previews } = await plan(db);
      return {
        fileName: file.name,
        sheets: previews,
        error: msg("import.fileErrors.hasErrors"),
      };
    }
    throw error;
  }
}
