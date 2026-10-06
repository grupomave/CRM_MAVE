import "server-only";

import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { defaultTwelveMonthRange, saoPauloDayBounds } from "@/lib/date-range";
import { isoDaysAgo } from "@/lib/utils";

// Dados do Dashboard. A página inicial e as telas de detalhe dos cards
// (/dashboard/detalhe/[kpi]) usam este MESMO carregador, então o número do card
// e a lista que abre ao clicar nele sempre batem.

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface DashboardDeal {
  id: string;
  title: string;
  value: number;
  status: "open" | "won" | "lost";
  stage_id: string;
  pipeline_id: string;
  organization_id: string | null;
  owner_id: string;
  updated_at: string;
  closed_at: string | null;
  created_at: string;
  organization_name: string | null;
  owner_name: string | null;
}

export interface DashboardActivity {
  id: string;
  subject: string;
  due_date: string | null;
  type: string;
  deal_id: string | null;
  deal_title: string | null;
  owner_name: string | null;
}

export interface DashboardParams {
  pipeline?: string;
  from?: string;
  to?: string;
}

const DAY = 86400000;
export const STALLED_DAYS = 14;

export const closedAt = (d: DashboardDeal) => d.closed_at ?? d.updated_at;

export function change(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null;
  return (current - previous) / previous;
}

export interface PeriodStats {
  created: DashboardDeal[];
  won: DashboardDeal[];
  lost: DashboardDeal[];
  wonValue: number;
  winRate: number;
}

export interface DashboardOrg {
  id: string;
  name: string;
  /** Primeiro negócio ganho (novos clientes) ou negócio perdido mais recente (clientes perdidos) */
  deal: DashboardDeal;
}

