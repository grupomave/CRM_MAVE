import "server-only";

import { PassThrough, Readable } from "node:stream";
import ExcelJS from "exceljs";

// Gera uma planilha .xlsx em streaming (ExcelJS WorkbookWriter): as linhas
// são escritas e enviadas ao navegador à medida que ficam prontas, sem
// montar o arquivo inteiro em memória.

export type CellType = "text" | "number" | "currency" | "date" | "datetime";
export type CellValue = string | number | Date | null | undefined;

export interface ExportColumn<T> {
  header: string;
  type?: CellType;
  value: (row: T) => CellValue;
  /** Largura mínima (em caracteres); o restante é ajustado pelo conteúdo */
  minWidth?: number;
}

const TIME_ZONE = "America/Sao_Paulo";

const NUM_FMT: Record<CellType, string | undefined> = {
  text: undefined,
  number: "#,##0",
  currency: '"R$" #,##0.00',
  date: "dd/mm/yyyy",
  datetime: "dd/mm/yyyy hh:mm",
};

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

// O Excel não tem fuso: grava o "relógio de parede" de Brasília como se
// fosse UTC, para que a célula mostre exatamente a data/hora vista no CRM.
export function toExcelDate(value: string | null | undefined, withTime = false): Date | null {
  if (!value) return null;
  // Datas sem hora (colunas "date" do Postgres): usa o próprio dia
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = Object.fromEntries(partsFormatter.formatToParts(date).map((p) => [p.type, p.value]));
  const hour = Number(parts.hour) % 24;
  return new Date(
    Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      withTime ? hour : 0,
      withTime ? Number(parts.minute) : 0,
    ),
  );
}

// "negocios_2026-09-25_1432.xlsx" no horário de Brasília
export function exportFileName(prefix: string, now = new Date()) {
  const parts = Object.fromEntries(partsFormatter.formatToParts(now).map((p) => [p.type, p.value]));
  const hour = String(Number(parts.hour) % 24).padStart(2, "0");
  return `${prefix}_${parts.year}-${parts.month}-${parts.day}_${hour}${parts.minute}.xlsx`;
}

function displayLength(value: CellValue, type: CellType) {
  if (value === null || value === undefined) return 0;
  if (type === "date") return 10;
  if (type === "datetime") return 16;
  if (type === "currency" && typeof value === "number") return value.toFixed(2).length + 5;
  return String(value).length;
}

export function xlsxStream<T>({
  sheetName,
  columns,
  rows,
}: {
  sheetName: string;
  columns: ExportColumn<T>[];
  rows: T[];
}): ReadableStream<Uint8Array> {
  const output = new PassThrough();

  // Valores calculados uma vez: servem para a largura e para as linhas
  const values = rows.map((row) => columns.map((c) => c.value(row)));
  const widths = columns.map((c, i) => {
    const type = c.type ?? "text";
    const longest = values.reduce((max, v) => Math.max(max, displayLength(v[i], type)), c.header.length);
    return Math.min(60, Math.max(c.minWidth ?? 8, longest + 2));
  });

  (async () => {
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: output,
      useStyles: true,
      useSharedStrings: false,
    });
    workbook.creator = "Grupo Mave CRM";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(sheetName.slice(0, 31), {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    sheet.columns = columns.map((c, i) => ({
      header: c.header,
      key: `c${i}`,
      width: widths[i],
      style: NUM_FMT[c.type ?? "text"] ? { numFmt: NUM_FMT[c.type ?? "text"] } : {},
    }));
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };

    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: "FF14181F" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF0F3" } };
    header.alignment = { vertical: "middle" };
    header.height = 20;
    header.commit();

    for (const rowValues of values) {
      sheet.addRow(rowValues.map((v) => (v === undefined ? null : v))).commit();
    }

    sheet.commit();
    await workbook.commit();
  })().catch((error: unknown) => {
    console.error("Falha ao gerar planilha", error);
    output.destroy(error instanceof Error ? error : new Error(String(error)));
  });

  return Readable.toWeb(output) as ReadableStream<Uint8Array>;
}
