"use client";

import { useState } from "react";
import Link from "next/link";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrencyBRL } from "@/lib/utils";

const PRIMARY = "var(--color-primary)";

export function OwnerPipelineTable({
  rows,
}: {
  rows: { owner: string; value: number; count: number }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pipeline por vendedor (negócios abertos)</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Vendedor</th>
              <th className="p-3">Valor em aberto</th>
              <th className="p-3">Negócios</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.owner} className="border-t border-border">
                <td className="p-3 font-medium">{r.owner}</td>
                <td className="p-3">{formatCurrencyBRL(r.value)}</td>
                <td className="p-3">{r.count}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="p-6 text-center text-muted-foreground">
                  Nenhum negócio em aberto.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

export function SourcePipelineChart({
  data,
}: {
  data: { source: string; value: number }[];
}) {
  const height = Math.max(200, data.length * 40);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pipeline por origem (negócios abertos)</CardTitle>
      </CardHeader>
      <CardContent style={{ height }}>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum negócio em aberto.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => formatCurrencyBRL(v)} />
              <YAxis type="category" dataKey="source" width={120} />
              <Tooltip formatter={(v) => formatCurrencyBRL(Number(v))} />
              <Bar dataKey="value" fill={PRIMARY} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

interface StagnantDeal {
  id: string;
  title: string;
  organization: string;
  owner: string;
  stage: string;
  value: number;
  daysIdle: number;
}

function stagnantBadgeVariant(days: number): "outline" | "warning" | "stagnant" | "destructive" {
  if (days > 60) return "destructive";
  if (days > 30) return "stagnant";
  if (days > 15) return "warning";
  return "outline";
}

const THRESHOLDS = [7, 15, 30, 60];

export function StagnantDealsTable({ deals }: { deals: StagnantDeal[] }) {
  const [minDays, setMinDays] = useState(7);
  const filtered = deals.filter((d) => d.daysIdle >= minDays);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle>Oportunidades paradas</CardTitle>
        <div className="flex gap-1">
          {THRESHOLDS.map((t) => (
            <Button
              key={t}
              size="sm"
              variant={minDays === t ? "default" : "outline"}
              onClick={() => setMinDays(t)}
            >
              +{t}d
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Negócio</th>
              <th className="p-3">Organização</th>
              <th className="p-3">Etapa</th>
              <th className="p-3">Vendedor</th>
              <th className="p-3">Valor</th>
              <th className="p-3">Parado há</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr key={d.id} className="border-t border-border">
                <td className="p-3 font-medium">
                  <Link href={`/deals/${d.id}`} className="hover:underline">
                    {d.title}
                  </Link>
                </td>
                <td className="p-3 text-muted-foreground">{d.organization}</td>
                <td className="p-3 text-muted-foreground">{d.stage}</td>
                <td className="p-3 text-muted-foreground">{d.owner}</td>
                <td className="p-3">{formatCurrencyBRL(d.value)}</td>
                <td className="p-3">
                  <Badge variant={stagnantBadgeVariant(d.daysIdle)}>
                    {d.daysIdle} {d.daysIdle === 1 ? "dia" : "dias"}
                  </Badge>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  Nenhum negócio parado há mais de {minDays} dias.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
