import { createClient } from "@/lib/supabase/server";
import { canReassignOwner, getCurrentUser, loadLeadRows, loadOwners } from "@/lib/data/lists";
import { PageHeader } from "@/components/ui/page-header";
import { LeadsToolbar } from "./leads-toolbar";
import { LeadsList } from "./leads-list";

export const metadata = { title: "Leads" };

export default async function LeadsPage() {
  const supabase = await createClient();
  const [owners, me] = await Promise.all([loadOwners(supabase), getCurrentUser()]);
  const leads = await loadLeadRows(supabase, owners);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Leads"
        description="Caixa de entrada de leads não qualificados"
        actions={<LeadsToolbar />}
      />

      <LeadsList leads={leads} owners={owners} canReassign={canReassignOwner(me?.role)} />
    </div>
  );
}
