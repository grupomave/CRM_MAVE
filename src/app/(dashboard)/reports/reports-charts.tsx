"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyBRL } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AXIS_PROPS, CURSOR, ChartTooltip, GRID_STROKE, LEGEND_PROPS, LINE_CURSOR } from "@/components/charts/chart-theme";

const compactBRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

// Cores seguem o token de cada entidade (nunca por índice/rank), como pedido
// pela skill de dataviz: Ganho e Perdido usam sempre as mesmas cores de
// status usadas no resto do app (badges, botões de ação do negócio).
const PRIMARY = "var(--color-chart-1)";
const SUCCESS = "var(--color-success)";
const DESTRUCTIVE = "var(--color-destructive)";

export function StatTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card className="min-w-0">
      <CardContent className="flex flex-col gap-1 p-4">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className="numeric truncate text-subtitle text-foreground sm:text-title" title={value}>
          {value}
        </span>
        {sub && <span className="text-caption text-muted-foreground">{sub}</span>}
      </CardContent>
    </Card>
  );
}

export function StageFunnelChart({
  data,
}: {
  data: { stage: string; total: number }[];
}) {
  const height = Math.max(288, data.length * 36);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Funil de conversão (valor em aberto por estágio)</CardTitle>
      </CardHeader>
      <CardContent style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
            <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" horizontal={false} />
            <XAxis {...AXIS_PROPS} type="number" tickFormatter={(v) => formatCurrencyBRL(v)} />
            <YAxis {...AXIS_PROPS} type="category" dataKey="stage" width={120} />
            <Tooltip cursor={CURSOR} content={<ChartTooltip valueFormatter={formatCurrencyBRL} />} />
            <Bar dataKey="total" fill={PRIMARY} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function MonthlyTrendChart({
  data,
}: {
  data: { month: string; criados: number; ganhos: number; perdidos: number }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Negócios criados x ganhos x perdidos por mês</CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
            <XAxis {...AXIS_PROPS} dataKey="month" />
            <YAxis {...AXIS_PROPS} allowDecimals={false} />
            <Tooltip cursor={LINE_CURSOR} content={<ChartTooltip />} />
            <Legend {...LEGEND_PROPS} />
            <Line
              type="monotone"
              dataKey="criados"
              name="Criados"
              stroke={PRIMARY}
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="ganhos"
              name="Ganhos"
              stroke={SUCCESS}
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="perdidos"
              name="Perdidos"
              stroke={DESTRUCTIVE}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function OwnerWonChart({
  data,
}: {
  data: { owner: string; won: number }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Valor ganho por vendedor</CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: 12 }}>
            <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
            <XAxis {...AXIS_PROPS} dataKey="owner" />
            <YAxis {...AXIS_PROPS} tickFormatter={(v) => compactBRL.format(v)} width={72} />
            <Tooltip cursor={CURSOR} content={<ChartTooltip valueFormatter={formatCurrencyBRL} />} />
            <Bar dataKey="won" fill={SUCCESS} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function LossReasonsChart({
  data,
}: {
  data: { reason: string; total: number }[];
}) {
  const height = Math.max(288, data.length * 36);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Motivos de perda</CardTitle>
      </CardHeader>
      <CardContent style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
            <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" horizontal={false} />
            <XAxis {...AXIS_PROPS} type="number" allowDecimals={false} />
            <YAxis {...AXIS_PROPS} type="category" dataKey="reason" width={140} />
            <Tooltip cursor={CURSOR} content={<ChartTooltip />} />
            <Bar dataKey="total" fill={DESTRUCTIVE} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function LossByOwnerChart({
  data,
}: {
  data: { owner: string; lost: number }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Valor perdido por vendedor</CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: 12 }}>
            <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
            <XAxis {...AXIS_PROPS} dataKey="owner" />
            <YAxis {...AXIS_PROPS} tickFormatter={(v) => compactBRL.format(v)} width={72} />
            <Tooltip cursor={CURSOR} content={<ChartTooltip valueFormatter={formatCurrencyBRL} />} />
            <Bar dataKey="lost" fill={DESTRUCTIVE} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

interface OwnerRankingRow {
  owner: string;
  wonValue: number;
  wonCount: number;
  lostCount: number;
  avgTicket: number;
  conversionRate: number;
}

export function OwnerRankingTable({ rows }: { rows: OwnerRankingRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ranking de vendedores</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <Table containerClassName="rounded-none border-0 shadow-none">
          <TableHeader>
            <TableRow>
              <TableHead>Vendedor</TableHead>
              <TableHead align="right">Valor ganho</TableHead>
              <TableHead align="right">Nº ganhos</TableHead>
              <TableHead align="right">Nº perdidos</TableHead>
              <TableHead align="right">Ticket médio</TableHead>
              <TableHead align="right">Taxa de conversão</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.owner}>
                <TableCell className="font-medium">{r.owner}</TableCell>
                <TableCell numeric>{formatCurrencyBRL(r.wonValue)}</TableCell>
                <TableCell numeric>{r.wonCount}</TableCell>
                <TableCell numeric>{r.lostCount}</TableCell>
                <TableCell numeric>{formatCurrencyBRL(r.avgTicket)}</TableCell>
                <TableCell numeric>{(r.conversionRate * 100).toFixed(0)}%</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Nenhum negócio ganho ou perdido no período.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

interface ActivityByOwnerRow {
  owner: string;
  task: number;
  call: number;
  meeting: number;
  email: number;
  done: number;
  total: number;
}

export function ActivityByOwnerTable({ rows }: { rows: ActivityByOwnerRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Atividades por vendedor no período</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <Table containerClassName="rounded-none border-0 shadow-none">
          <TableHeader>
            <TableRow>
              <TableHead>Vendedor</TableHead>
              <TableHead align="right">Tarefas</TableHead>
              <TableHead align="right">Ligações</TableHead>
              <TableHead align="right">Reuniões</TableHead>
              <TableHead align="right">E-mails</TableHead>
              <TableHead align="right">Concluídas</TableHead>
              <TableHead align="right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.owner}>
                <TableCell className="font-medium">{r.owner}</TableCell>
                <TableCell numeric>{r.task}</TableCell>
                <TableCell numeric>{r.call}</TableCell>
                <TableCell numeric>{r.meeting}</TableCell>
                <TableCell numeric>{r.email}</TableCell>
                <TableCell numeric>
                  {r.done}/{r.total}
                </TableCell>
                <TableCell numeric className="font-medium">{r.total}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  Nenhuma atividade com data no período.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
