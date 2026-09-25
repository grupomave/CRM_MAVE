import "server-only";

import { createClient } from "@/lib/supabase/server";
import { loadLeadRows, loadOrganizationRows, loadOwners, loadPersonRows } from "@/lib/data/lists";
import { loadPipelineData } from "@/lib/data/deals";
import { applyLeadFilters, LEAD_STATUS_LABEL, parseLeadFilters } from "@/lib/filters/leads";
import { applyOrganizationFilters, parseOrganizationFilters } from "@/lib/filters/organizations";
import { applyPersonFilters, parsePersonFilters } from "@/lib/filters/people";
import { applyDealFilters, DEAL_STATUS_LABEL, parseDealFilters } from "@/lib/filters/deals";
import { getParam } from "@/lib/filters/params";
import { toExcelDate, type ExportColumn } from "./xlsx-stream";

// Cada exportação reaproveita o MESMO carregador e as MESMAS funções de
// filtro/ordenação da tela (src/lib/data, src/lib/filters), aplicadas aos
// parâmetros da URL atual — sem paginação, ou seja, todos os registros
// filtrados. O cliente Supabase é o do usuário, então a RLS limita a
// exportação ao que ele pode ver.

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface ExportResult {
  sheetName: string;
  filePrefix: string;
  columns: ExportColumn<any>[];
  rows: unknown[];
}

export const EXPORT_ENTITIES = ["leads", "organizacoes", "pessoas", "negocios"] as const;
export type ExportEntity = (typeof EXPORT_ENTITIES)[number];

export async function buildExport(
  entity: ExportEntity,
  supabase: Supabase,
  params: URLSearchParams,
): Promise<ExportResult> {
  switch (entity) {
    case "leads": {
      const owners = await loadOwners(supabase);
      const rows = applyLeadFilters(await loadLeadRows(supabase, owners), parseLeadFilters(params));
      return {
        sheetName: "Leads",
        filePrefix: "leads",
        rows,
        columns: [
          { header: "Nome", value: (r: (typeof rows)[number]) => r.name, minWidth: 24 },
          { header: "Contato", value: (r: (typeof rows)[number]) => r.contact_info },
          { header: "Origem", value: (r: (typeof rows)[number]) => r.source },
          { header: "Status", value: (r: (typeof rows)[number]) => LEAD_STATUS_LABEL[r.status] },
          { header: "Responsável", value: (r: (typeof rows)[number]) => r.owner_name },
          { header: "Criado em", type: "date", value: (r: (typeof rows)[number]) => toExcelDate(r.created_at) },
        ],
      };
    }

    case "organizacoes": {
      const owners = await loadOwners(supabase);
      const rows = applyOrganizationFilters(
        await loadOrganizationRows(supabase, owners),
        parseOrganizationFilters(params),
      );
      type Row = (typeof rows)[number];
      return {
        sheetName: "Organizações",
        filePrefix: "organizacoes",
        rows,
        columns: [
          { header: "Nome fantasia", value: (r: Row) => r.name, minWidth: 24 },
          { header: "CNPJ", value: (r: Row) => r.cnpj, minWidth: 18 },
          { header: "Setor", value: (r: Row) => r.sector },
          { header: "Cidade", value: (r: Row) => r.city },
          { header: "UF", value: (r: Row) => r.state, minWidth: 5 },
          { header: "Telefone", value: (r: Row) => r.phone, minWidth: 15 },
          { header: "Responsável", value: (r: Row) => r.owner_name },
          { header: "Pessoas", type: "number", value: (r: Row) => r.contacts_count },
          { header: "Negócios abertos", type: "number", value: (r: Row) => r.open_deals_count },
          { header: "Valor em aberto", type: "currency", value: (r: Row) => r.open_deals_value },
          { header: "Valor ganho", type: "currency", value: (r: Row) => r.won_deals_value },
          { header: "Criado em", type: "date", value: (r: Row) => toExcelDate(r.created_at) },
        ],
      };
    }

    case "pessoas": {
      const owners = await loadOwners(supabase);
      const rows = applyPersonFilters(await loadPersonRows(supabase, owners), parsePersonFilters(params));
      type Row = (typeof rows)[number];
      return {
        sheetName: "Pessoas",
        filePrefix: "pessoas",
        rows,
        columns: [
          { header: "Nome", value: (r: Row) => r.name, minWidth: 24 },
          { header: "Cargo", value: (r: Row) => r.job_title },
          { header: "Organização", value: (r: Row) => r.organization_name },
          { header: "E-mail", value: (r: Row) => r.email },
          { header: "Telefone", value: (r: Row) => r.phone, minWidth: 15 },
          { header: "WhatsApp", value: (r: Row) => r.whatsapp, minWidth: 15 },
          { header: "Responsável", value: (r: Row) => r.owner_name },
          { header: "Criado em", type: "date", value: (r: Row) => toExcelDate(r.created_at) },
        ],
      };
    }

    case "negocios": {
      const { pipeline, stages, deals } = await loadPipelineData(supabase, getParam(params, "pipeline"));
      const stageOrder = new Map(stages.map((s, i) => [s.id, i]));
      const stageName = new Map(stages.map((s) => [s.id, s.name]));
      const rows = applyDealFilters(deals, parseDealFilters(params), stageOrder);
      type Row = (typeof rows)[number];
      const alerts = (r: Row) =>
        [
          r.overdue_days ? `Atividade atrasada (${r.overdue_days}d)` : null,
          r.no_upcoming_activity ? "Sem próxima atividade" : null,
          r.is_stagnant ? "Estagnado" : null,
        ]
          .filter(Boolean)
          .join("; ") || null;
      return {
        sheetName: "Negócios",
        filePrefix: "negocios",
        rows,
        columns: [
          { header: "Negócio", value: (r: Row) => r.title, minWidth: 28 },
          { header: "Organização", value: (r: Row) => r.organization_name },
          { header: "Contato", value: (r: Row) => r.contact_name },
          { header: "Funil", value: () => pipeline?.name ?? null },
          { header: "Etapa", value: (r: Row) => stageName.get(r.stage_id) ?? null },
          { header: "Status", value: (r: Row) => DEAL_STATUS_LABEL[r.status] },
          { header: "Valor", type: "currency", value: (r: Row) => r.value, minWidth: 14 },
          { header: "Responsável", value: (r: Row) => r.owner_name },
          { header: "Origem", value: (r: Row) => r.source },
          {
            header: "Previsão de fechamento",
            type: "date",
            value: (r: Row) => toExcelDate(r.expected_close_date),
          },
          { header: "Próxima atividade", value: (r: Row) => r.next_activity_subject },
          {
            header: "Data da próxima atividade",
            type: "datetime",
            value: (r: Row) => toExcelDate(r.next_activity_due, true),
          },
          { header: "Alertas", value: alerts },
          { header: "Criado em", type: "date", value: (r: Row) => toExcelDate(r.created_at) },
          { header: "Fechado em", type: "date", value: (r: Row) => toExcelDate(r.closed_at) },
        ],
      };
    }
  }
}
