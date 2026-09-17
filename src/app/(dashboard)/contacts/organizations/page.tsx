import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { OrganizationsToolbar } from "./organizations-toolbar";
import { OrganizationsList, type OrganizationRow } from "./organizations-list";

export default async function OrganizationsPage() {
  const supabase = await createClient();
  const organizations = await fetchAllRows<OrganizationRow>((from, to) =>
    supabase
      .from("organizations")
      .select("id, name, cnpj, sector")
      .order("created_at", { ascending: false })
      .range(from, to),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Organizações</h1>
          <p className="text-sm text-muted-foreground">Empresas clientes e prospects</p>
        </div>
        <OrganizationsToolbar />
      </div>

      <OrganizationsList organizations={organizations ?? []} />
    </div>
  );
}
