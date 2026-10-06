import { createClient } from "@/lib/supabase/server";
import { loadCatalog, selectableItems } from "@/lib/data/catalogs";
import { canReassignOwner, getCurrentUser, loadLeadRows, loadOwners } from "@/lib/data/lists";
import { PageHeader } from "@/components/ui/page-header";
import { ExportExcelButton } from "@/components/list/export-excel-button";
import { LeadsToolbar } from "./leads-toolbar";
import { LeadsList } from "./leads-list";

export const metadata = { title: "Leads" };

export default async function LeadsPage() {
  const supabase = await createClient();
  const [owners, me, sourceCatalog] = await Promise.all([
    loadOwners(supabase),
    getCurrentUser(),
    loadCatalog(supabase, "lead_sources"),
  ]);
  const leads = await loadLeadRows(supabase, owners);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Leads"
        description="Caixa de entrada de leads não qualificados"
        actions={
          <>
            <ExportExcelButton entity="leads" />
            <LeadsToolbar
              sources={selectableItems(sourceCatalog)}
              owners={owners.filter((o) => o.is_active)}
              currentUserId={me?.id ?? ""}
              canReassign={canReassignOwner(me?.role)}
            />
          </>
        }
      />

      <LeadsList leads={leads} owners={owners} canReassign={canReassignOwner(me?.role)} />
    </div>
  );
}
