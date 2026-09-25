import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { Card, CardAction, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/kpi-card";
import { RelatedList } from "@/components/related-list";
import { formatCurrencyBRL, formatDate, isoDaysAgo } from "@/lib/utils";
import {
  Handshake,
  CalendarClock,
  CalendarCheck,
  TrendingUp,
  AlertTriangle,
  Percent,
  Trophy,
  UserPlus,
  UserMinus,
  PlusCircle,
} from "lucide-react";
import { defaultTwelveMonthRange, monthKey, monthLabel, monthRange } from "@/lib/date-range";
import { StageFunnelChart, MonthlyTrendChart } from "@/app/(dashboard)/reports/reports-charts";
import { DashboardFilters } from "./dashboard-filters";

export const metadata = { title: "Dashboard" };

interface DealRow {
  id: string;
  title: string;
  value: number;
  status: "open" | "won" | "lost";
  stage_id: string;
  pipeline_id: string;
  organization_id: string | null;
  updated_at: string;
  created_at: string;
}

const DAY = 86400000;

function change(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null;
  return (current - previous) / previous;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ pipeline?: string; from?: string; to?: string }>;
}) {
  const supabase = await createClient();
  const params = await searchParams;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user?.id ?? "")
    .single();

  // Vendedor só enxerga os próprios negócios; gestor e admin têm visão geral
  // da equipe (docx "Estrutura Pipedrive" — permissões por papel).
  const isVendedor = myProfile?.role === "vendedor";
  const firstName =
    myProfile?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "";

  const today = new Date();
  const todayStart = new Date(today.setHours(0, 0, 0, 0)).toISOString();
  const todayEnd = new Date(today.setHours(23, 59, 59, 999)).toISOString();

  const { data: pipelines } = await supabase
    .from("pipelines")
    .select("id, name, is_default")
    .order("name");

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
      "id, title, value, status, stage_id, pipeline_id, organization_id, updated_at, created_at",
    );
  if (pipelineId) dealsQuery = dealsQuery.eq("pipeline_id", pipelineId);
  if (isVendedor && user) dealsQuery = dealsQuery.eq("owner_id", user.id);

  let todayActivitiesQuery = supabase
    .from("activities")
    .select("id, subject, due_date, type, deal_id, deals ( title )")
    .eq("done", false)
    .gte("due_date", todayStart)
    .lte("due_date", todayEnd)
    .order("due_date");
  if (isVendedor && user) todayActivitiesQuery = todayActivitiesQuery.eq("owner_id", user.id);

  const [allDeals, todayActivitiesRes] = await Promise.all([
    fetchAllRows((f, t) => dealsQuery.range(f, t)) as Promise<DealRow[]>,
    todayActivitiesQuery,
  ]);

  const { data: stages } = pipelineId
    ? await supabase
        .from("pipeline_stages")
        .select("id, name, order_index")
        .eq("pipeline_id", pipelineId)
        .order("order_index")
    : { data: [] };

  const todayActivities = (todayActivitiesRes.data ?? []) as unknown as {
    id: string;
    subject: string;
    due_date: string | null;
    type: string;
    deal_id: string | null;
    deals: { title: string } | null;
  }[];

  // --- Pipeline (negócios abertos) — retrato de agora ---
  const openDeals = allDeals.filter((d) => d.status === "open");
  const openValue = openDeals.reduce((sum, d) => sum + d.value, 0);
  const stalledAll = openDeals.filter((d) => d.updated_at < isoDaysAgo(14));
  const stalledDeals = [...stalledAll]
    .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())
    .slice(0, 6);

  const funnelData = (stages ?? []).map((s) => ({
    stage: s.name,
    total: openDeals.filter((d) => d.stage_id === s.id).reduce((sum, d) => sum + d.value, 0),
  }));

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

  function periodStats(a: number, b: number) {
    const created = allDeals.filter((d) => between(d.created_at, a, b));
    const won = allDeals.filter((d) => d.status === "won" && between(d.updated_at, a, b));
    const lost = allDeals.filter((d) => d.status === "lost" && between(d.updated_at, a, b));
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

  const months = monthRange(fromParam, toParam);
  const monthlyData = months.map((m) => ({
    month: monthLabel(m),
    criados: current.created.filter((d) => monthKey(d.created_at) === m).length,
    ganhos: current.won.filter((d) => monthKey(d.updated_at) === m).length,
    perdidos: current.lost.filter((d) => monthKey(d.updated_at) === m).length,
  }));

  // Novos clientes: organizações cujo primeiro negócio ganho (em toda a
  // história visível para este usuário) caiu dentro do período.
  const firstWonByOrg = new Map<string, number>();
  for (const d of allDeals) {
    if (d.status !== "won" || !d.organization_id) continue;
    const t = new Date(d.updated_at).getTime();
    const cur = firstWonByOrg.get(d.organization_id);
    if (cur == null || t < cur) firstWonByOrg.set(d.organization_id, t);
  }
  const firstWins = Array.from(firstWonByOrg.values());
  const newCustomers = firstWins.filter((t) => t >= fromMs && t <= toMs).length;
  const newCustomersPrev = firstWins.filter((t) => t >= prevFromMs && t <= prevToMs).length;

  // Clientes perdidos: organizações que perderam um negócio no período e não
  // têm nenhum negócio aberto hoje (ou seja, não seguem ativas no pipeline).
  const orgsWithOpenDeal = new Set(
    openDeals.filter((d) => d.organization_id).map((d) => d.organization_id as string),
  );
  const lostCustomers = (lost: DealRow[]) =>
    new Set(
      lost
        .filter((d) => d.organization_id && !orgsWithOpenDeal.has(d.organization_id))
        .map((d) => d.organization_id as string),
    ).size;
  const lostCustomersCount = lostCustomers(current.lost);
  const lostCustomersPrev = lostCustomers(previous.lost);

  const periodLabel = `${formatDate(`${fromParam}T12:00:00`)} – ${formatDate(`${toParam}T12:00:00`)}`;
  const vsPrevious = "comparado ao período anterior de mesma duração";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Olá, ${firstName}`}
        description={
          isVendedor
            ? "Visão dos seus negócios e atividades de hoje."
            : "Visão geral do funil de toda a equipe."
        }
        actions={
          <DashboardFilters
            pipelines={pipelines ?? []}
            pipelineId={pipelineId ?? ""}
            from={fromParam}
            to={toParam}
          />
        }
      />

      <section aria-label="Agora" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Pipeline em aberto"
          icon={Handshake}
          value={formatCurrencyBRL(openValue)}
          hint={`${openDeals.length} ${openDeals.length === 1 ? "negócio" : "negócios"}`}
          period="agora"
        />
        <KpiCard
          label="Ticket médio em aberto"
          icon={TrendingUp}
          value={formatCurrencyBRL(openDeals.length ? openValue / openDeals.length : 0)}
          period="agora"
        />
        <KpiCard
          label="Atividades hoje"
          icon={CalendarClock}
          value={String(todayActivities.length)}
          hint="pendentes"
          period="hoje"
        />
        <KpiCard
          label="Negócios parados"
          icon={AlertTriangle}
          tone={stalledAll.length > 0 ? "warning" : "default"}
          value={String(stalledAll.length)}
          hint="sem atualização há 14+ dias"
        />
      </section>

      <section aria-label="Período selecionado" className="flex flex-col gap-3">
        <h2 className="text-subtitle text-foreground">
          No período <span className="numeric text-sm font-normal text-muted-foreground">{periodLabel}</span>
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard
            label="Valor ganho"
            icon={Trophy}
            value={formatCurrencyBRL(current.wonValue)}
            hint={`${current.won.length} ${current.won.length === 1 ? "negócio" : "negócios"}`}
            delta={{ value: change(current.wonValue, previous.wonValue), label: vsPrevious }}
          />
          <KpiCard
            label="Taxa de conversão"
            icon={Percent}
            value={`${(current.winRate * 100).toFixed(0)}%`}
            hint="ganhos ÷ fechados"
            delta={{ value: current.winRate - previous.winRate, unit: "pp", label: vsPrevious }}
          />
          <KpiCard
            label="Negócios criados"
            icon={PlusCircle}
            value={String(current.created.length)}
            delta={{ value: change(current.created.length, previous.created.length), label: vsPrevious }}
          />
          <KpiCard
            label="Novos clientes"
            icon={UserPlus}
            value={String(newCustomers)}
            hint="1ª compra"
            delta={{ value: change(newCustomers, newCustomersPrev), label: vsPrevious }}
          />
          <KpiCard
            label="Clientes perdidos"
            icon={UserMinus}
            value={String(lostCustomersCount)}
            hint="sem pipeline aberto"
            delta={{
              value: change(lostCustomersCount, lostCustomersPrev),
              positiveIsGood: false,
              label: vsPrevious,
            }}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StageFunnelChart data={funnelData} />
        <MonthlyTrendChart data={monthlyData} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center gap-2 pb-3">
            <CardTitle>
              Atividades de hoje
              <span className="numeric ml-1.5 font-normal text-muted-foreground">{todayActivities.length}</span>
            </CardTitle>
            <CardAction>
              <Link href="/activities" className="text-caption font-medium text-primary hover:underline">
                Ver agenda
              </Link>
            </CardAction>
          </CardHeader>
          {todayActivities.length === 0 ? (
            <EmptyState
              compact
              icon={CalendarCheck}
              title="Nenhuma atividade para hoje"
              description="Aproveite para agendar os próximos passos dos seus negócios."
              className="pb-5 pt-0"
            />
          ) : (
            <ul className="divide-y divide-border border-t border-border">
              {todayActivities.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium text-foreground">{a.subject}</span>
                    {a.deals?.title && a.deal_id && (
                      <Link
                        href={`/deals/${a.deal_id}`}
                        className="truncate text-caption text-muted-foreground hover:text-primary hover:underline"
                      >
                        {a.deals.title}
                      </Link>
                    )}
                  </span>
                  <span className="numeric shrink-0 text-caption text-muted-foreground">
                    {a.due_date &&
                      new Date(a.due_date).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <RelatedList
          title="Negócios parados"
          icon={Handshake}
          emptyText="Nenhum negócio parado. Bom trabalho!"
          items={stalledDeals.map((d) => ({
            id: d.id,
            href: `/deals/${d.id}`,
            title: d.title,
            subtitle: `Atualizado em ${formatDate(d.updated_at)}`,
            trailing: (
              <span className="numeric text-caption text-muted-foreground">{formatCurrencyBRL(d.value)}</span>
            ),
          }))}
        />
      </div>
    </div>
  );
}
