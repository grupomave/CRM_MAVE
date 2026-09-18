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
import { formatCurrencyBRL } from "@/lib/utils";
import { DEAL_STATUS_LABEL, LOST_REASON_LABEL, type LostReason } from "@/lib/supabase/types";
import { exportWorkbook, type ExcelSheet } from "@/lib/export/excel";
import { exportPdf, type PdfSection } from "@/lib/export/pdf";
import { loadImageAsDataUrl } from "@/lib/export/capture";

const LOGO_URL = "/logo-mark.png";

const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  task: "Tarefa",
  call: "Ligação",
  meeting: "Reunião",
  email: "E-mail",
};

export interface DealReportData {
  deal: {
    title: string;
    value: number;
    status: string;
    expected_close_date: string | null;
    source: string | null;
    lost_reason: LostReason | null;
    organizations: { name: string } | null;
    contacts: { name: string; phone: string | null; whatsapp: string | null } | null;
    profiles: { full_name: string } | null;
  };
  activities: {
    type: string;
    subject: string;
    due_date: string | null;
    done: boolean;
  }[];
  attachments: {
    file_name: string;
    category: string | null;
    size_bytes: number;
    created_at: string;
  }[];
}

function fileBaseName(data: DealReportData) {
  return `negocio-${data.deal.title}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function statusLabel(data: DealReportData) {
  const base = DEAL_STATUS_LABEL[data.deal.status as keyof typeof DEAL_STATUS_LABEL] ?? data.deal.status;
  if (data.deal.status === "lost" && data.deal.lost_reason) {
    return `${base} (${LOST_REASON_LABEL[data.deal.lost_reason] ?? data.deal.lost_reason})`;
  }
  return base;
}

function summaryRows(data: DealReportData): [string, string][] {
  return [
    ["Negócio", data.deal.title],
    ["Valor", formatCurrencyBRL(data.deal.value)],
    ["Status", statusLabel(data)],
    ["Organização", data.deal.organizations?.name ?? "—"],
    ["Contato", data.deal.contacts?.name ?? "—"],
    ["Telefone do contato", data.deal.contacts?.phone ?? data.deal.contacts?.whatsapp ?? "—"],
    ["Responsável", data.deal.profiles?.full_name ?? "—"],
    ["Origem", data.deal.source ?? "—"],
    [
      "Previsão de fechamento",
      data.deal.expected_close_date
        ? new Date(data.deal.expected_close_date).toLocaleDateString("pt-BR")
        : "—",
    ],
  ];
}

async function handleExcel(data: DealReportData) {
  const sheets: ExcelSheet[] = [
    {
      name: "Resumo",
      columns: [
        { header: "Campo", key: "campo", width: 24 },
        { header: "Valor", key: "valor", width: 30 },
      ],
      rows: summaryRows(data).map(([campo, valor]) => ({ campo, valor })),
    },
    {
      name: "Atividades",
      columns: [
        { header: "Tipo", key: "tipo", width: 14 },
        { header: "Assunto", key: "assunto", width: 30 },
        { header: "Data", key: "data", width: 18 },
        { header: "Concluída", key: "concluida", width: 12 },
      ],
      rows: data.activities.map((a) => ({
        tipo: ACTIVITY_TYPE_LABEL[a.type] ?? a.type,
        assunto: a.subject,
        data: a.due_date ? new Date(a.due_date).toLocaleString("pt-BR") : "—",
        concluida: a.done ? "Sim" : "Não",
      })),
    },
    {
      name: "Anexos",
      columns: [
        { header: "Arquivo", key: "arquivo", width: 32 },
        { header: "Categoria", key: "categoria", width: 20 },
        { header: "Tamanho (KB)", key: "tamanho", width: 14 },
        { header: "Enviado em", key: "enviado", width: 18 },
      ],
      rows: data.attachments.map((a) => ({
        arquivo: a.file_name,
        categoria: a.category ?? "—",
        tamanho: Math.round(a.size_bytes / 1024),
        enviado: new Date(a.created_at).toLocaleString("pt-BR"),
      })),
    },
  ];

  const logoDataUrl = await loadImageAsDataUrl(LOGO_URL).catch(() => undefined);
  await exportWorkbook(fileBaseName(data), sheets, {
    logoDataUrl,
    title: `Relatório do negócio — ${data.deal.title}`,
  });
}

async function handlePdf(data: DealReportData) {
  const sections: PdfSection[] = [
    {
      title: "Resumo do negócio",
      columns: ["Campo", "Valor"],
      rows: summaryRows(data),
    },
    {
      title: "Atividades (tarefas e agendamentos)",
      columns: ["Tipo", "Assunto", "Data", "Concluída"],
      rows: data.activities.map((a) => [
        ACTIVITY_TYPE_LABEL[a.type] ?? a.type,
        a.subject,
        a.due_date ? new Date(a.due_date).toLocaleString("pt-BR") : "—",
        a.done ? "Sim" : "Não",
      ]),
    },
    {
      title: "Anexos",
      columns: ["Arquivo", "Categoria", "Tamanho (KB)", "Enviado em"],
      rows: data.attachments.map((a) => [
        a.file_name,
        a.category ?? "—",
        Math.round(a.size_bytes / 1024),
        new Date(a.created_at).toLocaleString("pt-BR"),
      ]),
    },
  ];

  if (data.activities.length === 0) sections[1].rows = [["—", "Nenhuma atividade", "", ""]];
  if (data.attachments.length === 0) sections[2].rows = [["—", "Nenhum anexo", "", ""]];

  const logoDataUrl = await loadImageAsDataUrl(LOGO_URL).catch(() => undefined);
  exportPdf(fileBaseName(data), `Relatório do negócio — ${data.deal.title}`, sections, {
    logoDataUrl,
  });
}

export function DealReportButton({ data }: { data: DealReportData }) {
  const [loading, setLoading] = useState<"excel" | "pdf" | null>(null);

  async function onExcel() {
    setLoading("excel");
    try {
      await handleExcel(data);
    } finally {
      setLoading(null);
    }
  }

  async function onPdf() {
    setLoading("pdf");
    try {
      await handlePdf(data);
    } finally {
      setLoading(null);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={loading !== null}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
          Relatório do negócio
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onExcel}>Excel (.xlsx)</DropdownMenuItem>
        <DropdownMenuItem onClick={onPdf}>PDF</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
