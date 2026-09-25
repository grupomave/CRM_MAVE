import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { LOST_REASON_LABEL } from "@/lib/supabase/types";
import { monthKey, monthLabel, monthRange, defaultTwelveMonthRange } from "@/lib/date-range";
import { formatCurrencyBRL } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReportsFilters } from "./reports-filters";
import { ExportButton, type ExcelChartSheetSpec } from "./export-button";
import { ExportChartsBasket } from "./export-charts-basket";
import { CHART_IDS } from "./chart-ids";
import type { ExcelSheet } from "@/lib/export/excel";
import type { PdfSection } from "@/lib/export/pdf";
import {
  StatTile,
  StageFunnelChart,
  MonthlyTrendChart,
  OwnerWonChart,
  LossReasonsChart,
  LossByOwnerChart,
  OwnerRankingTable,
  ActivityByOwnerTable,
} from "./reports-charts";
import { OwnerPipelineTable, SourcePipelineChart, StagnantDealsTable } from "./reports-pipeline";
import { CustomerSalesTable, RegionSalesChart } from "./reports-sales";
import { LeadsStatusChart, LeadsSourceTable } from "./reports-leads";
import { OverdueActivitiesTable, ExpiringDealsTable } from "./reports-alerts";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Relatórios" };

interface DealRow {
  id: string;
  title: string;
  value: number;
  status: "open" | "won" | "lost";
  lost_reason: string | null;
  stage_id: string;
  owner_id: string;
  source: string | null;
  expected_close_date: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  last_activity_at: string | null;
  profiles: { full_name: string } | null;
  organizations: { name: string; state: string | null } | null;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ pipeline?: string; owner?: string; from?: string; to?: string }>;
}) {
  const supabase = await createClient();
  const params = await searchParams;

  const today = new Date();
  const defaultRange = defaultTwelveMonthRange(today);

  const from = params.from || defaultRange.from;
  const to = params.to || defaultRange.to;

  const [{ data: pipelines }, owners] = await Promise.all([
    supabase.from("pipelines").select("id, name, is_default").order("name"),
    fetchAllRows((f, t) =>
      supabase.from("profiles").select("id, full_name").order("full_name").range(f, t),
    ),
  ]);

  const selectedPipeline =
    (params.pipeline && pipelines?.find((p) => p.id === params.pipeline)) ||
    pipelines?.find((p) => p.is_default) ||
    pipelines?.[0];
  const pipelineId = selectedPipeline?.id;
  const ownerId = params.owner && params.owner !== "all" ? params.owner : "all";

  const { data: stages } = pipelineId
    ? await supabase
        .from("pipeline_stages")
        .select("id, name, order_index")
        .eq("pipeline_id", pipelineId)
        .order("order_index")
    : { data: [] };

  let dealsQuery = supabase
    .from("deals")
    .select(
      "id, title, value, status, lost_reason, stage_id, owner_id, source, expected_close_date, created_at, updated_at, closed_at, last_activity_at, profiles!deals_owner_id_fkey ( full_name ), organizations ( name, state )",
    );
  if (pipelineId) dealsQuery = dealsQuery.eq("pipeline_id", pipelineId);
  if (ownerId !== "all") dealsQuery = dealsQuery.eq("owner_id", ownerId);

  const deals = (await fetchAllRows((f, t) => dealsQuery.range(f, t))) as unknown as DealRow[];

  // --- Atividades no período (para "Atividades por vendedor") — não é
  // filtrado por funil/pipeline pois atividade não pertence a um pipeline.
  let activitiesQuery = supabase
    .from("activities")
    .select("id, type, owner_id, done, due_date")
    .not("due_date", "is", null)
    .gte("due_date", from)
    .lte("due_date", `${to}T23:59:59`);
  if (ownerId !== "all") activitiesQuery = activitiesQuery.eq("owner_id", ownerId);
  const activitiesInRange = await fetchAllRows((f, t) => activitiesQuery.range(f, t));

  // --- Atividades atrasadas (estado "agora", não depende do período) ---
  let overdueQuery = supabase
    .from("activities")
    .select("id, type, subject, due_date, owner_id, deal_id, deals ( title )")
    .eq("done", false)
    .lt("due_date", today.toISOString())
    .order("due_date", { ascending: true })
    .limit(50);
  if (ownerId !== "all") overdueQuery = overdueQuery.eq("owner_id", ownerId);
  const { data: overdueActivities } = await overdueQuery;

  // --- Leads no período — tabela própria, sem relação com pipeline ---
  let leadsQuery = supabase
    .from("leads")
    .select("id, source, status, created_at, converted_deal_id, owner_id");
  if (ownerId !== "all") leadsQuery = leadsQuery.eq("owner_id", ownerId);
  const allLeads = await fetchAllRows((f, t) => leadsQuery.range(f, t));

  // --- Temperatura da carteira (docx seção 3.8-A) — só negócios abertos,
  // sem o filtro de período, já que é uma leitura do "agora".
  const openDeals = deals.filter((d) => d.status === "open");
  const nowMs = today.getTime();
  const DAY = 86400000;
  let hot = 0,
    warm = 0,
    cold = 0;
  for (const d of openDeals) {
    if (!d.last_activity_at) {
      cold++;
      continue;
    }
    const days = (nowMs - new Date(d.last_activity_at).getTime()) / DAY;
    if (days <= 3) hot++;
    else if (days <= 10) warm++;
    else cold++;
  }

  const openValue = openDeals.reduce((sum, d) => sum + d.value, 0);

  // --- Deals dentro do período selecionado (por evento relevante) ---
  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime() + DAY - 1;
  const inRange = (iso: string) => {
    const t = new Date(iso).getTime();
    return t >= fromMs && t <= toMs;
  };

  const createdInRange = deals.filter((d) => inRange(d.created_at));
  // Data de fechamento própria (migration 0023); updated_at só como reserva
  const closedAt = (d: { closed_at: string | null; updated_at: string }) => d.closed_at ?? d.updated_at;
  const wonInRange = deals.filter((d) => d.status === "won" && inRange(closedAt(d)));
  const lostInRange = deals.filter((d) => d.status === "lost" && inRange(closedAt(d)));

  const wonValue = wonInRange.reduce((sum, d) => sum + d.value, 0);
  const lostValue = lostInRange.reduce((sum, d) => sum + d.value, 0);
  const conversionRate =
    wonInRange.length + lostInRange.length > 0
      ? wonInRange.length / (wonInRange.length + lostInRange.length)
      : 0;

  // --- Funil por estágio (negócios abertos) ---
  const funnelData = (stages ?? []).map((s) => ({
    stage: s.name,
    total: openDeals
      .filter((d) => d.stage_id === s.id)
      .reduce((sum, d) => sum + d.value, 0),
  }));

  // --- Evolução mensal ---
  const months = monthRange(from, to);
  const monthlyData = months.map((m) => ({
    month: monthLabel(m),
    criados: createdInRange.filter((d) => monthKey(d.created_at) === m).length,
    ganhos: wonInRange.filter((d) => monthKey(closedAt(d)) === m).length,
    perdidos: lostInRange.filter((d) => monthKey(closedAt(d)) === m).length,
  }));

  // --- Ranking de vendedores ---
  const ownerNames = new Map<string, string>();
  const wonByOwner = new Map<string, { value: number; count: number }>();
  const lostByOwner = new Map<string, number>();

  for (const d of wonInRange) {
    const name = d.profiles?.full_name ?? "—";
    ownerNames.set(d.owner_id, name);
    const cur = wonByOwner.get(d.owner_id) ?? { value: 0, count: 0 };
    wonByOwner.set(d.owner_id, { value: cur.value + d.value, count: cur.count + 1 });
  }
  for (const d of lostInRange) {
    const name = d.profiles?.full_name ?? "—";
    ownerNames.set(d.owner_id, name);
    lostByOwner.set(d.owner_id, (lostByOwner.get(d.owner_id) ?? 0) + 1);
  }

  const ownerIds = new Set([...wonByOwner.keys(), ...lostByOwner.keys()]);
  const rankingRows = Array.from(ownerIds)
    .map((id) => {
      const won = wonByOwner.get(id) ?? { value: 0, count: 0 };
      const lostCount = lostByOwner.get(id) ?? 0;
      return {
        owner: ownerNames.get(id) ?? "—",
        wonValue: won.value,
        wonCount: won.count,
        lostCount,
        avgTicket: won.count > 0 ? won.value / won.count : 0,
        conversionRate: won.count + lostCount > 0 ? won.count / (won.count + lostCount) : 0,
      };
    })
    .sort((a, b) => b.wonValue - a.wonValue);

  const ownerWonChartData = rankingRows
    .filter((r) => r.wonValue > 0)
    .slice(0, 10)
    .map((r) => ({ owner: r.owner, won: r.wonValue }));

  // --- Perdas ---
  const lossReasonTotals = new Map<string, number>();
  for (const d of lostInRange) {
    const label = d.lost_reason
      ? LOST_REASON_LABEL[d.lost_reason as keyof typeof LOST_REASON_LABEL] ?? d.lost_reason
      : "Não informado";
    lossReasonTotals.set(label, (lossReasonTotals.get(label) ?? 0) + 1);
  }
  const lossReasonsData = Array.from(lossReasonTotals.entries())
    .map(([reason, total]) => ({ reason, total }))
    .sort((a, b) => b.total - a.total);

  const lostByOwnerValue = new Map<string, number>();
  for (const d of lostInRange) {
    const name = d.profiles?.full_name ?? "—";
    lostByOwnerValue.set(name, (lostByOwnerValue.get(name) ?? 0) + d.value);
  }
  const lossByOwnerData = Array.from(lostByOwnerValue.entries())
    .map(([owner, lost]) => ({ owner, lost }))
    .sort((a, b) => b.lost - a.lost)
    .slice(0, 10);

  // Nomes de todos os vendedores (não só quem ganhou/perdeu no período) —
  // necessário pra pipeline aberto e atividades, onde o dono pode não ter
  // fechado nada ainda.
  const profileNameById = new Map(owners.map((o) => [o.id, o.full_name]));

  // --- Pipeline por vendedor (negócios abertos) ---
  const pipelineByOwnerMap = new Map<string, { value: number; count: number }>();
  for (const d of openDeals) {
    const cur = pipelineByOwnerMap.get(d.owner_id) ?? { value: 0, count: 0 };
    pipelineByOwnerMap.set(d.owner_id, { value: cur.value + d.value, count: cur.count + 1 });
  }
  const pipelineByOwnerData = Array.from(pipelineByOwnerMap.entries())
    .map(([id, v]) => ({ owner: profileNameById.get(id) ?? "—", value: v.value, count: v.count }))
    .sort((a, b) => b.value - a.value);

  // --- Pipeline por origem (negócios abertos) — "source" é texto livre,
  // então strings diferentes (ex.: "Site" x "site") viram categorias
  // diferentes até o campo virar um select controlado.
  const pipelineBySourceMap = new Map<string, number>();
  for (const d of openDeals) {
    const label = d.source?.trim() || "Não informado";
    pipelineBySourceMap.set(label, (pipelineBySourceMap.get(label) ?? 0) + d.value);
  }
  const pipelineBySourceData = Array.from(pipelineBySourceMap.entries())
    .map(([source, value]) => ({ source, value }))
    .sort((a, b) => b.value - a.value);

  // --- Oportunidades paradas (dias desde a última atividade, ou desde a
  // criação se nunca houve nenhuma) ---
  const stagnantDeals = openDeals
    .map((d) => {
      const referenceDate = d.last_activity_at ?? d.created_at;
      const daysIdle = Math.floor((nowMs - new Date(referenceDate).getTime()) / DAY);
      return {
        id: d.id,
        title: d.title,
        organization: d.organizations?.name ?? "—",
        owner: d.profiles?.full_name ?? "—",
        stage: (stages ?? []).find((s) => s.id === d.stage_id)?.name ?? "—",
        value: d.value,
        daysIdle,
      };
    })
    .filter((d) => d.daysIdle >= 7)
    .sort((a, b) => b.daysIdle - a.daysIdle);

  // --- Negociações próximas do vencimento (ou já vencidas e ainda abertas) ---
  const expiringWindow = new Date(nowMs + 15 * DAY);
  const expiringDeals = openDeals
    .filter((d) => d.expected_close_date && new Date(d.expected_close_date) <= expiringWindow)
    .map((d) => ({
      id: d.id,
      title: d.title,
      organization: d.organizations?.name ?? "—",
      owner: d.profiles?.full_name ?? "—",
      value: d.value,
      expectedCloseDate: d.expected_close_date as string,
      overdue: new Date(d.expected_close_date as string).getTime() < nowMs,
    }))
    .sort((a, b) => new Date(a.expectedCloseDate).getTime() - new Date(b.expectedCloseDate).getTime());

  // --- Vendas por cliente (top 10 no período) ---
  const salesByCustomerMap = new Map<string, number>();
  for (const d of wonInRange) {
    const name = d.organizations?.name ?? "Sem organização";
    salesByCustomerMap.set(name, (salesByCustomerMap.get(name) ?? 0) + d.value);
  }
  const salesByCustomerData = Array.from(salesByCustomerMap.entries())
    .map(([customer, value]) => ({ customer, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // --- Vendas por região (estado da organização) ---
  const salesByRegionMap = new Map<string, number>();
  for (const d of wonInRange) {
    const region = d.organizations?.state?.trim() || "Não informado";
    salesByRegionMap.set(region, (salesByRegionMap.get(region) ?? 0) + d.value);
  }
  const salesByRegionData = Array.from(salesByRegionMap.entries())
    .map(([region, value]) => ({ region, value }))
    .sort((a, b) => b.value - a.value);

  // --- Atividades por vendedor no período ---
  const ACTIVITY_TYPES = ["task", "call", "meeting", "email"] as const;
  const activityByOwnerMap = new Map<
    string,
    { task: number; call: number; meeting: number; email: number; done: number; total: number }
  >();
  for (const a of activitiesInRange) {
    const cur =
      activityByOwnerMap.get(a.owner_id) ??
      { task: 0, call: 0, meeting: 0, email: 0, done: 0, total: 0 };
    if (ACTIVITY_TYPES.includes(a.type as (typeof ACTIVITY_TYPES)[number])) {
      cur[a.type as (typeof ACTIVITY_TYPES)[number]] += 1;
    }
    if (a.done) cur.done += 1;
    cur.total += 1;
    activityByOwnerMap.set(a.owner_id, cur);
  }
  const activityByOwnerData = Array.from(activityByOwnerMap.entries())
    .map(([id, v]) => ({ owner: profileNameById.get(id) ?? "—", ...v }))
    .sort((a, b) => b.total - a.total);

  // --- Atividades atrasadas (lista de alerta) ---
  const overdueActivityRows = (overdueActivities ?? []).map((a: any) => ({
    id: a.id as string,
    type: a.type as string,
    subject: a.subject as string,
    dueDate: a.due_date as string,
    owner: profileNameById.get(a.owner_id) ?? "—",
    dealId: a.deal_id as string | null,
    dealTitle: (a.deals?.title as string | undefined) ?? null,
  }));

  // --- Leads no período ---
  const leadsInRange = allLeads.filter((l) => inRange(l.created_at));
  const LEAD_STATUS_LABEL: Record<string, string> = {
    new: "Novo",
    contacted: "Contatado",
    qualified: "Qualificado",
    disqualified: "Desqualificado",
    converted: "Convertido",
  };
  const leadsByStatusMap = new Map<string, number>();
  const leadsBySourceMap = new Map<string, number>();
  let leadsConverted = 0;
  for (const l of leadsInRange) {
    const statusLabel = LEAD_STATUS_LABEL[l.status] ?? l.status;
    leadsByStatusMap.set(statusLabel, (leadsByStatusMap.get(statusLabel) ?? 0) + 1);
    const sourceLabel = l.source?.trim() || "Não informado";
    leadsBySourceMap.set(sourceLabel, (leadsBySourceMap.get(sourceLabel) ?? 0) + 1);
    if (l.status === "converted") leadsConverted++;
  }
  const leadsByStatusData = Array.from(leadsByStatusMap.entries()).map(([status, total]) => ({
    status,
    total,
  }));
  const leadsBySourceData = Array.from(leadsBySourceMap.entries())
    .map(([source, total]) => ({ source, total }))
    .sort((a, b) => b.total - a.total);
  const leadsConversionRate = leadsInRange.length > 0 ? leadsConverted / leadsInRange.length : 0;

  // --- Exportação: um conjunto de planilhas/seções por aba, mais o "Geral"
  // (concatenação de tudo) — ver export-button.tsx e export-charts-basket.tsx.
  const pipelineLabel = selectedPipeline?.name ?? "Todos os funis";
  const ownerLabel =
    ownerId === "all" ? "Todos" : owners.find((o) => o.id === ownerId)?.full_name ?? "—";
  const exportSubtitle = `Funil: ${pipelineLabel} · Vendedor: ${ownerLabel} · Período: ${from} a ${to}`;
  const fileSlug = (suffix: string) =>
    `relatorio-${suffix}-${pipelineLabel}-${from}_a_${to}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");

  const overviewExcelSheets: ExcelSheet[] = [
    {
      name: "Resumo",
      columns: [
        { header: "Indicador", key: "indicador", width: 30 },
        { header: "Valor", key: "valor", width: 20 },
      ],
      rows: [
        { indicador: "Quentes (até 3 dias)", valor: hot },
        { indicador: "Mornos (4-10 dias)", valor: warm },
        { indicador: "Frios (11+ dias)", valor: cold },
        { indicador: "Valor em aberto", valor: formatCurrencyBRL(openValue) },
        { indicador: "Ganho no período", valor: formatCurrencyBRL(wonValue) },
        { indicador: "Negócios ganhos", valor: wonInRange.length },
        { indicador: "Taxa de conversão", valor: `${(conversionRate * 100).toFixed(0)}%` },
      ],
    },
    {
      name: "Funil por etapa",
      columns: [
        { header: "Etapa", key: "stage", width: 25 },
        { header: "Valor em aberto", key: "total", width: 20 },
      ],
      rows: funnelData,
    },
    {
      name: "Evolução mensal",
      columns: [
        { header: "Mês", key: "month", width: 15 },
        { header: "Criados", key: "criados", width: 12 },
        { header: "Ganhos", key: "ganhos", width: 12 },
        { header: "Perdidos", key: "perdidos", width: 12 },
      ],
      rows: monthlyData,
    },
  ];
  const overviewPdfSections: PdfSection[] = [
    {
      title: "Resumo",
      columns: ["Indicador", "Valor"],
      rows: [
        ["Quentes (até 3 dias)", hot],
        ["Mornos (4-10 dias)", warm],
        ["Frios (11+ dias)", cold],
        ["Valor em aberto", formatCurrencyBRL(openValue)],
        ["Ganho no período", formatCurrencyBRL(wonValue)],
        ["Negócios ganhos", wonInRange.length],
        ["Taxa de conversão", `${(conversionRate * 100).toFixed(0)}%`],
      ],
    },
    {
      title: "Funil por etapa",
      columns: ["Etapa", "Valor em aberto"],
      rows: funnelData.map((r) => [r.stage, formatCurrencyBRL(r.total)]),
      chartImageId: CHART_IDS.funnel,
    },
    {
      title: "Evolução mensal",
      columns: ["Mês", "Criados", "Ganhos", "Perdidos"],
      rows: monthlyData.map((r) => [r.month, r.criados, r.ganhos, r.perdidos]),
      chartImageId: CHART_IDS.monthly,
    },
  ];
  const overviewChartSheets: ExcelChartSheetSpec[] = [
    { name: "Gráfico - Funil", chartId: CHART_IDS.funnel },
    { name: "Gráfico - Evolução mensal", chartId: CHART_IDS.monthly },
  ];

  const pipelineExcelSheets: ExcelSheet[] = [
    {
      name: "Pipeline por vendedor",
      columns: [
        { header: "Vendedor", key: "owner", width: 25 },
        { header: "Valor em aberto", key: "value", width: 18 },
        { header: "Negócios", key: "count", width: 12 },
      ],
      rows: pipelineByOwnerData,
    },
    {
      name: "Pipeline por origem",
      columns: [
        { header: "Origem", key: "source", width: 25 },
        { header: "Valor em aberto", key: "value", width: 18 },
      ],
      rows: pipelineBySourceData,
    },
    {
      name: "Oportunidades paradas",
      columns: [
        { header: "Negócio", key: "title", width: 28 },
        { header: "Organização", key: "organization", width: 25 },
        { header: "Etapa", key: "stage", width: 18 },
        { header: "Vendedor", key: "owner", width: 20 },
        { header: "Valor", key: "value", width: 16 },
        { header: "Dias parado", key: "daysIdle", width: 14 },
      ],
      rows: stagnantDeals.map((d) => ({
        title: d.title,
        organization: d.organization,
        stage: d.stage,
        owner: d.owner,
        value: formatCurrencyBRL(d.value),
        daysIdle: d.daysIdle,
      })),
    },
  ];
  const pipelinePdfSections: PdfSection[] = [
    {
      title: "Pipeline por vendedor",
      columns: ["Vendedor", "Valor em aberto", "Negócios"],
      rows: pipelineByOwnerData.map((r) => [r.owner, formatCurrencyBRL(r.value), r.count]),
    },
    {
      title: "Pipeline por origem",
      columns: ["Origem", "Valor em aberto"],
      rows: pipelineBySourceData.map((r) => [r.source, formatCurrencyBRL(r.value)]),
      chartImageId: CHART_IDS.sourcePipeline,
    },
    {
      title: "Oportunidades paradas",
      columns: ["Negócio", "Organização", "Etapa", "Vendedor", "Valor", "Dias parado"],
      rows: stagnantDeals.map((d) => [
        d.title,
        d.organization,
        d.stage,
        d.owner,
        formatCurrencyBRL(d.value),
        d.daysIdle,
      ]),
    },
  ];
  const pipelineChartSheets: ExcelChartSheetSpec[] = [
    { name: "Gráfico - Pipeline origem", chartId: CHART_IDS.sourcePipeline },
  ];

  const salesExcelSheets: ExcelSheet[] = [
    {
      name: "Vendas por cliente",
      columns: [
        { header: "Cliente", key: "customer", width: 28 },
        { header: "Valor ganho", key: "value", width: 18 },
      ],
      rows: salesByCustomerData,
    },
    {
      name: "Vendas por região",
      columns: [
        { header: "Região", key: "region", width: 20 },
        { header: "Valor ganho", key: "value", width: 18 },
      ],
      rows: salesByRegionData,
    },
  ];
  const salesPdfSections: PdfSection[] = [
    {
      title: "Vendas por cliente",
      columns: ["Cliente", "Valor ganho"],
      rows: salesByCustomerData.map((r) => [r.customer, formatCurrencyBRL(r.value)]),
    },
    {
      title: "Vendas por região",
      columns: ["Região", "Valor ganho"],
      rows: salesByRegionData.map((r) => [r.region, formatCurrencyBRL(r.value)]),
      chartImageId: CHART_IDS.regionSales,
    },
  ];
  const salesChartSheets: ExcelChartSheetSpec[] = [
    { name: "Gráfico - Vendas região", chartId: CHART_IDS.regionSales },
  ];

  const ownersExcelSheets: ExcelSheet[] = [
    {
      name: "Ranking vendedores",
      columns: [
        { header: "Vendedor", key: "owner", width: 25 },
        { header: "Valor ganho", key: "wonValue", width: 18 },
        { header: "Negócios ganhos", key: "wonCount", width: 16 },
        { header: "Negócios perdidos", key: "lostCount", width: 16 },
        { header: "Ticket médio", key: "avgTicket", width: 16 },
        { header: "Conversão", key: "conversionRate", width: 14 },
      ],
      rows: rankingRows.map((r) => ({
        owner: r.owner,
        wonValue: r.wonValue,
        wonCount: r.wonCount,
        lostCount: r.lostCount,
        avgTicket: r.avgTicket,
        conversionRate: `${(r.conversionRate * 100).toFixed(0)}%`,
      })),
    },
    {
      name: "Atividades por vendedor",
      columns: [
        { header: "Vendedor", key: "owner", width: 25 },
        { header: "Tarefas", key: "task", width: 12 },
        { header: "Ligações", key: "call", width: 12 },
        { header: "Reuniões", key: "meeting", width: 12 },
        { header: "E-mails", key: "email", width: 12 },
        { header: "Concluídas", key: "done", width: 14 },
        { header: "Total", key: "total", width: 12 },
      ],
      rows: activityByOwnerData,
    },
  ];
  const ownersPdfSections: PdfSection[] = [
    {
      title: "Ranking de vendedores",
      columns: ["Vendedor", "Valor ganho", "Ganhos", "Perdidos", "Ticket médio", "Conversão"],
      rows: rankingRows.map((r) => [
        r.owner,
        formatCurrencyBRL(r.wonValue),
        r.wonCount,
        r.lostCount,
        formatCurrencyBRL(r.avgTicket),
        `${(r.conversionRate * 100).toFixed(0)}%`,
      ]),
      chartImageId: CHART_IDS.ownerWon,
    },
    {
      title: "Atividades por vendedor",
      columns: ["Vendedor", "Tarefas", "Ligações", "Reuniões", "E-mails", "Concluídas", "Total"],
      rows: activityByOwnerData.map((r) => [
        r.owner,
        r.task,
        r.call,
        r.meeting,
        r.email,
        `${r.done}/${r.total}`,
        r.total,
      ]),
    },
  ];
  const ownersChartSheets: ExcelChartSheetSpec[] = [
    { name: "Gráfico - Vendedores", chartId: CHART_IDS.ownerWon },
  ];

  const leadsExcelSheets: ExcelSheet[] = [
    {
      name: "Leads",
      columns: [
        { header: "Indicador", key: "indicador", width: 30 },
        { header: "Valor", key: "valor", width: 20 },
      ],
      rows: [
        { indicador: "Leads recebidos", valor: leadsInRange.length },
        { indicador: "Convertidos", valor: leadsConverted },
        { indicador: "Taxa de conversão", valor: `${(leadsConversionRate * 100).toFixed(0)}%` },
        ...leadsByStatusData.map((s) => ({ indicador: `Status: ${s.status}`, valor: s.total })),
        ...leadsBySourceData.map((s) => ({ indicador: `Origem: ${s.source}`, valor: s.total })),
      ],
    },
  ];
  const leadsPdfSections: PdfSection[] = [
    {
      title: "Leads",
      columns: ["Indicador", "Valor"],
      rows: [
        ["Leads recebidos", leadsInRange.length],
        ["Convertidos", leadsConverted],
        ["Taxa de conversão", `${(leadsConversionRate * 100).toFixed(0)}%`],
      ],
      chartImageId: CHART_IDS.leadsStatus,
    },
    {
      title: "Leads por origem",
      columns: ["Origem", "Leads"],
      rows: leadsBySourceData.map((r) => [r.source, r.total]),
    },
  ];
  const leadsChartSheets: ExcelChartSheetSpec[] = [
    { name: "Gráfico - Leads", chartId: CHART_IDS.leadsStatus },
  ];

  const lossesExcelSheets: ExcelSheet[] = [
    {
      name: "Motivos de perda",
      columns: [
        { header: "Motivo", key: "reason", width: 25 },
        { header: "Quantidade", key: "total", width: 15 },
      ],
      rows: lossReasonsData,
    },
    {
      name: "Perdas por vendedor",
      columns: [
        { header: "Vendedor", key: "owner", width: 25 },
        { header: "Valor perdido", key: "lost", width: 18 },
      ],
      rows: lossByOwnerData,
    },
  ];
  const lossesPdfSections: PdfSection[] = [
    {
      title: "Resumo de perdas",
      columns: ["Indicador", "Valor"],
      rows: [
        ["Valor perdido no período", formatCurrencyBRL(lostValue)],
        ["Negócios perdidos", lostInRange.length],
        ["Taxa de perda", `${((1 - conversionRate) * 100).toFixed(0)}%`],
      ],
    },
    {
      title: "Motivos de perda",
      columns: ["Motivo", "Quantidade"],
      rows: lossReasonsData.map((r) => [r.reason, r.total]),
      chartImageId: CHART_IDS.lossReasons,
    },
    {
      title: "Perdas por vendedor",
      columns: ["Vendedor", "Valor perdido"],
      rows: lossByOwnerData.map((r) => [r.owner, formatCurrencyBRL(r.lost)]),
      chartImageId: CHART_IDS.lossOwner,
    },
  ];
  const lossesChartSheets: ExcelChartSheetSpec[] = [
    { name: "Gráfico - Motivos perda", chartId: CHART_IDS.lossReasons },
    { name: "Gráfico - Perdas vendedor", chartId: CHART_IDS.lossOwner },
  ];

  const alertsExcelSheets: ExcelSheet[] = [
    {
      name: "Negociações vencendo",
      columns: [
        { header: "Negócio", key: "title", width: 28 },
        { header: "Organização", key: "organization", width: 25 },
        { header: "Vendedor", key: "owner", width: 20 },
        { header: "Valor", key: "value", width: 16 },
        { header: "Previsão", key: "expectedCloseDate", width: 16 },
      ],
      rows: expiringDeals.map((d) => ({
        title: d.title,
        organization: d.organization,
        owner: d.owner,
        value: formatCurrencyBRL(d.value),
        expectedCloseDate: new Date(d.expectedCloseDate).toLocaleDateString("pt-BR"),
      })),
    },
    {
      name: "Follow-ups atrasados",
      columns: [
        { header: "Tipo", key: "type", width: 14 },
        { header: "Assunto", key: "subject", width: 28 },
        { header: "Negócio", key: "dealTitle", width: 25 },
        { header: "Vendedor", key: "owner", width: 20 },
        { header: "Venceu em", key: "dueDate", width: 20 },
      ],
      rows: overdueActivityRows.map((a) => ({
        type: a.type,
        subject: a.subject,
        dealTitle: a.dealTitle ?? "—",
        owner: a.owner,
        dueDate: new Date(a.dueDate).toLocaleString("pt-BR"),
      })),
    },
  ];
  const alertsPdfSections: PdfSection[] = [
    {
      title: "Negociações próximas do vencimento",
      columns: ["Negócio", "Organização", "Vendedor", "Valor", "Previsão"],
      rows: expiringDeals.map((d) => [
        d.title,
        d.organization,
        d.owner,
        formatCurrencyBRL(d.value),
        new Date(d.expectedCloseDate).toLocaleDateString("pt-BR"),
      ]),
    },
    {
      title: "Follow-ups atrasados",
      columns: ["Tipo", "Assunto", "Negócio", "Vendedor", "Venceu em"],
      rows: overdueActivityRows.map((a) => [
        a.type,
        a.subject,
        a.dealTitle ?? "—",
        a.owner,
        new Date(a.dueDate).toLocaleString("pt-BR"),
      ]),
    },
  ];

  const generalExcelSheets = [
    ...overviewExcelSheets,
    ...pipelineExcelSheets,
    ...salesExcelSheets,
    ...ownersExcelSheets,
    ...leadsExcelSheets,
    ...lossesExcelSheets,
    ...alertsExcelSheets,
  ];
  const generalPdfSections = [
    ...overviewPdfSections,
    ...pipelinePdfSections,
    ...salesPdfSections,
    ...ownersPdfSections,
    ...leadsPdfSections,
    ...lossesPdfSections,
    ...alertsPdfSections,
  ];
  const generalChartSheets = [
    ...overviewChartSheets,
    ...pipelineChartSheets,
    ...salesChartSheets,
    ...ownersChartSheets,
    ...leadsChartSheets,
    ...lossesChartSheets,
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Relatórios"
        description="Funil, evolução, perdas e desempenho por vendedor"
        actions={
          <>
          <ReportsFilters
            pipelines={pipelines ?? []}
            owners={owners.map((o) => ({ id: o.id, name: o.full_name }))}
            pipelineId={pipelineId ?? ""}
            ownerId={ownerId}
            from={from}
            to={to}
          />
          <ExportButton
            label="Exportar geral"
            filename={fileSlug("geral")}
            pdfTitle="Relatório de Vendas — Grupo Mave CRM"
            pdfSubtitle={exportSubtitle}
            excelSheets={generalExcelSheets}
            pdfSections={generalPdfSections}
            excelChartSheets={generalChartSheets}
          />
          </>
        }
      />

      <ExportChartsBasket
        funnelData={funnelData}
        monthlyData={monthlyData}
        ownerWonChartData={ownerWonChartData}
        lossReasonsData={lossReasonsData}
        lossByOwnerData={lossByOwnerData}
        pipelineBySourceData={pipelineBySourceData}
        salesByRegionData={salesByRegionData}
        leadsByStatusData={leadsByStatusData}
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="sales">Vendas</TabsTrigger>
          <TabsTrigger value="owners">Vendedores</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="losses">Perdas</TabsTrigger>
          <TabsTrigger value="alerts">Alertas</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="flex flex-col gap-4">
            <div className="flex justify-end">
              <ExportButton
                label="Exportar esta aba"
                size="sm"
                filename={fileSlug("visao-geral")}
                pdfTitle="Visão geral — Grupo Mave CRM"
                pdfSubtitle={exportSubtitle}
                excelSheets={overviewExcelSheets}
                pdfSections={overviewPdfSections}
                excelChartSheets={overviewChartSheets}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <StatTile label="Quentes (≤3 dias)" value={String(hot)} />
              <StatTile label="Mornos (4–10 dias)" value={String(warm)} />
              <StatTile label="Frios (11+ dias)" value={String(cold)} />
              <StatTile label="Valor em aberto" value={formatCurrencyBRL(openValue)} />
              <StatTile
                label="Ganho no período"
                value={formatCurrencyBRL(wonValue)}
                sub={`${wonInRange.length} negócio(s)`}
              />
              <StatTile
                label="Taxa de conversão"
                value={`${(conversionRate * 100).toFixed(0)}%`}
                sub="ganhos / (ganhos + perdidos)"
              />
            </div>
            <StageFunnelChart data={funnelData} />
            <MonthlyTrendChart data={monthlyData} />
          </div>
        </TabsContent>

        <TabsContent value="pipeline">
          <div className="flex flex-col gap-4">
            <div className="flex justify-end">
              <ExportButton
                label="Exportar esta aba"
                size="sm"
                filename={fileSlug("pipeline")}
                pdfTitle="Pipeline — Grupo Mave CRM"
                pdfSubtitle={exportSubtitle}
                excelSheets={pipelineExcelSheets}
                pdfSections={pipelinePdfSections}
                excelChartSheets={pipelineChartSheets}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <OwnerPipelineTable rows={pipelineByOwnerData} />
              <SourcePipelineChart data={pipelineBySourceData} />
            </div>
            <StagnantDealsTable deals={stagnantDeals} />
          </div>
        </TabsContent>

        <TabsContent value="sales">
          <div className="flex flex-col gap-4">
            <div className="flex justify-end">
              <ExportButton
                label="Exportar esta aba"
                size="sm"
                filename={fileSlug("vendas")}
                pdfTitle="Vendas — Grupo Mave CRM"
                pdfSubtitle={exportSubtitle}
                excelSheets={salesExcelSheets}
                pdfSections={salesPdfSections}
                excelChartSheets={salesChartSheets}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <CustomerSalesTable rows={salesByCustomerData} />
              <RegionSalesChart data={salesByRegionData} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="owners">
          <div className="flex flex-col gap-4">
            <div className="flex justify-end">
              <ExportButton
                label="Exportar esta aba"
                size="sm"
                filename={fileSlug("vendedores")}
                pdfTitle="Vendedores — Grupo Mave CRM"
                pdfSubtitle={exportSubtitle}
                excelSheets={ownersExcelSheets}
                pdfSections={ownersPdfSections}
                excelChartSheets={ownersChartSheets}
              />
            </div>
            <OwnerWonChart data={ownerWonChartData} />
            <OwnerRankingTable rows={rankingRows} />
            <ActivityByOwnerTable rows={activityByOwnerData} />
          </div>
        </TabsContent>

        <TabsContent value="leads">
          <div className="flex flex-col gap-4">
            <div className="flex justify-end">
              <ExportButton
                label="Exportar esta aba"
                size="sm"
                filename={fileSlug("leads")}
                pdfTitle="Leads — Grupo Mave CRM"
                pdfSubtitle={exportSubtitle}
                excelSheets={leadsExcelSheets}
                pdfSections={leadsPdfSections}
                excelChartSheets={leadsChartSheets}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatTile label="Leads recebidos" value={String(leadsInRange.length)} />
              <StatTile
                label="Convertidos em negócio"
                value={String(leadsConverted)}
              />
              <StatTile
                label="Taxa de conversão"
                value={`${(leadsConversionRate * 100).toFixed(0)}%`}
                sub="convertidos / total de leads"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <LeadsStatusChart data={leadsByStatusData} />
              <LeadsSourceTable rows={leadsBySourceData} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="losses">
          <div className="flex flex-col gap-4">
            <div className="flex justify-end">
              <ExportButton
                label="Exportar esta aba"
                size="sm"
                filename={fileSlug("perdas")}
                pdfTitle="Perdas — Grupo Mave CRM"
                pdfSubtitle={exportSubtitle}
                excelSheets={lossesExcelSheets}
                pdfSections={lossesPdfSections}
                excelChartSheets={lossesChartSheets}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatTile
                label="Valor perdido no período"
                value={formatCurrencyBRL(lostValue)}
                sub={`${lostInRange.length} negócio(s)`}
              />
              <StatTile
                label="Taxa de perda"
                value={`${((1 - conversionRate) * 100).toFixed(0)}%`}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <LossReasonsChart data={lossReasonsData} />
              <LossByOwnerChart data={lossByOwnerData} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="alerts">
          <div className="flex flex-col gap-4">
            <div className="flex justify-end">
              <ExportButton
                label="Exportar esta aba"
                size="sm"
                filename={fileSlug("alertas")}
                pdfTitle="Alertas — Grupo Mave CRM"
                pdfSubtitle={exportSubtitle}
                excelSheets={alertsExcelSheets}
                pdfSections={alertsPdfSections}
              />
            </div>
            <ExpiringDealsTable rows={expiringDeals} />
            <OverdueActivitiesTable rows={overdueActivityRows} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
