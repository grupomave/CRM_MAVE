import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// Contagens do Workflow (por tipo de evento, responsável e funil) calculadas no banco por
// workflow_summary(). Usado pela tela de Workflow e pelo bloco "Movimentação dos negócios"
// do Dashboard, então os números dos dois sempre batem.

export interface WorkflowSummaryFilters {
  /** Dias no formato aaaa-mm-dd (Brasília) */
  from: string;
  to: string;
  actor?: string | null;
  owner?: string | null;
  organization?: string | null;
  deal?: string | null;
  contact?: string | null;
  pipeline?: string | null;
  kinds?: string[];
  search?: string;
}

export interface WorkflowSummary {
  /** Total por tipo de evento (ignora o filtro de tipo) */
  kinds: Record<string, number>;
  /** Eventos por responsável pelo registro (já filtrado por tipo); key null = sem responsável */
  owners: { key: string | null; total: number }[];
  /** Eventos por funil (já filtrado por tipo); key null = não ligado a um funil */
  pipelines: { key: string | null; total: number }[];
}

// 00:00 e 23:59:59 do dia (Brasília, UTC-3 sem horário de verão)
export const startOfDay = (key: string) => new Date(`${key}T00:00:00-03:00`).toISOString();
export const endOfDay = (key: string) => new Date(`${key}T23:59:59.999-03:00`).toISOString();

export async function loadWorkflowSummary(
  supabase: SupabaseClient<Database>,
  f: WorkflowSummaryFilters,
): Promise<WorkflowSummary> {
  const { data, error } = await supabase.rpc("workflow_summary", {
    p_from: startOfDay(f.from),
    p_to: endOfDay(f.to),
    p_actor: f.actor ?? null,
    p_owner: f.owner ?? null,
    p_org: f.organization ?? null,
    p_deal: f.deal ?? null,
    p_contact: f.contact ?? null,
    p_pipeline: f.pipeline ?? null,
    p_kinds: f.kinds && f.kinds.length > 0 ? f.kinds : null,
    p_search: f.search?.trim() ? f.search.trim().replace(/[%,()]/g, " ") : null,
  });
  if (error) throw error;

  const summary: WorkflowSummary = { kinds: {}, owners: [], pipelines: [] };
  for (const row of data ?? []) {
    const total = Number(row.total);
    if (row.dimension === "kind" && row.key) summary.kinds[row.key] = total;
    else if (row.dimension === "owner") summary.owners.push({ key: row.key, total });
    else if (row.dimension === "pipeline") summary.pipelines.push({ key: row.key, total });
  }
  summary.owners.sort((a, b) => b.total - a.total);
  summary.pipelines.sort((a, b) => b.total - a.total);
  return summary;
}
