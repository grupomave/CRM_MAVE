import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LeadDetailForm } from "./lead-detail-form";
import { PageHeader } from "@/components/ui/page-header";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("leads").select("name").eq("id", id).maybeSingle();
  return { title: data?.name ?? "Lead" };
}

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
    <div className="mx-auto flex w-full max-w-detail flex-col gap-6">
      <PageHeader
        title={lead.name}
        breadcrumbs={[{ label: "Leads", href: "/leads" }, { label: lead.name }]}
      />

      <LeadDetailForm lead={lead as any} pipelines={pipelines ?? []} />
    </div>
  );
}
