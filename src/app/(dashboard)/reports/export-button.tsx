"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportWorkbook, type ExcelSheet } from "@/lib/export/excel";
import { exportPdf, type PdfSection } from "@/lib/export/pdf";
import { captureChartsByIds, loadImageAsDataUrl } from "@/lib/export/capture";

const LOGO_URL = "/logo-mark.png";

export interface ExcelChartSheetSpec {
  name: string;
  chartId: string;
}

export interface ExportButtonProps {
  label?: string;
  filename: string;
  pdfTitle: string;
  pdfSubtitle?: string;
  excelSheets: ExcelSheet[];
  pdfSections: PdfSection[];
  excelChartSheets?: ExcelChartSheetSpec[];
  variant?: "default" | "outline";
  size?: "default" | "sm";
}

export function ExportButton({
  label = "Exportar",
  filename,
  pdfTitle,
  pdfSubtitle,
  excelSheets,
  pdfSections,
  excelChartSheets = [],
  variant = "outline",
  size = "default",
}: ExportButtonProps) {
  const [loading, setLoading] = useState<"excel" | "pdf" | null>(null);

  function neededChartIds() {
    const ids = new Set<string>();
    for (const s of pdfSections) if (s.chartImageId) ids.add(s.chartImageId);
    for (const c of excelChartSheets) ids.add(c.chartId);
    return Array.from(ids);
  }

  async function onExcel() {
    setLoading("excel");
    try {
      const [images, logoDataUrl] = await Promise.all([
        captureChartsByIds(neededChartIds()),
        loadImageAsDataUrl(LOGO_URL).catch(() => undefined),
      ]);
      await exportWorkbook(filename, excelSheets, {
        logoDataUrl,
        title: pdfTitle,
        subtitle: pdfSubtitle,
        chartSheets: excelChartSheets
          .map((c) => ({ name: c.name, image: images[c.chartId] }))
          .filter((c): c is { name: string; image: NonNullable<typeof c.image> } => !!c.image),
      });
    } finally {
      setLoading(null);
    }
  }

  async function onPdf() {
    setLoading("pdf");
    try {
      const [images, logoDataUrl] = await Promise.all([
        captureChartsByIds(neededChartIds()),
        loadImageAsDataUrl(LOGO_URL).catch(() => undefined),
      ]);
      exportPdf(filename, pdfTitle, pdfSections, { subtitle: pdfSubtitle, logoDataUrl, images });
    } finally {
      setLoading(null);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} disabled={loading !== null}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onExcel}>Excel (.xlsx)</DropdownMenuItem>
        <DropdownMenuItem onClick={onPdf}>PDF</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
