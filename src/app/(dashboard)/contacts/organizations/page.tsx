import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { OrganizationsToolbar } from "./organizations-toolbar";
import { OrganizationsList, type OrganizationRow } from "./organizations-list";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Organizações" };

interface OrganizationBase {
  id: string;
  name: string;
  cnpj: string | null;
  sector: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  profiles: { full_name: string } | null;
}

interface ContactRef {
  organization_id: string | null;
}

interface DealRef {
  organization_id: string | null;
  value: number;
  status: "open" | "won" | "lost";
}

export default async function OrganizationsPage() {
  const supabase = await createClient();

  const [organizations, contacts, deals] = await Promise.all([
    fetchAllRows<OrganizationBase>((from, to) =>
      supabase
        .from("organizations")
        .select(
          "id, name, cnpj, sector, city, state, phone, profiles!organizations_owner_id_fkey ( full_name )",
        )
        .order("created_at", { ascending: false })
        .range(from, to) as any,
    ),
    fetchAllRows<ContactRef>((from, to) =>
      supabase.from("contacts").select("organization_id").range(from, to),
    ),
    fetchAllRows<DealRef>((from, to) =>
      supabase.from("deals").select("organization_id, value, status").range(from, to),
    ),
  ]);

  const contactsCountByOrg = new Map<string, number>();
  for (const c of contacts) {
    if (!c.organization_id) continue;
    contactsCountByOrg.set(
      c.organization_id,
      (contactsCountByOrg.get(c.organization_id) ?? 0) + 1,
    );
  }

  const dealsStatsByOrg = new Map<
    string,
    { openCount: number; openValue: number; wonValue: number }
  >();
  for (const d of deals) {
    if (!d.organization_id) continue;
    const stats =
      dealsStatsByOrg.get(d.organization_id) ??
      { openCount: 0, openValue: 0, wonValue: 0 };
    if (d.status === "open") {
      stats.openCount += 1;
      stats.openValue += d.value;
    } else if (d.status === "won") {
      stats.wonValue += d.value;
    }
    dealsStatsByOrg.set(d.organization_id, stats);
  }

  const rows: OrganizationRow[] = organizations.map((o) => ({
    id: o.id,
    name: o.name,
    cnpj: o.cnpj,
    sector: o.sector,
    city: o.city,
    state: o.state,
    phone: o.phone,
    ownerName: o.profiles?.full_name ?? null,
    contactsCount: contactsCountByOrg.get(o.id) ?? 0,
    openDealsCount: dealsStatsByOrg.get(o.id)?.openCount ?? 0,
    openDealsValue: dealsStatsByOrg.get(o.id)?.openValue ?? 0,
    wonDealsValue: dealsStatsByOrg.get(o.id)?.wonValue ?? 0,
  }));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Organizações"
        description="Empresas clientes e prospects"
        actions={<OrganizationsToolbar />}
      />

      <OrganizationsList organizations={rows} />
    </div>
  );
}
