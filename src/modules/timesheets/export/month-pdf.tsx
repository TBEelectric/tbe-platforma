import path from "node:path";
import {
  Document,
  Font,
  Page,
  renderToBuffer,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { calendarDate } from "@/i18n/format";
import { msg, type MessageValues, type Msg } from "@/i18n/messages";
import { formatMinutes } from "@/lib/duration";
import {
  employmentLabel,
  pdfDayRows,
  pdfTotals,
  warningLine,
  type ExportMonth,
} from "../rules/export-rows";
import { absenceTypeMsg, type TimesheetStatus } from "../rules/time-entry";

// Monthly timesheet PDF (one employee, or everyone of a closed month in one file): only lays out the
// rows from rules/export-rows.ts. Figtree is embedded, so Czech diacritics print everywhere.

const FONTS = path.join(process.cwd(), "src/modules/timesheets/export/fonts");
Font.register({
  family: "Figtree",
  fonts: [
    { src: path.join(FONTS, "Figtree-Regular.ttf"), fontWeight: 400 },
    { src: path.join(FONTS, "Figtree-SemiBold.ttf"), fontWeight: 600 },
  ],
});
// Czech words are not hyphenated by react-pdf's English rules.
Font.registerHyphenationCallback((word) => [word]);

const color = {
  text: "#142433",
  muted: "#5b6877",
  border: "#e2e7ee",
  off: "#eef1f4",
  primary: "#0e7c72",
  draft: "#b42318",
};

const s = StyleSheet.create({
  page: {
    fontFamily: "Figtree",
    fontSize: 8,
    color: color.text,
    paddingTop: 28,
    paddingBottom: 40,
    paddingHorizontal: 32,
  },
  header: { marginBottom: 10 },
  company: { fontSize: 9, fontWeight: 600, color: color.primary },
  title: { fontSize: 15, fontWeight: 600, marginTop: 2 },
  subtitle: { fontSize: 11, marginTop: 2 },
  meta: { color: color.muted, marginTop: 3 },
  draft: { color: color.draft, fontWeight: 600, fontSize: 10, marginTop: 4 },
  table: { borderTopWidth: 1, borderColor: color.border },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderColor: color.border,
    minHeight: 12.5,
    alignItems: "center",
  },
  head: { fontWeight: 600, borderBottomWidth: 1 },
  off: { backgroundColor: color.off },
  cell: { paddingHorizontal: 3, paddingVertical: 1.5 },
  num: { textAlign: "right" },
  section: { marginTop: 10 },
  sectionTitle: { fontSize: 10, fontWeight: 600, marginBottom: 4 },
  totals: { flexDirection: "row", flexWrap: "wrap" },
  total: {
    width: "50%",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 1.5,
    paddingRight: 16,
  },
  warning: { marginBottom: 2 },
  signatures: { flexDirection: "row", marginTop: 24, gap: 40 },
  signature: {
    flex: 1,
    borderTopWidth: 0.5,
    borderColor: color.muted,
    paddingTop: 3,
    color: color.muted,
  },
  footer: {
    position: "absolute",
    bottom: 18,
    left: 32,
    right: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    color: color.muted,
    fontSize: 7.5,
  },
});

/** Widths of the day table: day, intervals, work, breaks, overtime, standby, absence and note. */
const COLUMNS = [
  "10%",
  "31%",
  "7%",
  "8%",
  "7%",
  "8.5%",
  "12.5%",
  "16%",
] as const;

export type MonthPdfItem = {
  month: ExportMonth;
  status: TimesheetStatus;
  /** The snapshot version; null = live data, printed as a working version. */
  closed: { version: number; closedAt: Date } | null;
};

export type PdfTexts = {
  locale: string;
  tr: (message: Msg) => string;
  /** A day of the table in the user's locale, "čt 1. 10.". */
  day: (date: string) => string;
};

type PdfKey =
  | "company"
  | "title"
  | "subtitle"
  | "personalNumber"
  | "version"
  | "draft"
  | "draftNote"
  | "generated"
  | "page"
  | "day"
  | "intervals"
  | "work"
  | "breaks"
  | "overtime"
  | "standby"
  | "absence"
  | "absenceItem"
  | "totals"
  | "warnings"
  | "noWarnings"
  | "signatureEmployee"
  | "signatureLead";

const duration = (minutes: number) => (minutes ? formatMinutes(minutes) : "");
const time = (value: string) => value.replace(/^0(\d)/, "$1");

