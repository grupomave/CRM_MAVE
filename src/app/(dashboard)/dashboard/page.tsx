import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardAction, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/kpi-card";
import { RelatedList } from "@/components/related-list";
import { formatCurrencyBRL, formatDate } from "@/lib/utils";
import {
  Handshake,
  CalendarClock,
  CalendarCheck,
  CalendarX,
  TrendingUp,
  AlertTriangle,
  Percent,
  Trophy,
  UserPlus,
  UserMinus,
  PlusCircle,
  Snowflake,
  ArrowRightLeft,
  Building2,
  Users,
  Workflow as WorkflowIcon,
  XCircle,
} from "lucide-react";
import { monthKey, monthLabel, monthRange } from "@/lib/date-range";
import { StageFunnelChart, MonthlyTrendChart } from "@/app/(dashboard)/reports/reports-charts";
import { change, closedAt, dashboardQuery, loadDashboardData, STALLED_DAYS } from "@/lib/data/dashboard";
import { formatOverdue } from "@/lib/deal-alerts";
import { HEADLINE_KINDS, kindLabel } from "@/lib/workflow";
import { loadWorkflowSummary, type WorkflowSummary } from "@/lib/workflow-summary";
import { DashboardFilters } from "./dashboard-filters";

// Ícone de cada indicador de movimentação (mesmos tipos do Workflow)
const MOVEMENT_ICONS: Record<string, typeof Handshake> = {
  deal_created: PlusCircle,
  deal_moved: ArrowRightLeft,
  deal_won: Trophy,
  deal_lost: XCircle,
  deal_frozen: Snowflake,
  organization_created: Building2,
  contact_created: Users,
  activity_done: CalendarCheck,
};

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ pipeline?: string; from?: string; to?: string }>;
}) {
  const supabase = await createClient();
  const data = await loadDashboardData(supabase, await searchParams);
  const {
    isVendedor,
    firstName,
    pipelines,
    pipelineId,
    stages,
    fromParam,
    toParam,
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
  } = data;

  // Cada card abre /dashboard/detalhe/<indicador> com o mesmo funil e período
  const detail = (kpi: string, extra: Record<string, string> = {}) =>
    `/dashboard/detalhe/${kpi}?${dashboardQuery(data, extra)}`;

  // Movimentação dos negócios (log de auditoria): só admin/gestor leem o log. Se o resumo
  // falhar, o restante do Dashboard continua funcionando.
  // Negócios e atividades seguem o funil selecionado; cadastros (organizações e pessoas) não
  // pertencem a funil e contam a empresa toda.
  let movement: WorkflowSummary | null = null;
  let movementCompany: WorkflowSummary | null = null;
  if (!isVendedor) {
    try {
      [movement, movementCompany] = await Promise.all([
        loadWorkflowSummary(supabase, { from: fromParam, to: toParam, pipeline: pipelineId }),
        loadWorkflowSummary(supabase, { from: fromParam, to: toParam }),
      ]);
    } catch {
      movement = null;
    }
  }
  const COMPANY_WIDE = new Set(["organization_created", "contact_created"]);
  const workflowLink = (extra: Record<string, string> = {}) => {
    const q = new URLSearchParams({ from: fromParam, to: toParam, ...extra });
    if (pipelineId) q.set("pipeline", pipelineId);
    return `/workflow?${q.toString()}`;
  };

  const stalledPreview = stalledAll.slice(0, 6);

  const funnelData = stages.map((s) => ({
    id: s.id,
    stage: s.name,
    total: openDeals.filter((d) => d.stage_id === s.id).reduce((sum, d) => sum + d.value, 0),
    href: detail("etapa", { stage: s.id }),
  }));

  const months = monthRange(fromParam, toParam);
  const monthlyData = months.map((m) => ({
    key: m,
    month: monthLabel(m),
    criados: current.created.filter((d) => monthKey(d.created_at) === m).length,
    ganhos: current.won.filter((d) => monthKey(closedAt(d)) === m).length,
    perdidos: current.lost.filter((d) => monthKey(closedAt(d)) === m).length,
    href: detail("mes", { month: m }),
  }));

  const periodLabel = `${formatDate(`${fromParam}T12:00:00`)} – ${formatDate(`${toParam}T12:00:00`)}`;
  const vsPrevious = "comparado ao período anterior de mesma duração";
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={firstName ? `Olá, ${firstName}` : "Olá!"}
        description={
          isVendedor
            ? "Visão dos seus negócios e atividades de hoje. Clique em um card para ver quais registros o compõem."
            : "Visão geral do funil de toda a equipe. Clique em um card para ver quais registros o compõem."
        }
        actions={
          <DashboardFilters pipelines={pipelines} pipelineId={pipelineId ?? ""} from={fromParam} to={toParam} />
        }
      />

      <section aria-label="Agora" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Pipeline em aberto"
          icon={Handshake}
          value={formatCurrencyBRL(openValue)}
          hint={plural(openDeals.length, "negócio", "negócios")}
          period="agora"
          href={detail("pipeline")}
        />
        <KpiCard
          label="Ticket médio em aberto"
          icon={TrendingUp}
          value={formatCurrencyBRL(openDeals.length ? openValue / openDeals.length : 0)}
          period="agora"
          href={detail("ticket")}
        />
        <KpiCard
          label="Atividades hoje"
          icon={CalendarClock}
          value={String(todayActivities.length)}
          hint="pendentes"
          period="hoje"
          href={detail("atividades-hoje")}
        />
        <KpiCard
          label="Atividades atrasadas"
          icon={CalendarX}
          tone={overdueActivities.length > 0 ? "danger" : "default"}
          value={String(overdueActivities.length)}
          hint="pendentes, de dias anteriores"
          href={detail("atividades-atrasadas")}
        />
        <KpiCard
          label="Negócios parados"
          icon={AlertTriangle}
          tone={stalledAll.length > 0 ? "warning" : "default"}
          value={String(stalledAll.length)}
          hint={`sem atualização há ${STALLED_DAYS}+ dias`}
          href={detail("parados")}
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
            hint={plural(current.won.length, "negócio", "negócios")}
            delta={{ value: change(current.wonValue, previous.wonValue), label: vsPrevious }}
            href={detail("ganhos")}
          />
          <KpiCard
            label="Taxa de conversão"
            icon={Percent}
            value={`${(current.winRate * 100).toFixed(0)}%`}
            hint="ganhos ÷ fechados"
            delta={{ value: current.winRate - previous.winRate, unit: "pp", label: vsPrevious }}
            href={detail("conversao")}
          />
          <KpiCard
            label="Negócios criados"
            icon={PlusCircle}
            value={String(current.created.length)}
            delta={{ value: change(current.created.length, previous.created.length), label: vsPrevious }}
            href={detail("criados")}
          />
          <KpiCard
            label="Novos clientes"
            icon={UserPlus}
            value={String(newCustomers.length)}
            hint="1ª compra"
            delta={{ value: change(newCustomers.length, newCustomersPrevCount), label: vsPrevious }}
            href={detail("novos-clientes")}
          />
          <KpiCard
            label="Clientes perdidos"
            icon={UserMinus}
            value={String(lostCustomers.length)}
            hint="sem pipeline aberto"
            delta={{
              value: change(lostCustomers.length, lostCustomersPrevCount),
              positiveIsGood: false,
              label: vsPrevious,
            }}
            href={detail("clientes-perdidos")}
          />
        </div>
      </section>

      {movement && (
        <section aria-label="Movimentação dos negócios" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-subtitle text-foreground">
              Movimentação no período{" "}
              <span className="numeric text-sm font-normal text-muted-foreground">{periodLabel}</span>
            </h2>
            <Link href={workflowLink()} className="inline-flex items-center gap-1 text-caption font-medium text-primary hover:underline">
              <WorkflowIcon className="size-3.5" aria-hidden />
              Detalhar por responsável, organização e contato no Workflow
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {HEADLINE_KINDS.map((kind) => (
              <KpiCard
                key={kind}
                label={kindLabel(kind)}
                icon={MOVEMENT_ICONS[kind]}
                value={String((COMPANY_WIDE.has(kind) ? movementCompany : movement)?.kinds[kind] ?? 0)}
                hint={COMPANY_WIDE.has(kind) ? "em toda a empresa" : "no funil selecionado"}
                href={
                  COMPANY_WIDE.has(kind)
                    ? `/workflow?${new URLSearchParams({ from: fromParam, to: toParam, kinds: kind }).toString()}`
                    : workflowLink({ kinds: kind })
                }
              />
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StageFunnelChart data={funnelData} />
        <MonthlyTrendChart data={monthlyData} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center gap-2 pb-3">
            <CardTitle>
              <Link href={detail("atividades-hoje")} className="hover:text-primary hover:underline">
                Atividades de hoje
              </Link>
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
                    {a.deal_title && a.deal_id && (
                      <Link
                        href={`/deals/${a.deal_id}`}
                        className="truncate text-caption text-muted-foreground hover:text-primary hover:underline"
                      >
                        {a.deal_title}
                      </Link>
                    )}
                  </span>
                  <span className="numeric shrink-0 text-caption text-muted-foreground">
                    {a.due_date &&
                      new Date(a.due_date).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "America/Sao_Paulo",
                      })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <RelatedList
          title={
            stalledAll.length > stalledPreview.length
              ? `Negócios parados há mais tempo (de ${stalledAll.length})`
              : "Negócios parados"
          }
          icon={Handshake}
          emptyText="Nenhum negócio parado. Bom trabalho!"
          action={
            stalledAll.length > 0 ? (
              <Link href={detail("parados")} className="text-caption font-medium text-primary hover:underline">
                Ver todos
              </Link>
            ) : undefined
          }
          items={stalledPreview.map((d) => ({
            id: d.id,
            href: `/deals/${d.id}`,
            title: d.title,
            subtitle: `Atualizado em ${formatDate(d.updated_at)}`,
            trailing: <span className="numeric text-caption text-muted-foreground">{formatCurrencyBRL(d.value)}</span>,
          }))}
        />
      </div>

      {overdueActivities.length > 0 && (
        <RelatedList
          title="Atividades atrasadas (mais antigas primeiro)"
          icon={CalendarX}
          emptyText="Nenhuma atividade atrasada"
          action={
            <Link
              href={detail("atividades-atrasadas")}
              className="text-caption font-medium text-primary hover:underline"
            >
              Ver todas ({overdueActivities.length})
            </Link>
          }
          items={overdueActivities.slice(0, 6).map((a) => ({
            id: a.id,
            href: a.deal_id ? `/deals/${a.deal_id}` : "/activities",
            title: a.subject,
            subtitle: [a.deal_title, a.owner_name].filter(Boolean).join(" · ") || null,
            trailing: (
              <span className="numeric text-caption font-medium text-destructive">
                {a.due_date ? formatOverdue(a.due_date)?.label : ""}
              </span>
            ),
          }))}
        />
      )}
    </div>
  );
}
