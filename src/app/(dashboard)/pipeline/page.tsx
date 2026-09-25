import { createClient } from "@/lib/supabase/server";
import { PipelineBoard } from "@/components/pipeline/pipeline-board";
import { computeDealAlerts } from "@/lib/deal-alerts";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import type { OwnerOption, PipelineDeal, PipelineStage } from "@/components/pipeline/types";

export const metadata = { title: "Negócios" };

interface RawDealRow {
  id: string;
  title: string;
  value: number;
  stage_id: string;
  owner_id: string;
  source: string | null;
  status: "open" | "won" | "lost";
  expected_close_date: string | null;
  updated_at: string;
  last_activity_at: string | null;
  organizations: { name: string } | null;
  contacts: { name: string } | null;
  profiles: { full_name: string } | null;
}

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ pipeline?: string }>;
}) {
  const supabase = await createClient();
  const { pipeline: requestedPipelineId } = await searchParams;

  const { data: pipelines } = await supabase
    .from("pipelines")
    .select("id, name, is_default")
    .order("name");

  const selectedPipeline =
    (requestedPipelineId && pipelines?.find((p) => p.id === requestedPipelineId)) ||
    pipelines?.find((p) => p.is_default) ||
    pipelines?.[0];

  const pipelineId = selectedPipeline?.id;

  const [stagesRes, dealRows, profilesRes] = await Promise.all([
    pipelineId
      ? supabase
          .from("pipeline_stages")
          .select("id, name, order_index, pipeline_id, rotting_days")
          .eq("pipeline_id", pipelineId)
          .order("order_index")
      : Promise.resolve({ data: [] as PipelineStage[] }),
    pipelineId
      ? fetchAllRows<RawDealRow>((from, to) =>
          supabase
            .from("deals")
            .select(
              `id, title, value, stage_id, owner_id, source, status, expected_close_date, updated_at, last_activity_at,
               organizations ( name ),
               contacts ( name ),
               profiles!deals_owner_id_fkey ( full_name )`,
            )
            .eq("pipeline_id", pipelineId)
            .range(from, to) as unknown as PromiseLike<{ data: RawDealRow[] | null; error: unknown }>,
        )
      : Promise.resolve([] as RawDealRow[]),
    supabase.from("profiles").select("id, full_name"),
  ]);

  const dealIds = dealRows.map((d) => d.id);

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

  const rottingDaysByStage = new Map(
    (stagesRes.data ?? []).map((s: any) => [s.id, s.rotting_days as number | null]),
  );

  const deals: PipelineDeal[] = dealRows.map((d: any) => {
    const nextActivityDue = nextActivityByDeal.get(d.id)?.due_date ?? null;
    const alerts = computeDealAlerts({
      nextActivityDue,
      lastActivityAt: d.last_activity_at,
      rottingDays: rottingDaysByStage.get(d.stage_id) ?? null,
    });

    return {
      id: d.id,
      title: d.title,
      value: d.value ?? 0,
      stage_id: d.stage_id,
      owner_id: d.owner_id,
      source: d.source,
      status: d.status,
      expected_close_date: d.expected_close_date,
      updated_at: d.updated_at,
      organization_name: d.organizations?.name ?? null,
      contact_name: d.contacts?.name ?? null,
      owner_name: d.profiles?.full_name ?? "—",
      next_activity_subject: nextActivityByDeal.get(d.id)?.subject ?? null,
      next_activity_due: nextActivityDue,
      overdue_days: alerts.overdueDays,
      no_upcoming_activity: alerts.noUpcomingActivity,
      is_stagnant: alerts.isStagnant,
    };
  });

  const owners: OwnerOption[] = profilesRes.data ?? [];

  return (
    <PipelineBoard
      key={pipelineId ?? "none"}
      pipelines={pipelines ?? []}
      selectedPipelineId={pipelineId ?? null}
      stages={(stagesRes.data as PipelineStage[]) ?? []}
      initialDeals={deals}
      owners={owners}
    />
  );
}
