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
  pipeline_id: string | null;
  /** Tipo do evento, classificado no banco por workflow_event_kind() (coluna gerada) */
  event_kind: string;
}

export type WorkflowTone = "info" | "success" | "destructive" | "warning" | "neutral";

export interface WorkflowKind {
  value: string;
  /** Rótulo no plural, usado nos filtros e nos cartões de resumo */
  label: string;
  group: string;
  tone: WorkflowTone;
}

export const WORKFLOW_KIND_GROUPS = ["Negócios", "Cadastros", "Atividades", "Arquivos, propostas e anotações", "Configurações"];

// Mantenha em sincronia com public.workflow_event_kind() (migration 0030).
export const WORKFLOW_KINDS: WorkflowKind[] = [
  { value: "deal_created", label: "Negócios novos", group: "Negócios", tone: "success" },
  { value: "deal_moved", label: "Movimentados no funil", group: "Negócios", tone: "info" },
  { value: "deal_won", label: "Negócios ganhos", group: "Negócios", tone: "success" },
  { value: "deal_lost", label: "Negócios perdidos", group: "Negócios", tone: "destructive" },
  { value: "deal_frozen", label: "Negócios congelados", group: "Negócios", tone: "info" },
  { value: "deal_unfrozen", label: "Negócios descongelados", group: "Negócios", tone: "info" },
  { value: "deal_reopened", label: "Negócios reabertos", group: "Negócios", tone: "warning" },
  { value: "deal_transferred", label: "Transferidos de responsável", group: "Negócios", tone: "neutral" },
  { value: "deal_value", label: "Valor alterado", group: "Negócios", tone: "neutral" },
  { value: "deal_updated", label: "Outras alterações de negócio", group: "Negócios", tone: "neutral" },
  { value: "deal_deleted", label: "Negócios excluídos", group: "Negócios", tone: "destructive" },
  { value: "organization_created", label: "Organizações cadastradas", group: "Cadastros", tone: "success" },
  { value: "organization_updated", label: "Organizações alteradas", group: "Cadastros", tone: "neutral" },
  { value: "organization_deleted", label: "Organizações excluídas", group: "Cadastros", tone: "destructive" },
  { value: "contact_created", label: "Pessoas cadastradas", group: "Cadastros", tone: "success" },
  { value: "contact_updated", label: "Pessoas alteradas", group: "Cadastros", tone: "neutral" },
  { value: "contact_deleted", label: "Pessoas excluídas", group: "Cadastros", tone: "destructive" },
  { value: "lead_created", label: "Leads criados", group: "Cadastros", tone: "success" },
  { value: "lead_converted", label: "Leads convertidos", group: "Cadastros", tone: "success" },
  { value: "lead_updated", label: "Leads alterados", group: "Cadastros", tone: "neutral" },
  { value: "lead_deleted", label: "Leads excluídos", group: "Cadastros", tone: "destructive" },
  { value: "activity_created", label: "Atividades agendadas", group: "Atividades", tone: "info" },
  { value: "activity_done", label: "Atividades concluídas", group: "Atividades", tone: "success" },
  { value: "activity_updated", label: "Atividades alteradas", group: "Atividades", tone: "neutral" },
  { value: "activity_deleted", label: "Atividades excluídas", group: "Atividades", tone: "destructive" },
  { value: "attachment_created", label: "Arquivos anexados", group: "Arquivos, propostas e anotações", tone: "info" },
  { value: "attachment_updated", label: "Arquivos alterados", group: "Arquivos, propostas e anotações", tone: "neutral" },
  { value: "attachment_deleted", label: "Arquivos removidos", group: "Arquivos, propostas e anotações", tone: "destructive" },
  { value: "proposal_created", label: "Propostas criadas", group: "Arquivos, propostas e anotações", tone: "info" },
  { value: "proposal_updated", label: "Propostas alteradas", group: "Arquivos, propostas e anotações", tone: "info" },
  { value: "proposal_deleted", label: "Propostas excluídas", group: "Arquivos, propostas e anotações", tone: "destructive" },
  { value: "note_created", label: "Anotações adicionadas", group: "Arquivos, propostas e anotações", tone: "neutral" },
  { value: "note_updated", label: "Anotações alteradas", group: "Arquivos, propostas e anotações", tone: "neutral" },
  { value: "note_deleted", label: "Anotações excluídas", group: "Arquivos, propostas e anotações", tone: "destructive" },
  { value: "config", label: "Configurações e cadastros", group: "Configurações", tone: "neutral" },
];

const KIND_BY_VALUE = new Map(WORKFLOW_KINDS.map((k) => [k.value, k]));
export const kindLabel = (value: string) => KIND_BY_VALUE.get(value)?.label ?? value;

/** Indicadores em destaque no resumo do Workflow e no Dashboard (ordem de exibição) */
export const HEADLINE_KINDS = [
  "deal_created",
  "deal_moved",
  "deal_won",
  "deal_lost",
  "deal_frozen",
  "organization_created",
  "contact_created",
  "activity_done",
];

export interface WorkflowEvent {
  kind: string;
  /** Verbo/frase após o nome do autor (texto puro, também usado nas exportações) */
  text: string;
  tone: WorkflowTone;
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

export function describeEvent(row: WorkflowRow): WorkflowEvent {
  const c = row.changes;
  const label = row.record_label ?? "";
  const quoted = label ? ` “${label}”` : "";
  const base = { kind: row.event_kind, subject: row.record_label, href: hrefFor(row) };

  switch (row.table_name) {
    case "deals": {
      if (row.action === "insert") return { ...base, tone: "success", text: `criou o negócio${quoted}` };
      if (row.action === "delete") return { ...base, tone: "destructive", text: `excluiu o negócio${quoted}` };
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
      const stage = pair(c.stage_id);
      if (stage)
        return {
          ...base,
          tone: "info",
          text: `moveu o negócio${quoted} da etapa ${str(stage.old)} para ${str(stage.new)}`,
        };
      const frozen = pair(c.frozen_at);
      if (frozen) return { ...base, tone: "info", text: `${frozen.new ? "congelou" : "descongelou"} o negócio${quoted}` };
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
