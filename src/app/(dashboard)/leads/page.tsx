import { createClient } from "@/lib/supabase/server";
import { LeadsToolbar } from "./leads-toolbar";
import { LeadsList } from "./leads-list";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Leads" };

export default async function LeadsPage() {
  const supabase = await createClient();
  const { data: leads } = await supabase
    .from("leads")
    .select("id, name, contact_info, source, status, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Leads"
        description="Caixa de entrada de leads não qualificados"
        actions={<LeadsToolbar />}
      />

      <LeadsList leads={leads ?? []} />
    </div>
  );
}