function EmployeePages({
  item,
  texts,
  generatedAt,
}: {
  item: MonthPdfItem;
  texts: PdfTexts;
  generatedAt: Date;
}) {
  const { tr, day } = texts;
  const pdf = (key: PdfKey, values?: MessageValues) =>
    tr(msg(`timesheets.export.pdf.${key}`, values));
  const m = item.month;
  const name = `${m.employee.firstName} ${m.employee.lastName}`;
  const employment = employmentLabel(m.employment);
  const days = pdfDayRows(m);
  const totals = pdfTotals(m);
  const warnings = m.summary.warnings.map((w) => tr(warningLine(w)));
  const headers = [
    pdf("day"),
    pdf("intervals"),
    pdf("work"),
    pdf("breaks"),
    pdf("overtime"),
    pdf("standby"),
    pdf("absence"),
    tr(msg("timesheets.export.columns.note")),
  ];

  return (
    <Page size="A4" style={s.page}>
      <View style={s.header}>
        <Text style={s.company}>{pdf("company")}</Text>
        <Text style={s.title}>{pdf("title")}</Text>
        <Text style={s.subtitle}>
          {pdf("subtitle", { month: calendarDate(m.summary.month), name })}
        </Text>
        <Text style={s.meta}>
          {[
            pdf("personalNumber", { number: m.employee.personalNumber }),
            employment ? tr(employment) : null,
            item.closed
              ? pdf("version", {
                  closedAt: item.closed.closedAt,
                  version: item.closed.version,
                })
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </Text>
        {!item.closed && (
          <>
            <Text style={s.draft}>{pdf("draft")}</Text>
            <Text style={s.meta}>
              {pdf("draftNote", {
                status: tr(msg(`timesheets.status.${item.status}`)),
              })}
            </Text>
          </>
        )}
      </View>

      <View style={s.table}>
        <View style={[s.row, s.head]} fixed>
          {headers.map((h, i) => (
            <Text
              key={i}
              style={[
                s.cell,
                { width: COLUMNS[i] },
                i >= 2 && i <= 5 ? s.num : {},
              ]}
            >
              {h}
            </Text>
          ))}
        </View>
        {days.map((d) => (
          <View key={d.date} style={[s.row, d.off ? s.off : {}]} wrap={false}>
            <Text style={[s.cell, { width: COLUMNS[0] }]}>{day(d.date)}</Text>
            <Text style={[s.cell, { width: COLUMNS[1] }]}>
              {d.intervals
                .map(
                  (i) =>
                    `${time(i.from)}–${time(i.to)}${i.nextDay ? " (+1)" : ""}`,
                )
                .join(", ")}
            </Text>
            <Text style={[s.cell, s.num, { width: COLUMNS[2] }]}>
              {duration(d.workMinutes)}
            </Text>
            <Text style={[s.cell, s.num, { width: COLUMNS[3] }]}>
              {duration(d.breakMinutes)}
            </Text>
            <Text style={[s.cell, s.num, { width: COLUMNS[4] }]}>
              {duration(d.overtimeMinutes)}
            </Text>
            <Text style={[s.cell, s.num, { width: COLUMNS[5] }]}>
              {duration(d.standbyMinutes)}
            </Text>
            <Text style={[s.cell, { width: COLUMNS[6] }]}>
              {d.absences
                .map((a) =>
                  pdf("absenceItem", {
                    type: absenceTypeMsg(a.type),
                    hours: formatMinutes(a.minutes),
                    requested: a.requested ? "yes" : "no",
                  }),
                )
                .join(", ")}
            </Text>
            <Text style={[s.cell, { width: COLUMNS[7] }]}>
              {d.holidayName ?? ""}
            </Text>
          </View>
        ))}
      </View>

      <View style={s.section} wrap={false}>
        <Text style={s.sectionTitle}>{pdf("totals")}</Text>
        <View style={s.totals}>
          {totals.map((t, i) => (
            <View key={i} style={s.total}>
              <Text>{tr(t.label)}</Text>
              <Text style={{ fontWeight: 600 }}>
                {formatMinutes(t.minutes)}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>{pdf("warnings")}</Text>
        {warnings.length === 0 ? (
          <Text style={{ color: color.muted }}>{pdf("noWarnings")}</Text>
        ) : (
          warnings.map((w, i) => (
            <Text key={i} style={s.warning}>
              {w}
            </Text>
          ))
        )}
      </View>

      <View style={s.signatures} wrap={false}>
        <Text style={s.signature}>{pdf("signatureEmployee")}</Text>
        <Text style={s.signature}>{pdf("signatureLead")}</Text>
      </View>

      <View style={s.footer} fixed>
        <Text>
          {item.closed
            ? `${name} · ${pdf("version", {
                closedAt: item.closed.closedAt,
                version: item.closed.version,
              })}`
            : `${name} · ${pdf("draft")} · ${pdf("generated", { at: generatedAt })}`}
        </Text>
        <Text
          render={({ subPageNumber, subPageTotalPages }) =>
            pdf("page", { page: subPageNumber, pages: subPageTotalPages })
          }
        />
      </View>
    </Page>
  );
}

/**
 * The PDF of one or more employees' months (each starts on a new page). A closed month carries the
 * close time as creation date, so the same snapshot version gives the same file.
 */
export async function monthPdf(
  items: MonthPdfItem[],
  texts: PdfTexts,
  generatedAt: Date = new Date(),
): Promise<Buffer> {
  const closedAt = items.find((i) => i.closed)?.closed?.closedAt;
  const first = items[0]?.month;
  return renderToBuffer(
    <Document
      title={
        first
          ? texts.tr(
              msg("timesheets.export.pdf.subtitle", {
                month: calendarDate(first.summary.month),
                name:
                  items.length === 1
                    ? `${first.employee.firstName} ${first.employee.lastName}`
                    : texts.tr(msg("timesheets.export.pdf.title")),
              }),
            )
          : undefined
      }
      author={texts.tr(msg("timesheets.export.pdf.company"))}
      creator={texts.tr(msg("timesheets.export.pdf.company"))}
      producer={texts.tr(msg("timesheets.export.pdf.company"))}
      language={texts.locale}
      creationDate={closedAt ?? generatedAt}
      modificationDate={closedAt ?? generatedAt}
    >
      {items.map((item) => (
        <EmployeePages
          key={`${item.month.employee.personalNumber}`}
          item={item}
          texts={texts}
          generatedAt={generatedAt}
        />
      ))}
    </Document>,
  );
}
