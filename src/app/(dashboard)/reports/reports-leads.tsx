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

const PRIMARY = "var(--color-primary)";

const STATUS_ORDER = ["Novo", "Contatado", "Qualificado", "Convertido", "Desqualificado"];

export function LeadsStatusChart({
  data,
}: {
  data: { status: string; total: number }[];
}) {
  const ordered = [...data].sort(
    (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Leads por estágio de qualificação</CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        {ordered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum lead no período.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ordered} margin={{ left: 12 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="status" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="total" fill={PRIMARY} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function LeadsSourceTable({
  rows,
}: {
  rows: { source: string; total: number }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Leads por origem</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Origem</th>
              <th className="p-3">Leads</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.source} className="border-t border-border">
                <td className="p-3 font-medium">{r.source}</td>
                <td className="p-3">{r.total}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={2} className="p-6 text-center text-muted-foreground">
                  Nenhum lead no período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
