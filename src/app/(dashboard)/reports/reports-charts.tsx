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

const compactBRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

// Cores seguem o token de cada entidade (nunca por índice/rank), como pedido
// pela skill de dataviz: Ganho e Perdido usam sempre as mesmas cores de
// status usadas no resto do app (badges, botões de ação do negócio).
const PRIMARY = "var(--color-primary)";
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
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-2xl font-semibold text-foreground">{value}</span>
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
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
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tickFormatter={(v) => formatCurrencyBRL(v)} />
            <YAxis type="category" dataKey="stage" width={120} />
            <Tooltip formatter={(v) => formatCurrencyBRL(Number(v))} />
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
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
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
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="owner" />
            <YAxis tickFormatter={(v) => compactBRL.format(v)} width={72} />
            <Tooltip formatter={(v) => formatCurrencyBRL(Number(v))} />
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
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="reason" width={140} />
            <Tooltip />
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
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="owner" />
            <YAxis tickFormatter={(v) => compactBRL.format(v)} width={72} />
            <Tooltip formatter={(v) => formatCurrencyBRL(Number(v))} />
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
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Vendedor</th>
              <th className="p-3">Valor ganho</th>
              <th className="p-3">Nº ganhos</th>
              <th className="p-3">Nº perdidos</th>
              <th className="p-3">Ticket médio</th>
              <th className="p-3">Taxa de conversão</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.owner} className="border-t border-border">
                <td className="p-3 font-medium">{r.owner}</td>
                <td className="p-3">{formatCurrencyBRL(r.wonValue)}</td>
                <td className="p-3">{r.wonCount}</td>
                <td className="p-3">{r.lostCount}</td>
                <td className="p-3">{formatCurrencyBRL(r.avgTicket)}</td>
                <td className="p-3">{(r.conversionRate * 100).toFixed(0)}%</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  Nenhum negócio ganho ou perdido no período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Vendedor</th>
              <th className="p-3">Tarefas</th>
              <th className="p-3">Ligações</th>
              <th className="p-3">Reuniões</th>
              <th className="p-3">E-mails</th>
              <th className="p-3">Concluídas</th>
              <th className="p-3">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.owner} className="border-t border-border">
                <td className="p-3 font-medium">{r.owner}</td>
                <td className="p-3">{r.task}</td>
                <td className="p-3">{r.call}</td>
                <td className="p-3">{r.meeting}</td>
                <td className="p-3">{r.email}</td>
                <td className="p-3">
                  {r.done}/{r.total}
                </td>
                <td className="p-3 font-medium">{r.total}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  Nenhuma atividade com data no período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
