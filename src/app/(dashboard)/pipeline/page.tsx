import { createClient } from "@/lib/supabase/server";
import { PipelineBoard } from "@/components/pipeline/pipeline-board";
import { canReassignOwner, getCurrentUser } from "@/lib/data/lists";
import { loadPipelineData } from "@/lib/data/deals";
import type { OwnerOption } from "@/components/pipeline/types";

export const metadata = { title: "Negócios" };

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ pipeline?: string }>;
}) {
  const supabase = await createClient();
  const { pipeline: requestedPipelineId } = await searchParams;

  const [{ pipelines, pipeline, stages, deals }, profilesRes, me] = await Promise.all([
    loadPipelineData(supabase, requestedPipelineId),
    supabase.from("profiles").select("id, full_name, is_active").order("full_name"),
    getCurrentUser(),
  ]);

  const owners: OwnerOption[] = profilesRes.data ?? [];

  return (
    <PipelineBoard
      key={pipeline?.id ?? "none"}
      pipelines={pipelines}
      selectedPipelineId={pipeline?.id ?? null}
      stages={stages}
      initialDeals={deals}
      owners={owners}
      canReassign={canReassignOwner(me?.role)}
      userId={me?.id ?? null}
      initialPreferences={me?.preferences ?? {}}
    />
  );
}
