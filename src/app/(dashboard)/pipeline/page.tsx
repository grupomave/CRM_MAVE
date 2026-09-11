import { createClient } from "@/lib/supabase/server";
import { PipelineBoard } from "@/components/pipeline/pipeline-board";
import type { OwnerOption, PipelineDeal, PipelineStage } from "@/components/pipeline/types";

interface RawDealRow {
  id: string;
  title: string;
  value: number;
  stage_id: string;
  owner_id: string;
  source: string | null;
  expected_close_date: string | null;
  updated_at: string;
  organizations: { name: string } | null;
  profiles: { full_name: string } | null;
}

export default async function PipelinePage() {
  const supabase = await createClient();

  const { data: pipeline } = await supabase
    .from("pipelines")
    .select("id")
    .eq("is_default", true)
    .single();

  const pipelineId = pipeline?.id;

  const [stagesRes, dealsRes, profilesRes] = await Promise.all([
    pipelineId
      ? supabase
          .from("pipeline_stages")
          .select("id, name, order_index, pipeline_id")
          .eq("pipeline_id", pipelineId)
          .order("order_index")
      : Promise.resolve({ data: [] as PipelineStage[] }),
    pipelineId
      ? supabase
          .from("deals")
          .select(
            `id, title, value, stage_id, owner_id, source, expected_close_date, updated_at,
             organizations ( name ),
             profiles ( full_name )`,
          )
          .eq("pipeline_id", pipelineId)
          .eq("status", "open")
      : Promise.resolve({ data: [] as RawDealRow[] }),
    supabase.from("profiles").select("id, full_name"),
  ]);

  const dealIds = (dealsRes.data ?? []).map((d) => d.id as string);

  const { data: nextActivities } = dealIds.length
    ? await supabase
        .from("activities")
        .select("deal_id, subject, due_date")
        .in("deal_id", dealIds)
        .eq("done", false)
        .order("due_date", { ascending: true })
    : { data: [] as { deal_id: string | null; subject: string; due_date: string | null }[] };

  const nextActivityByDeal = new Map<string, { subject: string; due_date: string | null }>();
  for (const activity of nextActivities ?? []) {
    if (activity.deal_id && !nextActivityByDeal.has(activity.deal_id)) {
      nextActivityByDeal.set(activity.deal_id, activity);
    }
  }

  const deals: PipelineDeal[] = (dealsRes.data ?? []).map((d: any) => ({
    id: d.id,
    title: d.title,
    value: d.value ?? 0,
    stage_id: d.stage_id,
    owner_id: d.owner_id,
    source: d.source,
    expected_close_date: d.expected_close_date,
    updated_at: d.updated_at,
    organization_name: d.organizations?.name ?? null,
    owner_name: d.profiles?.full_name ?? "—",
    next_activity_subject: nextActivityByDeal.get(d.id)?.subject ?? null,
    next_activity_due: nextActivityByDeal.get(d.id)?.due_date ?? null,
  }));

  const owners: OwnerOption[] = profilesRes.data ?? [];

  return (
    <PipelineBoard
      stages={(stagesRes.data as PipelineStage[]) ?? []}
      initialDeals={deals}
      owners={owners}
    />
  );
}
