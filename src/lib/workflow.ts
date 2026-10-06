import { fieldLabel, formatValue } from "@/app/(dashboard)/settings/audit-log-settings";
import { formatCurrencyBRL } from "@/lib/utils";

// Workflow = linha do tempo de tudo que acontece no CRM, montada a partir do
// log de auditoria (audit_logs, guardado para sempre). Este módulo transforma
// uma linha do log em uma frase legível + categoria para filtrar.

export interface WorkflowRow {
  id: number;
  occurred_at: string;
  actor_id: string | null;
  actor_name: string;
  action: "insert" | "update" | "delete";
  table_name: string;
  record_id: string | null;
  record_label: string | null;
  changes: Record<string, unknown>;
  deal_id: string | null;
  organization_id: string | null;
  contact_id: string | null;
  owner_id: string | null;
}

export type WorkflowCategory =
  | "funil"
  | "negocios"
  | "atividades"
  | "arquivos"
  | "propostas"
  | "anotacoes"
  | "leads"
  | "contatos"
  | "config";

export const WORKFLOW_CATEGORIES: { value: WorkflowCategory; label: string; tables: string[] }[] = [
  { value: "funil", label: "Movimentações de funil", tables: ["deals"] },
  { value: "negocios", label: "Negócios (todos os eventos)", tables: ["deals"] },
  { value: "atividades", label: "Atividades", tables: ["activities"] },
  { value: "arquivos", label: "Arquivos anexados", tables: ["attachments"] },
  { value: "propostas", label: "Propostas", tables: ["proposals"] },
  { value: "anotacoes", label: "Anotações", tables: ["notes"] },
  { value: "leads", label: "Leads", tables: ["leads"] },
  { value: "contatos", label: "Pessoas e organizações", tables: ["contacts", "organizations"] },
  {
    value: "config",
    label: "Configurações e cadastros",
    tables: [
      "pipelines",
      "pipeline_stages",
      "lost_reasons",
      "custom_fields",
      "automation_rules",
      "teams",
      "profiles",
      "lead_sources",
      "segments",
      "digest_settings",
    ],
  },
];

export interface WorkflowEvent {
  category: WorkflowCategory;
  /** Verbo/frase após o nome do autor (texto puro, também usado nas exportações) */
  text: string;
  tone: "info" | "success" | "destructive" | "warning" | "neutral";
  /** Nome do registro principal (negócio, atividade, arquivo...) */
  subject: string | null;
  href: string | null;
}

const str = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));
const pair = (v: unknown): { old: unknown; new: unknown } | null =>
  typeof v === "object" && v !== null && "old" in v && "new" in v ? (v as { old: unknown; new: unknown }) : null;

const ENTITY_SINGULAR: Record<string, string> = {
  deals: "o negócio",
  contacts: "a pessoa",
  organizations: "a organização",
  leads: "o lead",
  activities: "a atividade",
  notes: "a anotação",
  proposals: "a proposta",
  attachments: "o arquivo",
  pipelines: "o funil",
  pipeline_stages: "a etapa do funil",
  lost_reasons: "o motivo da perda",
  custom_fields: "o campo customizado",
  automation_rules: "a automação",
  teams: "a equipe",
  profiles: "o usuário",
  lead_sources: "a origem de lead",
  segments: "o segmento",
  digest_settings: "o resumo diário",
};

const ACTIVITY_TYPE: Record<string, string> = {
  task: "tarefa",
  call: "ligação",
  meeting: "reunião",
  email: "e-mail",
  whatsapp: "WhatsApp",
};

function hrefFor(row: WorkflowRow): string | null {
  if (row.action === "delete") return null;
  switch (row.table_name) {
    case "deals":
      return row.record_id ? `/deals/${row.record_id}` : null;
    case "contacts":
      return row.record_id ? `/contacts/people/${row.record_id}` : null;
    case "organizations":
      return row.record_id ? `/contacts/organizations/${row.record_id}` : null;
    case "leads":
      return row.record_id ? `/leads/${row.record_id}` : null;
    default:
      return row.deal_id ? `/deals/${row.deal_id}` : null;
  }
}

export function categoryOf(row: WorkflowRow): WorkflowCategory {
  switch (row.table_name) {
    case "deals":
      return row.action === "update" && "stage_id" in row.changes ? "funil" : "negocios";
    case "activities":
      return "atividades";
    case "attachments":
      return "arquivos";
    case "proposals":
      return "propostas";
    case "notes":
      return "anotacoes";
    case "leads":
      return "leads";
    case "contacts":
    case "organizations":
      return "contatos";
    default:
      return "config";
  }
}

