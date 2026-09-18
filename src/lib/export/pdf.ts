"use client";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { CapturedImage } from "./capture";

export type PdfSection = {
  title: string;
  columns: string[];
  rows: (string | number)[][];
  // Chave em `images` (options.images) — se presente, desenha o gráfico
  // acima da tabela desta seção.
  chartImageId?: string;
};

export interface PdfExportOptions {
  subtitle?: string;
  logoDataUrl?: string;
  images?: Record<string, CapturedImage>;
}

// jspdf-autotable seta doc.lastAutoTable em runtime mas não expõe isso no
// tipo público — ver node_modules/jspdf-autotable/dist/jspdf.plugin.autotable.js.
type DocWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } };

export function exportPdf(
  filename: string,
  title: string,
  sections: PdfSection[],
  options?: PdfExportOptions,
) {
  const doc = new jsPDF() as DocWithAutoTable;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 14;
  const marginRight = 14;
  const contentWidth = pageWidth - marginLeft - marginRight;

  let titleX = marginLeft;
  if (options?.logoDataUrl) {
    try {
      doc.addImage(options.logoDataUrl, "PNG", marginLeft, 10, 14, 14);
      titleX = marginLeft + 18;
    } catch {
      // Logo corrompido ou formato não suportado — segue sem ele.
    }
  }

  doc.setFontSize(16);
  doc.text(title, titleX, 18);

  let cursorY = 26;
  if (options?.subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(options.subtitle, titleX, 25);
    doc.setTextColor(0);
    cursorY = 32;
  }
  cursorY = Math.max(cursorY, 30);

  for (const section of sections) {
    if (cursorY > pageHeight - 40) {
      doc.addPage();
      cursorY = 20;
    }

    doc.setFontSize(12);
    doc.text(section.title, marginLeft, cursorY);
    cursorY += 4;

    const image = section.chartImageId ? options?.images?.[section.chartImageId] : undefined;
    if (image) {
      const imgWidth = contentWidth;
      const imgHeight = (image.height / image.width) * imgWidth;
      if (cursorY + imgHeight > pageHeight - 20) {
        doc.addPage();
        cursorY = 20;
      }
      doc.addImage(image.dataUrl, image.format, marginLeft, cursorY, imgWidth, imgHeight);
      cursorY += imgHeight + 6;
    }

    if (section.rows.length > 0) {
      autoTable(doc, {
        startY: cursorY,
        head: [section.columns],
        body: section.rows.map((r) => r.map(String)),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [37, 84, 116] },
        margin: { left: marginLeft, right: marginRight },
      });
      cursorY = (doc.lastAutoTable?.finalY ?? cursorY) + 10;
    }
  }

  doc.save(`${filename}.pdf`);
}
