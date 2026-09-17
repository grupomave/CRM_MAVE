import { createClient } from "@/lib/supabase/server";
import { LeadsToolbar } from "./leads-toolbar";
import { LeadsList } from "./leads-list";

export default async function LeadsPage() {
  const supabase = await createClient();
  const { data: leads } = await supabase
    .from("leads")
    .select("id, name, contact_info, source, status, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Leads</h1>
          <p className="text-sm text-muted-foreground">
            Caixa de entrada de leads não qualificados
          </p>
        </div>
        <LeadsToolbar />
      </div>

      <LeadsList leads={leads ?? []} />
    </div>
  );
}
