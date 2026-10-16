import writeXlsxFile, { type Cell, type Sheet } from "write-excel-file/node";
import { isMsg, msg, type Msg } from "@/i18n/messages";
import { pragueDate, pragueTime } from "@/lib/dates";
import type {
  ExportColumn,
  ExportTable,
  ExportValue,
} from "../rules/export-rows";

// Payroll XLSX: only writes the tables from rules/export-rows.ts. Durations are numbers in hours
// (the accountant sums them), dates are real Excel dates in Prague time.

type Translate = (message: Msg) => string;

/** A calendar date or a Prague wall-clock time as the UTC instant Excel reads as that local time. */
const excelDate = (date: string, time = "00:00") =>
  new Date(`${date}T${time}:00Z`);

function cell(value: ExportValue, column: ExportColumn, tr: Translate): Cell {
  if (value === null) return null;
  switch (column.type) {
    case "minutes":
      return { value: Number(value) / 60, type: Number, format: "0.00" };
    case "date":
      return {
        value: excelDate(String(value)),
        type: Date,
        format: "d.m.yyyy",
      };
    case "dateTime": {
      const instant = value as Date;
      return {
        value: excelDate(pragueDate(instant), pragueTime(instant)),
        type: Date,
        format: "d.m.yyyy h:mm",
      };
    }
    case "flag":
      return value ? tr(msg("timesheets.export.yes")) : null;
    case "messages":
      return (value as Msg[]).map(tr).join("; ") || null;
    default:
      return isMsg(value) ? tr(value) : String(value);
  }
}

function headerCell(column: ExportColumn, tr: Translate): Cell {
  const label = tr(column.header);
  return {
    value:
      column.type === "minutes"
        ? tr(msg("timesheets.export.hoursHeader", { label }))
        : label,
    fontWeight: "bold",
    wrap: true,
    alignVertical: "top",
    bottomBorderStyle: "thin",
  };
}

const WIDTH: Record<ExportColumn["type"], number> = {
  text: 14,
  minutes: 13,
  date: 11,
  dateTime: 15,
  flag: 8,
  messages: 60,
};

/** Text columns as wide as their content (within limits), the others by type. */
function columnWidths(
  table: ExportTable,
  data: Cell[][],
): Array<{ width: number }> {
  return table.columns.map((column, i) => {
    if (column.type !== "text") return { width: WIDTH[column.type] };
    const longest = Math.max(
      0,
      ...data.slice(1).map((row) => {
        const c = row[i];
        return typeof c === "string" ? c.length : 0;
      }),
    );
    return { width: Math.min(40, Math.max(WIDTH.text, longest + 2)) };
  });
}

export async function payrollXlsx(
  sheets: Array<{ name: Msg; table: ExportTable }>,
  tr: Translate,
): Promise<Buffer> {
  const workbook: Sheet<Buffer>[] = sheets.map(({ name, table }) => {
    const data: Cell[][] = [
      table.columns.map((c) => headerCell(c, tr)),
      ...table.rows.map((row) =>
        row.map((value, i) => cell(value, table.columns[i], tr)),
      ),
    ];
    return {
      sheet: tr(name),
      data,
      columns: columnWidths(table, data),
      stickyRowsCount: 1,
    };
  });
  return writeXlsxFile(workbook, {
    fontFamily: "Calibri",
    fontSize: 11,
  }).toBuffer();
}
