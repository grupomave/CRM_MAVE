"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
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
import { AXIS_PROPS, CURSOR, ChartTooltip, GRID_STROKE } from "@/components/charts/chart-theme";

const SUCCESS = "var(--color-success)";

export function CustomerSalesTable({
  rows,
}: {
  rows: { customer: string; value: number }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Vendas por cliente (top 10 no período)</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <Table containerClassName="rounded-none border-0 shadow-none">
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead align="right">Valor ganho</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.customer}>
                <TableCell className="font-medium">{r.customer}</TableCell>
                <TableCell numeric>{formatCurrencyBRL(r.value)}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={2} className="h-24 text-center text-muted-foreground">
                  Nenhuma venda no período.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function RegionSalesChart({
  data,
}: {
  data: { region: string; value: number }[];
}) {
  const height = Math.max(200, data.length * 40);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Vendas por região (estado da organização)</CardTitle>
      </CardHeader>
      <CardContent style={{ height }}>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma venda no período.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" horizontal={false} />
              <XAxis {...AXIS_PROPS} type="number" tickFormatter={(v) => formatCurrencyBRL(v)} />
              <YAxis {...AXIS_PROPS} type="category" dataKey="region" width={100} />
              <Tooltip cursor={CURSOR} content={<ChartTooltip valueFormatter={formatCurrencyBRL} />} />
              <Bar dataKey="value" fill={SUCCESS} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
