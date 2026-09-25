import { createClient } from "@/lib/supabase/server";
import {
  canReassignOwner,
  getCurrentUser,
  loadOrganizationRows,
  loadOwners,
} from "@/lib/data/lists";
import { PageHeader } from "@/components/ui/page-header";
import { OrganizationsToolbar } from "./organizations-toolbar";
import { OrganizationsList } from "./organizations-list";

export const metadata = { title: "Organizações" };

export default async function OrganizationsPage() {
  const supabase = await createClient();
  const [owners, me] = await Promise.all([loadOwners(supabase), getCurrentUser()]);
  const organizations = await loadOrganizationRows(supabase, owners);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Organizações"
        description="Empresas clientes e prospects"
        actions={<OrganizationsToolbar />}
      />

      <OrganizationsList
        organizations={organizations}
        owners={owners}
        canReassign={canReassignOwner(me?.role)}
      />
    </div>
  );
}
