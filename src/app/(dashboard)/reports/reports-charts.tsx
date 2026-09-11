"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyBRL } from "@/lib/utils";

const COLORS = ["#255474", "#0492D5", "#4A8CB0", "#1FB37A", "#F3D929", "#E5484D"];

export function FunnelChart({
  data,
}: {
  data: { stage: string; total: number }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Funil de conversão (valor por estágio)</CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tickFormatter={(v) => formatCurrencyBRL(v)} />
            <YAxis type="category" dataKey="stage" width={120} />
            <Tooltip formatter={(v) => formatCurrencyBRL(Number(v))} />
            <Bar dataKey="total" radius={[0, 4, 4, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function OwnerPerformanceChart({
  data,
}: {
  data: { owner: string; won: number }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Desempenho por vendedor (fechado ganho)</CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="owner" />
            <YAxis tickFormatter={(v) => formatCurrencyBRL(v)} />
            <Tooltip formatter={(v) => formatCurrencyBRL(Number(v))} />
            <Bar dataKey="won" fill="#1FB37A" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
