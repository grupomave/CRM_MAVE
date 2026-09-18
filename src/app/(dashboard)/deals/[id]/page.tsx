import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DealDetailTabs } from "./deal-detail-tabs";
import { DEAL_STATUS_LABEL, LOST_REASON_LABEL } from "@/lib/supabase/types";
import { computeDealAlerts } from "@/lib/deal-alerts";
import { fetchAllRows } from "@/lib/supabase/fetch-all";

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: deal } = await supabase
    .from("deals")
    .select(
      `id, title, value, currency, status, expected_close_date, source, stage_id, pipeline_id,
       lost_reason, frozen_at, last_activity_at, organization_id, contact_id, owner_id,
       organizations ( id, name ),
       contacts ( id, name, phone, whatsapp ),
       profiles!deals_owner_id_fkey ( full_name )`,
    )
    .eq("id", id)
    .single();

  if (!deal) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: myProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id ?? "")
    .single();

  const [
    stagesRes,
    activitiesRes,
    notesRes,
    attachmentsRes,
    stageHistoryRes,
    statusHistoryRes,
    organizationsRes,
    contactsRes,
    ownersRes,
    proposalsRes,
  ] = await Promise.all([
    supabase
      .from("pipeline_stages")
      .select("id, name, order_index, rotting_days")
      .eq("pipeline_id", (deal as any).pipeline_id)
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
      .select("id, file_name, storage_path, size_bytes, created_at, category, expires_at")
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
    fetchAllRows((from, to) =>
      supabase.from("organizations").select("id, name").order("name").range(from, to),
    ),
    fetchAllRows((from, to) =>
      supabase.from("contacts").select("id, name").order("name").range(from, to),
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

  const proposalIds = ((proposalsRes.data ?? []) as any[]).map((p) => p.id as string);
  const proposalVersionsRes = proposalIds.length
    ? await supabase
        .from("proposal_versions")
        .select(
          "id, proposal_id, version_number, value, scope, conditions, file_name, storage_path, created_at, profiles ( full_name )",
        )
        .in("proposal_id", proposalIds)
        .order("version_number", { ascending: false })
    : { data: [] as any[] };

  const stageNameById = new Map(
    (stagesRes.data ?? []).map((s) => [s.id, s.name]),
  );

  const stageEvents = (stageHistoryRes.data ?? []).map((h: any) => ({
    id: `stage-${h.id}`,
    kind: "stage" as const,
    label: `${h.from_stage_id ? stageNameById.get(h.from_stage_id) ?? "—" : "—"} → ${stageNameById.get(h.to_stage_id) ?? "—"}`,
    changed_at: h.changed_at,
    profiles: h.profiles,
  }));

  const statusEvents = (statusHistoryRes.data ?? []).map((h: any) => ({
    id: `status-${h.id}`,
    kind: "status" as const,
    label: `${DEAL_STATUS_LABEL[h.from_status as keyof typeof DEAL_STATUS_LABEL] ?? h.from_status} → ${DEAL_STATUS_LABEL[h.to_status as keyof typeof DEAL_STATUS_LABEL] ?? h.to_status}${h.reason ? ` (${LOST_REASON_LABEL[h.reason as keyof typeof LOST_REASON_LABEL] ?? h.reason})` : ""}`,
    changed_at: h.changed_at,
    profiles: h.profiles,
  }));

  const history = [...stageEvents, ...statusEvents].sort(
    (a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime(),
  );

  const versionsByProposal = new Map<string, any[]>();
  for (const v of (proposalVersionsRes.data ?? []) as any[]) {
    if (!versionsByProposal.has(v.proposal_id)) versionsByProposal.set(v.proposal_id, []);
    versionsByProposal.get(v.proposal_id)!.push(v);
  }

  const proposals = (proposalsRes.data ?? []).map((p: any) => ({
    id: p.id,
    status: p.status,
    valid_until: p.valid_until,
    requires_approval: p.requires_approval,
    approved_at: p.approved_at,
    approved_by_name: p.profiles?.full_name ?? null,
    created_at: p.created_at,
    versions: versionsByProposal.get(p.id) ?? [],
  }));

  const currentStage = (stagesRes.data ?? []).find(
    (s) => s.id === (deal as any).stage_id,
  );
  const nextActivity = (activitiesRes.data ?? []).find((a) => !a.done);
  const alerts = computeDealAlerts({
    nextActivityDue: nextActivity?.due_date ?? null,
    lastActivityAt: (deal as any).last_activity_at,
    rottingDays: currentStage?.rotting_days ?? null,
  });

  return (
    <DealDetailTabs
      deal={deal as any}
      alerts={alerts}
      stages={stagesRes.data ?? []}
      activities={activitiesRes.data ?? []}
      notes={(notesRes.data ?? []) as any}
      attachments={attachmentsRes.data ?? []}
      history={history}
      organizations={organizationsRes}
      contacts={contactsRes}
      owners={ownersRes.data ?? []}
      canEditOwner={myProfile?.role === "admin" || myProfile?.role === "gestor"}
      proposals={proposals}
    />
  );
}
