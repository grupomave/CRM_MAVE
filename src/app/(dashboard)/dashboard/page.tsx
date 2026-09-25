import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrencyBRL, isoDaysAgo } from "@/lib/utils";
import {
  Handshake,
  CalendarClock,
  TrendingUp,
  AlertTriangle,
  Percent,
  UserPlus,
  UserMinus,
} from "lucide-react";
import { defaultTwelveMonthRange, monthKey, monthLabel, monthRange } from "@/lib/date-range";
import { StageFunnelChart, MonthlyTrendChart } from "@/app/(dashboard)/reports/reports-charts";
import { DashboardFilters } from "./dashboard-filters";
import { PageHeader } from "@/components/ui/page-header";

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
    .select("id, subject, due_date, type")
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

  const todayActivities = todayActivitiesRes.data ?? [];

  // --- Pipeline (negócios abertos) ---
  const openDeals = allDeals.filter((d) => d.status === "open");
  const openValue = openDeals.reduce((sum, d) => sum + d.value, 0);
  const stalledDeals = openDeals
    .filter((d) => d.updated_at < isoDaysAgo(14))
    .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())
    .slice(0, 5);

  const funnelData = (stages ?? []).map((s) => ({
    stage: s.name,
    total: openDeals.filter((d) => d.stage_id === s.id).reduce((sum, d) => sum + d.value, 0),
  }));

  // --- Período selecionado: Win Rate, evolução mensal, clientes novos/perdidos ---
  const fromMs = new Date(fromParam).getTime();
  const toMs = new Date(toParam).getTime() + DAY - 1;
  const inRange = (iso: string) => {
    const t = new Date(iso).getTime();
    return t >= fromMs && t <= toMs;
  };

  const createdInRange = allDeals.filter((d) => inRange(d.created_at));
  const wonInRange = allDeals.filter((d) => d.status === "won" && inRange(d.updated_at));
  const lostInRange = allDeals.filter((d) => d.status === "lost" && inRange(d.updated_at));
  const winRate =
    wonInRange.length + lostInRange.length > 0
      ? wonInRange.length / (wonInRange.length + lostInRange.length)
      : 0;

  const months = monthRange(fromParam, toParam);
  const monthlyData = months.map((m) => ({
    month: monthLabel(m),
    criados: createdInRange.filter((d) => monthKey(d.created_at) === m).length,
    ganhos: wonInRange.filter((d) => monthKey(d.updated_at) === m).length,
    perdidos: lostInRange.filter((d) => monthKey(d.updated_at) === m).length,
  }));

  // Novos clientes: organizações cujo primeiro negócio ganho (em toda a
  // história visível para este usuário) caiu dentro do período selecionado.
  const firstWonByOrg = new Map<string, number>();
  for (const d of allDeals) {
    if (d.status !== "won" || !d.organization_id) continue;
    const t = new Date(d.updated_at).getTime();
    const cur = firstWonByOrg.get(d.organization_id);
    if (cur == null || t < cur) firstWonByOrg.set(d.organization_id, t);
  }
  const newCustomersCount = Array.from(firstWonByOrg.values()).filter(
    (t) => t >= fromMs && t <= toMs,
  ).length;

  // Clientes perdidos: organizações que perderam um negócio no período e não
  // têm nenhum negócio aberto hoje (ou seja, não seguem ativas no pipeline).
  const orgsWithOpenDeal = new Set(
    openDeals.filter((d) => d.organization_id).map((d) => d.organization_id as string),
  );
  const lostOrgIds = new Set<string>();
  for (const d of lostInRange) {
    if (d.organization_id && !orgsWithOpenDeal.has(d.organization_id)) {
      lostOrgIds.add(d.organization_id);
    }
  }
  const lostCustomersCount = lostOrgIds.size;

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Negócios em aberto</CardTitle>
            <Handshake className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{openDeals.length}</p>
            <CardDescription>{formatCurrencyBRL(openValue)} em pipeline</CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Atividades hoje</CardTitle>
            <CalendarClock className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{todayActivities.length}</p>
            <CardDescription>pendentes para hoje</CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Negócios parados</CardTitle>
            <AlertTriangle className="size-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stalledDeals.length}</p>
            <CardDescription>sem atualização há 14+ dias</CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Ticket médio</CardTitle>
            <TrendingUp className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrencyBRL(openDeals.length ? openValue / openDeals.length : 0)}
            </p>
            <CardDescription>por negócio em aberto</CardDescription>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Win Rate</CardTitle>
            <Percent className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{(winRate * 100).toFixed(0)}%</p>
            <CardDescription>ganhos / (ganhos + perdidos) no período</CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Novos clientes</CardTitle>
            <UserPlus className="size-4 text-success" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{newCustomersCount}</p>
            <CardDescription>1ª compra no período selecionado</CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Clientes perdidos</CardTitle>
            <UserMinus className="size-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{lostCustomersCount}</p>
            <CardDescription>perderam negócio e não têm pipeline aberto</CardDescription>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StageFunnelChart data={funnelData} />
        <MonthlyTrendChart data={monthlyData} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Atividades de hoje</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {todayActivities.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhuma atividade agendada para hoje.
              </p>
            )}
            {todayActivities.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-md border border-border p-3 text-sm"
              >
                <span>{a.subject}</span>
                <span className="text-xs text-muted-foreground">
                  {a.due_date && new Date(a.due_date).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Negócios parados</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {stalledDeals.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhum negócio parado. 🎉
              </p>
            )}
            {stalledDeals.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between rounded-md border border-border p-3 text-sm"
              >
                <span>{d.title}</span>
                <span className="text-xs text-muted-foreground">
                  atualizado em{" "}
                  {new Date(d.updated_at).toLocaleDateString("pt-BR")}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
