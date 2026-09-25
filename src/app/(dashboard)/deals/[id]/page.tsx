import type { ComponentProps } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEAL_STATUS_LABEL, LOST_REASON_LABEL } from "@/lib/supabase/types";
import { computeDealAlerts } from "@/lib/deal-alerts";
import { computeStageDays, daysSince } from "@/lib/deal-metrics";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { getCurrentUser } from "@/lib/data/lists";
import { DealHeader } from "./deal-header";
import { DealSidebar } from "./deal-sidebar";
import { DealWorkspace } from "./deal-workspace";
import {
  ACTIVITY_TYPE_LABEL,
  type ActivityItem,
  type DealDetail,
  type StageOption,
  type TimelineItem,
} from "./types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("deals").select("title").eq("id", id).maybeSingle();
  return { title: data?.title ?? "Negócio" };
}

type Named = { full_name: string } | null;

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: dealRow } = await supabase
    .from("deals")
    .select(
      `id, title, value, currency, status, expected_close_date, source, stage_id, pipeline_id,
       lost_reason, frozen_at, last_activity_at, created_at, organization_id, contact_id, owner_id,
       organizations ( id, name ),
       contacts ( id, name, phone, whatsapp ),
       profiles!deals_owner_id_fkey ( full_name )`,
    )
    .eq("id", id)
    .single();

  if (!dealRow) notFound();
  const deal = dealRow as unknown as DealDetail;
  const me = await getCurrentUser();
  const canManage = me?.role === "admin" || me?.role === "gestor";

  const [
    pipelineRes,
    stagesRes,
    activitiesRes,
    notesRes,
    attachmentsRes,
    stageHistoryRes,
    statusHistoryRes,
    organizations,
    contacts,
    ownersRes,
    proposalsRes,
  ] = await Promise.all([
    supabase.from("pipelines").select("id, name").eq("id", deal.pipeline_id).maybeSingle(),
    supabase
      .from("pipeline_stages")
      .select("id, name, order_index, rotting_days")
      .eq("pipeline_id", deal.pipeline_id)
      .order("order_index"),
    supabase
      .from("activities")
      .select("id, type, subject, due_date, done")
      .eq("deal_id", id)
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("notes")
      .select("id, content, created_at, profiles ( full_name )")
      .eq("deal_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("attachments")
      .select("id, file_name, storage_path, size_bytes, created_at, category, expires_at, profiles ( full_name )")
      .eq("entity_type", "deal")
      .eq("entity_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("deal_stage_history")
      .select("id, from_stage_id, to_stage_id, changed_at, profiles ( full_name )")
      .eq("deal_id", id)
      .order("changed_at", { ascending: false }),
    supabase
      .from("deal_status_history")
      .select("id, from_status, to_status, reason, changed_at, profiles ( full_name )")
      .eq("deal_id", id)
      .order("changed_at", { ascending: false }),
    fetchAllRows<{ id: string; name: string; city: string | null }>((from, to) =>
      supabase.from("organizations").select("id, name, city").order("name").range(from, to),
    ),
    fetchAllRows<{ id: string; name: string; email: string | null }>((from, to) =>
      supabase.from("contacts").select("id, name, email").order("name").range(from, to),
    ),
    supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name"),
    supabase
      .from("proposals")
      .select(
        "id, status, valid_until, requires_approval, approved_at, current_version_id, created_at, profiles!proposals_approved_by_fkey ( full_name )",
      )
      .eq("deal_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const proposalIds = ((proposalsRes.data ?? []) as { id: string }[]).map((p) => p.id);
  const proposalVersionsRes = proposalIds.length
    ? await supabase
        .from("proposal_versions")
        .select(
          "id, proposal_id, version_number, value, scope, conditions, file_name, storage_path, created_at, profiles ( full_name )",
        )
        .in("proposal_id", proposalIds)
        .order("version_number", { ascending: false })
    : { data: [] as unknown[] };

  const stages = (stagesRes.data ?? []) as StageOption[];
  const activities = (activitiesRes.data ?? []) as ActivityItem[];
  const stageNameById = new Map(stages.map((s) => [s.id, s.name]));
  const stageHistory = (stageHistoryRes.data ?? []) as unknown as {
    id: string;
    from_stage_id: string | null;
    to_stage_id: string;
    changed_at: string;
    profiles: Named;
  }[];
  const statusHistory = (statusHistoryRes.data ?? []) as unknown as {
    id: string;
    from_status: keyof typeof DEAL_STATUS_LABEL;
    to_status: keyof typeof DEAL_STATUS_LABEL;
    reason: keyof typeof LOST_REASON_LABEL | null;
    changed_at: string;
    profiles: Named;
  }[];
  const notes = (notesRes.data ?? []) as unknown as {
    id: string;
    content: string;
    created_at: string;
    profiles: Named;
  }[];
  const attachments = (attachmentsRes.data ?? []) as unknown as {
    id: string;
    file_name: string;
    storage_path: string;
    size_bytes: number;
    created_at: string;
    category: string | null;
    expires_at: string | null;
    profiles: Named;
  }[];

  // Linha do tempo única (mais recente primeiro): anotações, atividades
  // concluídas, mudanças de etapa/status e arquivos anexados.
  const timeline: TimelineItem[] = [
    ...notes.map((n) => ({
      id: `note-${n.id}`,
      kind: "note" as const,
      title: "Anotação",
      body: n.content,
      at: n.created_at,
      actor: n.profiles?.full_name ?? null,
    })),
    ...activities
      .filter((a) => a.done)
      .map((a) => ({
        id: `activity-${a.id}`,
        kind: "activity" as const,
        title: `${ACTIVITY_TYPE_LABEL[a.type] ?? a.type} concluída`,
        body: a.subject,
        at: a.due_date ?? deal.created_at,
        actor: null,
      })),
    ...stageHistory.map((h) => ({
      id: `stage-${h.id}`,
      kind: "stage" as const,
      title: "Etapa alterada",
      body: `${h.from_stage_id ? (stageNameById.get(h.from_stage_id) ?? "—") : "—"} → ${stageNameById.get(h.to_stage_id) ?? "etapa de outro funil"}`,
      at: h.changed_at,
      actor: h.profiles?.full_name ?? null,
    })),
    ...statusHistory.map((h) => ({
      id: `status-${h.id}`,
      kind: "status" as const,
      title: "Status alterado",
      body: `${DEAL_STATUS_LABEL[h.from_status] ?? h.from_status} → ${DEAL_STATUS_LABEL[h.to_status] ?? h.to_status}${h.reason ? ` (${LOST_REASON_LABEL[h.reason] ?? h.reason})` : ""}`,
      at: h.changed_at,
      actor: h.profiles?.full_name ?? null,
    })),
    ...attachments.map((a) => ({
      id: `file-${a.id}`,
      kind: "file" as const,
      title: "Arquivo anexado",
      body: a.file_name,
      at: a.created_at,
      actor: a.profiles?.full_name ?? null,
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const versionsByProposal = new Map<string, unknown[]>();
  for (const v of (proposalVersionsRes.data ?? []) as { proposal_id: string }[]) {
    if (!versionsByProposal.has(v.proposal_id)) versionsByProposal.set(v.proposal_id, []);
    versionsByProposal.get(v.proposal_id)!.push(v);
  }
  type RawProposal = {
    id: string;
    status: string;
    valid_until: string | null;
    requires_approval: boolean;
    approved_at: string | null;
    created_at: string;
    profiles: Named;
  };
  const proposals = ((proposalsRes.data ?? []) as unknown as RawProposal[]).map((p) => ({
    id: p.id,
    status: p.status,
    valid_until: p.valid_until,
    requires_approval: p.requires_approval,
    approved_at: p.approved_at,
    approved_by_name: p.profiles?.full_name ?? null,
    created_at: p.created_at,
    versions: versionsByProposal.get(p.id) ?? [],
  })) as unknown as ComponentProps<typeof DealWorkspace>["proposals"];

  const currentStage = stages.find((s) => s.id === deal.stage_id);
  const nextActivity = activities.find((a) => !a.done);
  const alerts = computeDealAlerts({
    nextActivityDue: nextActivity?.due_date ?? null,
    lastActivityAt: deal.last_activity_at,
    rottingDays: currentStage?.rotting_days ?? null,
  });

  const oldestChange = stageHistory[stageHistory.length - 1];
  const { days: stageDays, daysInCurrent } = computeStageDays({
    createdAt: deal.created_at,
    currentStageId: deal.stage_id,
    firstFromStageId: oldestChange?.from_stage_id ?? null,
    changes: stageHistory,
  });

  const activityCounts = activities.reduce<Record<string, number>>((acc, a) => {
    acc[a.type] = (acc[a.type] ?? 0) + 1;
    return acc;
  }, {});

  const owners = ((ownersRes.data ?? []) as { id: string; full_name: string }[]).map((o) => ({
    id: o.id,
    label: o.full_name,
  }));

  return (
    <div className="mx-auto flex w-full max-w-detail flex-col gap-5">
      <DealHeader
        deal={deal}
        pipelineName={pipelineRes.data?.name ?? "Funil"}
        stages={stages}
        stageDays={Object.fromEntries(stageDays)}
        daysInCurrent={daysInCurrent}
        alerts={alerts}
        canManage={canManage}
        reportData={{
          deal: {
            title: deal.title,
            value: deal.value,
            status: deal.status,
            expected_close_date: deal.expected_close_date,
            source: deal.source,
            lost_reason: deal.lost_reason,
            organizations: deal.organizations,
            contacts: deal.contacts,
            profiles: deal.profiles,
          },
          activities,
          attachments,
        }}
      />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <DealSidebar
          deal={deal}
          overview={{
            ageDays: daysSince(deal.created_at) ?? 0,
            daysSinceLastActivity: daysSince(deal.last_activity_at),
            activityCounts,
          }}
          organizations={organizations.map((o) => ({ id: o.id, label: o.name, description: o.city }))}
          contacts={contacts.map((c) => ({ id: c.id, label: c.name, description: c.email }))}
          owners={owners}
          canEditOwner={canManage}
        />
        <DealWorkspace
          dealId={deal.id}
          activities={activities}
          attachments={attachments}
          proposals={proposals}
          timeline={timeline}
        />
      </div>
    </div>
  );
}
