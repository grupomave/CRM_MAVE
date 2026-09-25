import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import type { LeadRow } from "@/lib/filters/leads";
import type { OrganizationRow } from "@/lib/filters/organizations";
import type { PersonRow } from "@/lib/filters/people";
import type { UserRole } from "@/lib/supabase/types";

// Carregadores das listagens. Rodam com o cliente Supabase do usuário
// logado, então a RLS decide o que cada um enxerga (vendedor: só os seus;
// gestor: equipe; admin: tudo). A página e a exportação para Excel usam as
// mesmas funções — o que a tela mostra é exatamente o que é exportado.

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface OwnerOption {
  id: string;
  full_name: string;
  is_active: boolean;
}

export interface CurrentUser {
  id: string;
  email: string | null;
  full_name: string;
  role: UserRole;
}

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();
  return {
    id: user.id,
    email: user.email ?? null,
    full_name: profile?.full_name ?? user.email ?? "Usuário",
    role: (profile?.role as UserRole) ?? "vendedor",
  };
});

// Quem pode reatribuir responsável em massa (a RLS ainda valida no banco)
export function canReassignOwner(role: UserRole | undefined) {
  return role === "admin" || role === "gestor";
}

export async function loadOwners(supabase: Supabase): Promise<OwnerOption[]> {
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, is_active")
    .order("full_name");
  return (data ?? []) as OwnerOption[];
}

function ownerNames(owners: OwnerOption[]) {
  return new Map(owners.map((o) => [o.id, o.full_name]));
}

export async function loadLeadRows(supabase: Supabase, owners: OwnerOption[]): Promise<LeadRow[]> {
  const names = ownerNames(owners);
  const rows = await fetchAllRows<Omit<LeadRow, "owner_name">>((from, to) =>
    supabase
      .from("leads")
      .select("id, name, contact_info, source, status, created_at, owner_id")
      .order("created_at", { ascending: false })
      .range(from, to),
  );
  return rows.map((l) => ({ ...l, owner_name: names.get(l.owner_id) ?? null }));
}

interface RawPerson {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  job_title: string | null;
  created_at: string;
  owner_id: string;
  organization_id: string | null;
  organizations: { name: string } | null;
}

export async function loadPersonRows(
  supabase: Supabase,
  owners: OwnerOption[],
): Promise<PersonRow[]> {
  const names = ownerNames(owners);
  const rows = await fetchAllRows<RawPerson>((from, to) =>
    supabase
      .from("contacts")
      .select(
        "id, name, email, phone, whatsapp, job_title, created_at, owner_id, organization_id, organizations ( name )",
      )
      .order("created_at", { ascending: false })
      .range(from, to) as unknown as PromiseLike<{ data: RawPerson[] | null; error: unknown }>,
  );
  return rows.map(({ organizations, ...p }) => ({
    ...p,
    owner_name: names.get(p.owner_id) ?? null,
    organization_name: organizations?.name ?? null,
  }));
}

interface RawOrganization {
  id: string;
  name: string;
  cnpj: string | null;
  sector: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  created_at: string;
  owner_id: string;
}

export async function loadOrganizationRows(
  supabase: Supabase,
  owners: OwnerOption[],
): Promise<OrganizationRow[]> {
  const names = ownerNames(owners);
  const [organizations, contacts, deals] = await Promise.all([
    fetchAllRows<RawOrganization>((from, to) =>
      supabase
        .from("organizations")
        .select("id, name, cnpj, sector, city, state, phone, created_at, owner_id")
        .order("created_at", { ascending: false })
        .range(from, to),
    ),
    fetchAllRows<{ organization_id: string | null }>((from, to) =>
      supabase.from("contacts").select("organization_id").range(from, to),
    ),
    fetchAllRows<{ organization_id: string | null; value: number; status: string }>((from, to) =>
      supabase.from("deals").select("organization_id, value, status").range(from, to),
    ),
  ]);

  const contactsByOrg = new Map<string, number>();
  for (const c of contacts) {
    if (!c.organization_id) continue;
    contactsByOrg.set(c.organization_id, (contactsByOrg.get(c.organization_id) ?? 0) + 1);
  }

  const statsByOrg = new Map<string, { openCount: number; openValue: number; wonValue: number }>();
  for (const d of deals) {
    if (!d.organization_id) continue;
    const stats = statsByOrg.get(d.organization_id) ?? { openCount: 0, openValue: 0, wonValue: 0 };
    if (d.status === "open") {
      stats.openCount += 1;
      stats.openValue += Number(d.value) || 0;
    } else if (d.status === "won") {
      stats.wonValue += Number(d.value) || 0;
    }
    statsByOrg.set(d.organization_id, stats);
  }

  return organizations.map((o) => ({
    ...o,
    owner_name: names.get(o.owner_id) ?? null,
    contacts_count: contactsByOrg.get(o.id) ?? 0,
    open_deals_count: statsByOrg.get(o.id)?.openCount ?? 0,
    open_deals_value: statsByOrg.get(o.id)?.openValue ?? 0,
    won_deals_value: statsByOrg.get(o.id)?.wonValue ?? 0,
  }));
}
