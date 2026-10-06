import Link from "next/link";
import { notFound } from "next/navigation";
import { Inbox } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  closedAt,
  dashboardQuery,
  loadDashboardData,
  STALLED_DAYS,
  type DashboardActivity,
  type DashboardDeal,
  type DashboardOrg,
} from "@/lib/data/dashboard";
import { monthKey, monthLabel } from "@/lib/date-range";
import { formatOverdue } from "@/lib/deal-alerts";
import { formatCurrencyBRL, formatDate } from "@/lib/utils";

export const metadata = { title: "Dashboard — detalhe" };

const MAX_ROWS = 500;

const STATUS_LABEL = { open: "Aberto", won: "Ganho", lost: "Perdido" } as const;
const STATUS_VARIANT = { open: "info", won: "success", lost: "destructive" } as const;
const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  task: "Tarefa",
  call: "Ligação",
  meeting: "Reunião",
  email: "E-mail",
  whatsapp: "WhatsApp",
};

type SearchParams = { pipeline?: string; from?: string; to?: string; stage?: string; month?: string };

interface DealRowView {
  deal: DashboardDeal;
  /** Rótulo extra (ex.: "Criado", "Ganho") quando a lista mistura situações */
  tag?: { label: string; variant: "info" | "success" | "destructive" };
  dateLabel: string;
  date: string;
}

