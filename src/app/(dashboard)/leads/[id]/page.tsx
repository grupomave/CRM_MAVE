import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LeadDetailForm } from "./lead-detail-form";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: lead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .single();

  if (!lead) notFound();

  const { data: pipelines } = await supabase
    .from("pipelines")
    .select("id, name, is_default")
    .order("name");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{lead.name}</h1>
        <p className="text-sm text-muted-foreground">Lead</p>
      </div>

      <LeadDetailForm lead={lead as any} pipelines={pipelines ?? []} />
    </div>
  );
}
