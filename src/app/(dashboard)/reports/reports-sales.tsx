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
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Cliente</th>
              <th className="p-3">Valor ganho</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.customer} className="border-t border-border">
                <td className="p-3 font-medium">{r.customer}</td>
                <td className="p-3">{formatCurrencyBRL(r.value)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={2} className="p-6 text-center text-muted-foreground">
                  Nenhuma venda no período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => formatCurrencyBRL(v)} />
              <YAxis type="category" dataKey="region" width={100} />
              <Tooltip formatter={(v) => formatCurrencyBRL(Number(v))} />
              <Bar dataKey="value" fill={SUCCESS} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