export default async function DashboardDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ kpi: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { kpi } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const data = await loadDashboardData(supabase, sp);
  const stageName = new Map(data.stages.map((s) => [s.id, s.name]));

  let title = "";
  let description = "";
  let dealRows: DealRowView[] | null = null;
  let orgRows: DashboardOrg[] | null = null;
  let activityRows: DashboardActivity[] | null = null;
  let showStatus = false;
  let showTag = false;
  let orgDateLabel = "";

  const byValueDesc = (a: DashboardDeal, b: DashboardDeal) => b.value - a.value;
  const asRows = (deals: DashboardDeal[], dateLabel: string, pick: (d: DashboardDeal) => string): DealRowView[] =>
    deals.map((deal) => ({ deal, dateLabel, date: pick(deal) }));
  const period = `${formatDate(`${data.fromParam}T12:00:00`)} – ${formatDate(`${data.toParam}T12:00:00`)}`;

  switch (kpi) {
    case "pipeline":
      title = "Pipeline em aberto";
      description = "Negócios em aberto no funil selecionado, do maior para o menor valor.";
      dealRows = asRows([...data.openDeals].sort(byValueDesc), "Atualizado em", (d) => d.updated_at);
      break;
    case "ticket":
      title = "Ticket médio em aberto";
      description = "Negócios em aberto que compõem o ticket médio (valor total ÷ quantidade).";
      dealRows = asRows([...data.openDeals].sort(byValueDesc), "Atualizado em", (d) => d.updated_at);
      break;
    case "parados":
      title = "Negócios parados";
      description = `Em aberto e sem atualização há mais de ${STALLED_DAYS} dias, os mais antigos primeiro.`;
      dealRows = asRows(data.stalledAll, "Atualizado em", (d) => d.updated_at);
      break;
    case "ganhos":
      title = "Valor ganho";
      description = `Negócios ganhos no período ${period}.`;
      dealRows = asRows([...data.current.won].sort(byValueDesc), "Ganho em", closedAt);
      break;
    case "conversao":
      title = "Taxa de conversão";
      description = `Negócios fechados (ganhos e perdidos) no período ${period}: ${data.current.won.length} ganhos ÷ ${data.current.won.length + data.current.lost.length} fechados.`;
      dealRows = asRows(
        [...data.current.won, ...data.current.lost].sort((a, b) => closedAt(b).localeCompare(closedAt(a))),
        "Fechado em",
        closedAt,
      );
      showStatus = true;
      break;
    case "criados":
      title = "Negócios criados";
      description = `Negócios criados no período ${period}.`;
      dealRows = asRows(
        [...data.current.created].sort((a, b) => b.created_at.localeCompare(a.created_at)),
        "Criado em",
        (d) => d.created_at,
      );
      showStatus = true;
      break;
    case "etapa": {
      const name = (sp.stage && stageName.get(sp.stage)) || null;
      if (!name) notFound();
      title = `Etapa: ${name}`;
      description = "Negócios em aberto nesta etapa do funil.";
      dealRows = asRows(
        data.openDeals.filter((d) => d.stage_id === sp.stage).sort(byValueDesc),
        "Atualizado em",
        (d) => d.updated_at,
      );
      break;
    }
    case "mes": {
      if (!sp.month || !/^\d{4}-\d{2}$/.test(sp.month)) notFound();
      title = `Movimento de ${monthLabel(sp.month)}`;
      description = "Negócios criados, ganhos e perdidos no mês (um negócio pode aparecer em mais de uma situação).";
      const rows: DealRowView[] = [];
      for (const d of data.current.created.filter((x) => monthKey(x.created_at) === sp.month))
        rows.push({ deal: d, tag: { label: "Criado", variant: "info" }, dateLabel: "Data", date: d.created_at });
      for (const d of data.current.won.filter((x) => monthKey(closedAt(x)) === sp.month))
        rows.push({ deal: d, tag: { label: "Ganho", variant: "success" }, dateLabel: "Data", date: closedAt(d) });
      for (const d of data.current.lost.filter((x) => monthKey(closedAt(x)) === sp.month))
        rows.push({ deal: d, tag: { label: "Perdido", variant: "destructive" }, dateLabel: "Data", date: closedAt(d) });
      dealRows = rows.sort((a, b) => b.date.localeCompare(a.date));
      showTag = true;
      break;
    }
    case "novos-clientes":
      title = "Novos clientes";
      description = `Organizações cujo primeiro negócio ganho aconteceu no período ${period}.`;
      orgRows = [...data.newCustomers].sort((a, b) => closedAt(b.deal).localeCompare(closedAt(a.deal)));
      orgDateLabel = "1ª compra em";
      break;
    case "clientes-perdidos":
      title = "Clientes perdidos";
      description = `Organizações que perderam um negócio no período ${period} e não têm nenhum negócio aberto hoje.`;
      orgRows = [...data.lostCustomers].sort((a, b) => closedAt(b.deal).localeCompare(closedAt(a.deal)));
      orgDateLabel = "Perdido em";
      break;
    case "atividades-hoje":
      title = "Atividades de hoje";
      description = "Atividades pendentes com vencimento hoje.";
      activityRows = data.todayActivities;
      break;
    case "atividades-atrasadas":
      title = "Atividades atrasadas";
      description = "Atividades pendentes com vencimento em dias anteriores, as mais atrasadas primeiro.";
      activityRows = data.overdueActivities;
      break;
    default:
      notFound();
  }

  const total = dealRows?.length ?? orgRows?.length ?? activityRows?.length ?? 0;
  const totalValue = dealRows
    ? dealRows.reduce((s, r) => s + r.deal.value, 0)
    : orgRows
      ? orgRows.reduce((s, r) => s + r.deal.value, 0)
      : null;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={title}
        description={description}
        breadcrumbs={[
          { label: "Dashboard", href: `/dashboard?${dashboardQuery(data)}` },
          { label: title },
        ]}
      />

      <p className="text-sm text-muted-foreground">
        <span className="numeric font-medium text-foreground">{total}</span>{" "}
        {total === 1 ? "registro" : "registros"}
        {totalValue !== null && (
          <>
            {" · "}
            <span className="numeric font-medium text-foreground">{formatCurrencyBRL(totalValue)}</span> em valor
          </>
        )}
        {total > MAX_ROWS && ` · mostrando os primeiros ${MAX_ROWS}`}
      </p>

      {total === 0 ? (
        <EmptyState icon={Inbox} title="Nenhum registro para este indicador" description="Ajuste o funil ou o período no Dashboard." />
      ) : (
        <Table stickyHeader>
          {dealRows && (
            <>
              <TableHeader>
                <TableRow>
                  <TableHead>Negócio</TableHead>
                  <TableHead>Organização</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Etapa</TableHead>
                  {showStatus && <TableHead>Situação</TableHead>}
                  {showTag && <TableHead>Situação</TableHead>}
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>{dealRows[0]?.dateLabel}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dealRows.slice(0, MAX_ROWS).map((r, i) => (
                  <TableRow key={`${r.deal.id}-${i}`}>
                    <TableCell className="font-medium">
                      <Link href={`/deals/${r.deal.id}`} className="hover:text-primary hover:underline">
                        {r.deal.title}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.deal.organization_id ? (
                        <Link
                          href={`/contacts/organizations/${r.deal.organization_id}`}
                          className="hover:text-primary hover:underline"
                        >
                          {r.deal.organization_name ?? "—"}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.deal.owner_name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{stageName.get(r.deal.stage_id) ?? "—"}</TableCell>
                    {showStatus && (
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[r.deal.status]}>{STATUS_LABEL[r.deal.status]}</Badge>
                      </TableCell>
                    )}
                    {showTag && (
                      <TableCell>{r.tag && <Badge variant={r.tag.variant}>{r.tag.label}</Badge>}</TableCell>
                    )}
                    <TableCell className="numeric text-right">{formatCurrencyBRL(r.deal.value)}</TableCell>
                    <TableCell className="numeric text-muted-foreground">{formatDate(r.date)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </>
          )}

          {orgRows && (
            <>
              <TableHeader>
                <TableRow>
                  <TableHead>Organização</TableHead>
                  <TableHead>Negócio</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>{orgDateLabel}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgRows.slice(0, MAX_ROWS).map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">
                      <Link href={`/contacts/organizations/${o.id}`} className="hover:text-primary hover:underline">
                        {o.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <Link href={`/deals/${o.deal.id}`} className="hover:text-primary hover:underline">
                        {o.deal.title}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{o.deal.owner_name ?? "—"}</TableCell>
                    <TableCell className="numeric text-right">{formatCurrencyBRL(o.deal.value)}</TableCell>
                    <TableCell className="numeric text-muted-foreground">{formatDate(closedAt(o.deal))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </>
          )}

          {activityRows && (
            <>
              <TableHeader>
                <TableRow>
                  <TableHead>Assunto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Negócio</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Vencimento</TableHead>
                  {kpi === "atividades-atrasadas" && <TableHead>Atraso</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {activityRows.slice(0, MAX_ROWS).map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.subject}</TableCell>
                    <TableCell>
                      <Badge variant="neutral">{ACTIVITY_TYPE_LABEL[a.type] ?? a.type}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {a.deal_id ? (
                        <Link href={`/deals/${a.deal_id}`} className="hover:text-primary hover:underline">
                          {a.deal_title ?? "Negócio"}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{a.owner_name ?? "—"}</TableCell>
                    <TableCell className="numeric text-muted-foreground">
                      {a.due_date
                        ? new Date(a.due_date).toLocaleString("pt-BR", {
                            dateStyle: "short",
                            timeStyle: "short",
                            timeZone: "America/Sao_Paulo",
                          })
                        : "—"}
                    </TableCell>
                    {kpi === "atividades-atrasadas" && (
                      <TableCell className="numeric font-medium text-destructive">
                        {a.due_date ? formatOverdue(a.due_date)?.label : "—"}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </>
          )}
        </Table>
      )}
    </div>
  );
}
