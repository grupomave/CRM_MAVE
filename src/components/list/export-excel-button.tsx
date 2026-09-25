"use client";

import { useState } from "react";
import { saveAs } from "file-saver";
import { FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { toast } from "@/lib/toast";

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// Exporta a listagem atual para .xlsx. Envia os mesmos parâmetros da URL
// (filtros, busca, ordenação, funil) para a rota /api/export, que gera a
// planilha no servidor com todos os registros filtrados.
export function ExportExcelButton({
  entity,
  label = "Exportar Excel",
  compact = false,
}: {
  entity: "leads" | "organizacoes" | "pessoas" | "negocios";
  label?: string;
  compact?: boolean;
}) {
  const [loading, setLoading] = useState(false);

  async function onExport() {
    setLoading(true);
    const toastLoading = setTimeout(
      () => toast.info("Gerando planilha...", { description: "Listas grandes podem levar alguns segundos." }),
      1500,
    );
    try {
      const response = await fetch(`/api/export/${entity}${window.location.search}`, {
        headers: { Accept: XLSX_TYPE },
      });
      const type = response.headers.get("Content-Type") ?? "";

      if (!response.ok || !type.includes("spreadsheetml")) {
        // Sem sessão o proxy redireciona para /login (HTML)
        if (response.redirected || response.status === 401) {
          throw new Error("Sua sessão expirou. Entre novamente para exportar.");
        }
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Não foi possível gerar a planilha.");
      }

      const disposition = response.headers.get("Content-Disposition") ?? "";
      const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `${entity}.xlsx`;
      const count = Number(response.headers.get("X-Export-Count") ?? "0");
      const blob = await response.blob();
      saveAs(new Blob([blob], { type: XLSX_TYPE }), filename);
      toast.success("Planilha exportada", {
        description: `${count.toLocaleString("pt-BR")} ${count === 1 ? "registro" : "registros"} em ${filename}`,
      });
    } catch (error) {
      toast.error("Falha na exportação", {
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    } finally {
      clearTimeout(toastLoading);
      setLoading(false);
    }
  }

  const button = (
    <Button
      variant="secondary"
      onClick={onExport}
      loading={loading}
      aria-label={compact ? label : undefined}
      size={compact ? "icon" : "default"}
    >
      {!loading && <FileSpreadsheet />}
      {!compact && (loading ? "Exportando..." : label)}
    </Button>
  );

  return compact ? <SimpleTooltip content={label}>{button}</SimpleTooltip> : button;
}
