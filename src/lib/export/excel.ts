"use client";

import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import type { CapturedImage } from "./capture";

export type ExcelColumn = { header: string; key: string; width?: number };
export type ExcelSheet = {
  name: string;
  columns: ExcelColumn[];
  rows: Record<string, string | number | null>[];
};

export interface ExcelChartSheet {
  name: string;
  image: CapturedImage;
}

export interface ExcelExportOptions {
  logoDataUrl?: string;
  title?: string;
  subtitle?: string;
  chartSheets?: ExcelChartSheet[];
}

export async function exportWorkbook(
  filename: string,
  sheets: ExcelSheet[],
  options?: ExcelExportOptions,
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Grupo Mave CRM";
  workbook.created = new Date();

  if (options?.logoDataUrl || options?.title) {
    const cover = workbook.addWorksheet("Capa");
    cover.getColumn(1).width = 4;
    cover.getColumn(3).width = 60;
    if (options.logoDataUrl) {
      try {
        const imageId = workbook.addImage({ base64: options.logoDataUrl, extension: "png" });
        cover.addImage(imageId, { tl: { col: 0, row: 0 }, ext: { width: 72, height: 72 } });
      } catch {
        // Logo corrompido — segue sem ele na capa.
      }
    }
    if (options.title) {
      const cell = cover.getCell("C2");
      cell.value = options.title;
      cell.font = { bold: true, size: 16 };
    }
    if (options.subtitle) {
      const cell = cover.getCell("C3");
      cell.value = options.subtitle;
      cell.font = { size: 10, color: { argb: "FF666666" } };
    }
    const generated = cover.getCell("C5");
    generated.value = `Gerado em ${new Date().toLocaleString("pt-BR")}`;
    generated.font = { size: 9, italic: true };
  }

  for (const sheet of sheets) {
    // Excel limita nomes de aba a 31 caracteres.
    const ws = workbook.addWorksheet(sheet.name.slice(0, 31));
    ws.columns = sheet.columns.map((c) => ({
      header: c.header,
      key: c.key,
      width: c.width ?? 22,
    }));
    ws.getRow(1).font = { bold: true };
    ws.addRows(sheet.rows);
  }

  for (const chart of options?.chartSheets ?? []) {
    const ws = workbook.addWorksheet(chart.name.slice(0, 31));
    try {
      const imageId = workbook.addImage({
        base64: chart.image.dataUrl,
        extension: chart.image.format.toLowerCase() as "jpeg",
      });
      const displayWidth = 640;
      const displayHeight = Math.round(
        displayWidth * (chart.image.height / chart.image.width),
      );
      ws.addImage(imageId, {
        tl: { col: 0, row: 0 },
        ext: { width: displayWidth, height: displayHeight },
      });
    } catch {
      ws.getCell("A1").value = "Não foi possível gerar a imagem deste gráfico.";
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${filename}.xlsx`,
  );
}