export async function loadDashboardData(supabase: Supabase, params: DashboardParams) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user?.id ?? "")
    .single();

  // Vendedor só enxerga os próprios negócios; gestor e admin têm visão da equipe
  const isVendedor = myProfile?.role === "vendedor";
  const rawName = myProfile?.full_name?.trim() ?? "";
  const firstName = rawName && !rawName.includes("@") ? rawName.split(" ")[0] : "";

  const today = new Date();
  const { start: todayStart, end: todayEnd } = saoPauloDayBounds(today);

  const { data: pipelines } = await supabase.from("pipelines").select("id, name, is_default").order("name");
  const selectedPipeline =
    (params.pipeline && pipelines?.find((p) => p.id === params.pipeline)) ||
    pipelines?.find((p) => p.is_default) ||
    pipelines?.[0];
  const pipelineId = selectedPipeline?.id;

  const { from, to } = defaultTwelveMonthRange(today);
  const fromParam = params.from || from;
  const toParam = params.to || to;

  let dealsQuery = supabase
    .from("deals")
    .select(
      `id, title, value, status, stage_id, pipeline_id, organization_id, owner_id, updated_at, closed_at, created_at,
       organizations ( name ),
       profiles!deals_owner_id_fkey ( full_name )`,
    );
  if (pipelineId) dealsQuery = dealsQuery.eq("pipeline_id", pipelineId);
  if (isVendedor && user) dealsQuery = dealsQuery.eq("owner_id", user.id);

  const activitySelect =
    "id, subject, due_date, type, deal_id, deals ( title ), profiles!activities_owner_id_fkey ( full_name )";

  let todayActivitiesQuery = supabase
    .from("activities")
    .select(activitySelect)
    .eq("done", false)
    .gte("due_date", todayStart)
    .lte("due_date", todayEnd)
    .order("due_date");
  if (isVendedor && user) todayActivitiesQuery = todayActivitiesQuery.eq("owner_id", user.id);

  type RawDeal = Omit<DashboardDeal, "organization_name" | "owner_name"> & {
    organizations: { name: string } | null;
    profiles: { full_name: string } | null;
  };
  type RawActivity = {
    id: string;
    subject: string;
    due_date: string | null;
    type: string;
    deal_id: string | null;
    deals: { title: string } | null;
    profiles: { full_name: string } | null;
  };
  const toActivity = (a: RawActivity): DashboardActivity => ({
    id: a.id,
    subject: a.subject,
    due_date: a.due_date,
    type: a.type,
    deal_id: a.deal_id,
    deal_title: a.deals?.title ?? null,
    owner_name: a.profiles?.full_name ?? null,
  });

  const [rawDeals, todayRes, overdueRaw] = await Promise.all([
    fetchAllRows<RawDeal>(
      (f, t) => dealsQuery.range(f, t) as unknown as PromiseLike<{ data: RawDeal[] | null; error: unknown }>,
    ),
    todayActivitiesQuery,
    fetchAllRows<RawActivity>((f, t) => {
      let q = supabase
        .from("activities")
        .select(activitySelect)
        .eq("done", false)
        .lt("due_date", todayStart)
        .order("due_date")
        .range(f, t);
      if (isVendedor && user) q = q.eq("owner_id", user.id);
      return q as unknown as PromiseLike<{ data: RawActivity[] | null; error: unknown }>;
    }),
  ]);

  const allDeals: DashboardDeal[] = rawDeals.map(({ organizations, profiles, ...d }) => ({
    ...d,
    value: Number(d.value) || 0,
    organization_name: organizations?.name ?? null,
    owner_name: profiles?.full_name ?? null,
  }));
  const todayActivities = ((todayRes.data ?? []) as unknown as RawActivity[]).map(toActivity);
  const overdueActivities = overdueRaw.map(toActivity);

  const { data: stages } = pipelineId
    ? await supabase
        .from("pipeline_stages")
        .select("id, name, order_index")
        .eq("pipeline_id", pipelineId)
        .order("order_index")
    : { data: [] };

  // --- Pipeline (negócios abertos) — retrato de agora ---
  const openDeals = allDeals.filter((d) => d.status === "open");
  const openValue = openDeals.reduce((sum, d) => sum + d.value, 0);
  const stalledAll = openDeals
    .filter((d) => d.updated_at < isoDaysAgo(STALLED_DAYS))
    .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime());

  // --- Período selecionado x período anterior de mesma duração ---
  const fromMs = new Date(fromParam).getTime();
  const toMs = new Date(toParam).getTime() + DAY - 1;
  const span = toMs - fromMs + 1;
  const prevFromMs = fromMs - span;
  const prevToMs = fromMs - 1;
  const between = (iso: string, a: number, b: number) => {
    const t = new Date(iso).getTime();
    return t >= a && t <= b;
  };

  function periodStats(a: number, b: number): PeriodStats {
    const created = allDeals.filter((d) => between(d.created_at, a, b));
    const won = allDeals.filter((d) => d.status === "won" && between(closedAt(d), a, b));
    const lost = allDeals.filter((d) => d.status === "lost" && between(closedAt(d), a, b));
    const closed = won.length + lost.length;
    return {
      created,
      won,
      lost,
      wonValue: won.reduce((s, d) => s + d.value, 0),
      winRate: closed > 0 ? won.length / closed : 0,
    };
  }
  const current = periodStats(fromMs, toMs);
  const previous = periodStats(prevFromMs, prevToMs);

  // Novos clientes: organizações cujo primeiro negócio ganho (em toda a história
  // visível para este usuário) caiu dentro do período.
  const firstWonByOrg = new Map<string, DashboardDeal>();
  for (const d of allDeals) {
    if (d.status !== "won" || !d.organization_id) continue;
    const cur = firstWonByOrg.get(d.organization_id);
    if (!cur || new Date(closedAt(d)).getTime() < new Date(closedAt(cur)).getTime()) {
      firstWonByOrg.set(d.organization_id, d);
    }
  }
  const firstWins = Array.from(firstWonByOrg.values());
  const inRange = (d: DashboardDeal, a: number, b: number) => {
    const t = new Date(closedAt(d)).getTime();
    return t >= a && t <= b;
  };
  const toOrgs = (deals: DashboardDeal[]): DashboardOrg[] =>
    deals.map((d) => ({ id: d.organization_id as string, name: d.organization_name ?? "—", deal: d }));
  const newCustomers = toOrgs(firstWins.filter((d) => inRange(d, fromMs, toMs)));
  const newCustomersPrevCount = firstWins.filter((d) => inRange(d, prevFromMs, prevToMs)).length;

  // Clientes perdidos: organizações que perderam um negócio no período e não
  // têm nenhum negócio aberto hoje.
  const orgsWithOpenDeal = new Set(openDeals.filter((d) => d.organization_id).map((d) => d.organization_id as string));
  const lostCustomerDeals = (lost: DashboardDeal[]) => {
    const byOrg = new Map<string, DashboardDeal>();
    for (const d of lost) {
      if (!d.organization_id || orgsWithOpenDeal.has(d.organization_id)) continue;
      const cur = byOrg.get(d.organization_id);
      if (!cur || new Date(closedAt(d)).getTime() > new Date(closedAt(cur)).getTime()) byOrg.set(d.organization_id, d);
    }
    return Array.from(byOrg.values());
  };
  const lostCustomers = toOrgs(lostCustomerDeals(current.lost));
  const lostCustomersPrevCount = lostCustomerDeals(previous.lost).length;

  return {
    user,
    isVendedor,
    firstName,
    pipelines: pipelines ?? [],
    pipelineId,
    stages: stages ?? [],
    fromParam,
    toParam,
    allDeals,
    openDeals,
    openValue,
    stalledAll,
    current,
    previous,
    newCustomers,
    newCustomersPrevCount,
    lostCustomers,
    lostCustomersPrevCount,
    todayActivities,
    overdueActivities,
  };
}

export type DashboardData = Awaited<ReturnType<typeof loadDashboardData>>;

/** Querystring que mantém funil e período ao navegar para o detalhe de um card */
export function dashboardQuery(d: Pick<DashboardData, "pipelineId" | "fromParam" | "toParam">, extra: Record<string, string> = {}) {
  const q = new URLSearchParams();
  if (d.pipelineId) q.set("pipeline", d.pipelineId);
  q.set("from", d.fromParam);
  q.set("to", d.toParam);
  for (const [k, v] of Object.entries(extra)) q.set(k, v);
  return q.toString();
}
