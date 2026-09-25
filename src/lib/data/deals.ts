import "server-only";

import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { computeDealAlerts } from "@/lib/deal-alerts";
import type { PipelineDeal, PipelineOption, PipelineStage } from "@/components/pipeline/types";

// Carregador do funil (Kanban/Lista de Negócios) — usado pela página e pela
// exportação para Excel, com o cliente do usuário (a RLS decide o que vem).

type Supabase = Awaited<ReturnType<typeof createClient>>;

interface RawDealRow {
  id: string;
  title: string;
  value: number;
  stage_id: string;
  owner_id: string;
  source: string | null;
  status: "open" | "won" | "lost";
  expected_close_date: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  last_activity_at: string | null;
  organizations: { name: string } | null;
  contacts: { name: string } | null;
  profiles: { full_name: string } | null;
}

type NextActivityRow = { deal_id: string | null; subject: string; due_date: string | null };

export interface PipelineData {
  pipelines: PipelineOption[];
  pipeline: PipelineOption | null;
  stages: PipelineStage[];
  deals: PipelineDeal[];
}

export async function loadPipelineData(
  supabase: Supabase,
  requestedPipelineId: string | null | undefined,
): Promise<PipelineData> {
  const { data: pipelinesData } = await supabase
    .from("pipelines")
    .select("id, name, is_default")
    .order("name");
  const pipelines = (pipelinesData ?? []) as PipelineOption[];

  const pipeline =
    (requestedPipelineId && pipelines.find((p) => p.id === requestedPipelineId)) ||
    pipelines.find((p) => p.is_default) ||
    pipelines[0] ||
    null;

  if (!pipeline) return { pipelines, pipeline: null, stages: [], deals: [] };

  const [stagesRes, dealRows, nextActivities] = await Promise.all([
    supabase
      .from("pipeline_stages")
      .select("id, name, order_index, pipeline_id, rotting_days")
      .eq("pipeline_id", pipeline.id)
      .order("order_index"),
    fetchAllRows<RawDealRow>((from, to) =>
      supabase
        .from("deals")
        .select(
          `id, title, value, stage_id, owner_id, source, status, expected_close_date, created_at, updated_at, closed_at, last_activity_at,
           organizations ( name ),
           contacts ( name ),
           profiles!deals_owner_id_fkey ( full_name )`,
        )
        .eq("pipeline_id", pipeline.id)
        .range(from, to) as unknown as PromiseLike<{ data: RawDealRow[] | null; error: unknown }>,
    ),
    // Próximas atividades pendentes dos negócios deste funil. Filtra pelo
    // funil via join (deals!inner) em vez de .in("deal_id", [...]): com 2 mil
    // negócios a lista de ids estourava o tamanho da URL da API.
    fetchAllRows<NextActivityRow>((from, to) =>
      supabase
        .from("activities")
        .select("deal_id, subject, due_date, deals!inner ( pipeline_id )")
        .eq("deals.pipeline_id", pipeline.id)
        .eq("done", false)
        .order("due_date", { ascending: true })
        .range(from, to) as unknown as PromiseLike<{ data: NextActivityRow[] | null; error: unknown }>,
    ),
  ]);

  const stages = (stagesRes.data ?? []) as PipelineStage[];

  const nextActivityByDeal = new Map<string, { subject: string; due_date: string | null }>();
  for (const activity of nextActivities) {
    if (activity.deal_id && !nextActivityByDeal.has(activity.deal_id)) {
      nextActivityByDeal.set(activity.deal_id, activity);
    }
  }
  const rottingDaysByStage = new Map(stages.map((s) => [s.id, s.rotting_days]));

  const deals: PipelineDeal[] = dealRows.map((d) => {
    const next = nextActivityByDeal.get(d.id);
    const alerts = computeDealAlerts({
      nextActivityDue: next?.due_date ?? null,
      lastActivityAt: d.last_activity_at,
      rottingDays: rottingDaysByStage.get(d.stage_id) ?? null,
    });
    return {
      id: d.id,
      title: d.title,
      value: Number(d.value) || 0,
      stage_id: d.stage_id,
      owner_id: d.owner_id,
      source: d.source,
      status: d.status,
      expected_close_date: d.expected_close_date,
      created_at: d.created_at,
      updated_at: d.updated_at,
      closed_at: d.closed_at,
      organization_name: d.organizations?.name ?? null,
      contact_name: d.contacts?.name ?? null,
      owner_name: d.profiles?.full_name ?? "—",
      next_activity_subject: next?.subject ?? null,
      next_activity_due: next?.due_date ?? null,
      overdue_days: alerts.overdueDays,
      no_upcoming_activity: alerts.noUpcomingActivity,
      is_stagnant: alerts.isStagnant,
    };
  });

  return { pipelines, pipeline, stages, deals };
}
