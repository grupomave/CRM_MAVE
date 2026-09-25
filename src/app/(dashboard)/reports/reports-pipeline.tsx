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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
        <Table containerClassName="rounded-none border-0 shadow-none">
          <TableHeader>
            <TableRow>
              <TableHead>Vendedor</TableHead>
              <TableHead align="right">Valor em aberto</TableHead>
              <TableHead align="right">Negócios</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.owner}>
                <TableCell className="font-medium">{r.owner}</TableCell>
                <TableCell numeric>{formatCurrencyBRL(r.value)}</TableCell>
                <TableCell numeric>{r.count}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                  Nenhum negócio em aberto.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
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
        <Table containerClassName="rounded-none border-0 shadow-none">
          <TableHeader>
            <TableRow>
              <TableHead>Negócio</TableHead>
              <TableHead>Organização</TableHead>
              <TableHead>Etapa</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead align="right">Valor</TableHead>
              <TableHead>Parado há</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">
                  <Link href={`/deals/${d.id}`} className="hover:underline">
                    {d.title}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{d.organization}</TableCell>
                <TableCell className="text-muted-foreground">{d.stage}</TableCell>
                <TableCell className="text-muted-foreground">{d.owner}</TableCell>
                <TableCell numeric>{formatCurrencyBRL(d.value)}</TableCell>
                <TableCell>
                  <Badge variant={stagnantBadgeVariant(d.daysIdle)}>
                    {d.daysIdle} {d.daysIdle === 1 ? "dia" : "dias"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Nenhum negócio parado há mais de {minDays} dias.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
