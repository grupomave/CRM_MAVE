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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
        <Table containerClassName="rounded-none border-0 shadow-none">
          <TableHeader>
            <TableRow>
              <TableHead>Origem</TableHead>
              <TableHead align="right">Leads</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.source}>
                <TableCell className="font-medium">{r.source}</TableCell>
                <TableCell numeric>{r.total}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={2} className="h-24 text-center text-muted-foreground">
                  Nenhum lead no período.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