export function describeEvent(row: WorkflowRow): WorkflowEvent {
  const c = row.changes;
  const label = row.record_label ?? "";
  const quoted = label ? ` “${label}”` : "";
  const base = { category: categoryOf(row), subject: row.record_label, href: hrefFor(row) };

  switch (row.table_name) {
    case "deals": {
      if (row.action === "insert") return { ...base, tone: "success", text: `criou o negócio${quoted}` };
      if (row.action === "delete") return { ...base, tone: "destructive", text: `excluiu o negócio${quoted}` };
      const stage = pair(c.stage_id);
      if (stage)
        return {
          ...base,
          tone: "info",
          text: `moveu o negócio${quoted} da etapa ${str(stage.old)} para ${str(stage.new)}`,
        };
      const status = pair(c.status);
      if (status) {
        const next = String(status.new);
        const reason = pair(c.lost_reason_id);
        if (next === "won") return { ...base, tone: "success", text: `marcou o negócio${quoted} como GANHO` };
        if (next === "lost")
          return {
            ...base,
            tone: "destructive",
            text: `marcou o negócio${quoted} como PERDIDO${reason?.new ? ` (motivo: ${str(reason.new)})` : ""}`,
          };
        return { ...base, tone: "warning", text: `reabriu o negócio${quoted}` };
      }
      const owner = pair(c.owner_id);
      if (owner)
        return { ...base, tone: "neutral", text: `transferiu o negócio${quoted} de ${str(owner.old)} para ${str(owner.new)}` };
      const value = pair(c.value);
      if (value)
        return {
          ...base,
          tone: "neutral",
          text: `alterou o valor do negócio${quoted} de ${formatCurrencyBRL(Number(value.old) || 0)} para ${formatCurrencyBRL(Number(value.new) || 0)}`,
        };
      if (pair(c.frozen_at)) return { ...base, tone: "info", text: `${pair(c.frozen_at)?.new ? "congelou" : "descongelou"} o negócio${quoted}` };
      break;
    }
    case "activities": {
      const type = ACTIVITY_TYPE[String(c.type && !pair(c.type) ? c.type : "")] ?? "atividade";
      if (row.action === "insert") {
        const when = c.due_date ? ` para ${formatValue("due_date", c.due_date)}` : "";
        return { ...base, tone: "info", text: `agendou ${type === "atividade" ? "a atividade" : `a ${type}`}${quoted}${when}` };
      }
      if (row.action === "delete") return { ...base, tone: "destructive", text: `excluiu a atividade${quoted}` };
      const done = pair(c.done);
      if (done) return { ...base, tone: done.new ? "success" : "warning", text: `${done.new ? "concluiu" : "reabriu"} a atividade${quoted}` };
      const due = pair(c.due_date);
      if (due)
        return { ...base, tone: "neutral", text: `reagendou a atividade${quoted} de ${formatValue("due_date", due.old)} para ${formatValue("due_date", due.new)}` };
      break;
    }
    case "attachments": {
      if (row.action === "insert") return { ...base, tone: "info", text: `anexou o arquivo${quoted}` };
      if (row.action === "delete") return { ...base, tone: "destructive", text: `removeu o arquivo${quoted}` };
      break;
    }
    case "proposals": {
      if (row.action === "insert") return { ...base, tone: "info", text: `criou uma proposta${label ? ` do negócio “${label}”` : ""}` };
      const status = pair(c.status);
      if (status)
        return { ...base, tone: "info", text: `mudou a proposta${label ? ` de “${label}”` : ""} para ${formatValue("status", status.new)}` };
      break;
    }
    case "notes": {
      if (row.action === "insert") return { ...base, tone: "neutral", text: "adicionou uma anotação" };
      if (row.action === "delete") return { ...base, tone: "destructive", text: "excluiu uma anotação" };
      break;
    }
    case "leads": {
      const status = pair(c.status);
      if (status?.new === "converted") return { ...base, tone: "success", text: `converteu o lead${quoted} em negócio` };
      if (status) return { ...base, tone: "info", text: `mudou o status do lead${quoted} para ${formatValue("status", status.new)}` };
      const owner = pair(c.owner_id);
      if (owner) return { ...base, tone: "neutral", text: `transferiu o lead${quoted} de ${str(owner.old)} para ${str(owner.new)}` };
      break;
    }
  }

  // Frase genérica: criou / excluiu / alterou campos
  const entity = ENTITY_SINGULAR[row.table_name] ?? "um registro";
  if (row.action === "insert") return { ...base, tone: "success", text: `criou ${entity}${quoted}` };
  if (row.action === "delete") return { ...base, tone: "destructive", text: `excluiu ${entity}${quoted}` };
  const fields = Object.keys(c).map(fieldLabel);
  return {
    ...base,
    tone: "neutral",
    text: `alterou ${entity}${quoted}${fields.length ? ` (${fields.slice(0, 4).join(", ")}${fields.length > 4 ? "…" : ""})` : ""}`,
  };
}
