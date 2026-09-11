import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DealDetailTabs } from "./deal-detail-tabs";

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
       organizations ( id, name ),
       contacts ( id, name ),
       profiles ( full_name )`,
    )
    .eq("id", id)
    .single();

  if (!deal) notFound();

  const [stagesRes, activitiesRes, notesRes, attachmentsRes, historyRes] =
    await Promise.all([
      supabase
        .from("pipeline_stages")
        .select("id, name, order_index")
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
        .select("id, file_name, storage_path, size_bytes, created_at")
        .eq("entity_type", "deal")
        .eq("entity_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("deal_stage_history")
        .select("id, from_stage_id, to_stage_id, changed_at, profiles ( full_name )")
        .eq("deal_id", id)
        .order("changed_at", { ascending: false }),
    ]);

  const stageNameById = new Map(
    (stagesRes.data ?? []).map((s) => [s.id, s.name]),
  );

  return (
    <DealDetailTabs
      deal={deal as any}
      stages={stagesRes.data ?? []}
      activities={activitiesRes.data ?? []}
      notes={(notesRes.data ?? []) as any}
      attachments={attachmentsRes.data ?? []}
      history={(historyRes.data ?? []).map((h: any) => ({
        ...h,
        from_stage_name: h.from_stage_id ? stageNameById.get(h.from_stage_id) ?? "—" : "—",
        to_stage_name: stageNameById.get(h.to_stage_id) ?? "—",
      }))}
    />
  );
}
