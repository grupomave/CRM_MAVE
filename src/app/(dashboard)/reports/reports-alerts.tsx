"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyBRL } from "@/lib/utils";

const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  task: "Tarefa",
  call: "Ligação",
  meeting: "Reunião",
  email: "E-mail",
};

interface OverdueActivity {
  id: string;
  type: string;
  subject: string;
  dueDate: string;
  owner: string;
  dealId: string | null;
  dealTitle: string | null;
}

export function OverdueActivitiesTable({ rows }: { rows: OverdueActivity[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Follow-ups atrasados</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Tipo</th>
              <th className="p-3">Assunto</th>
              <th className="p-3">Negócio</th>
              <th className="p-3">Vendedor</th>
              <th className="p-3">Venceu em</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="border-t border-border">
                <td className="p-3">{ACTIVITY_TYPE_LABEL[a.type] ?? a.type}</td>
                <td className="p-3 font-medium">{a.subject}</td>
                <td className="p-3 text-muted-foreground">
                  {a.dealId && a.dealTitle ? (
                    <Link href={`/deals/${a.dealId}`} className="hover:underline">
                      {a.dealTitle}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="p-3 text-muted-foreground">{a.owner}</td>
                <td className="p-3">
                  <Badge variant="destructive">
                    {new Date(a.dueDate).toLocaleString("pt-BR")}
                  </Badge>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  Nenhum follow-up atrasado. 🎉
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

interface ExpiringDeal {
  id: string;
  title: string;
  organization: string;
  owner: string;
  value: number;
  expectedCloseDate: string;
  overdue: boolean;
}

export function ExpiringDealsTable({ rows }: { rows: ExpiringDeal[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Negociações próximas do vencimento (15 dias)</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Negócio</th>
              <th className="p-3">Organização</th>
              <th className="p-3">Vendedor</th>
              <th className="p-3">Valor</th>
              <th className="p-3">Previsão de fechamento</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className="border-t border-border">
                <td className="p-3 font-medium">
                  <Link href={`/deals/${d.id}`} className="hover:underline">
                    {d.title}
                  </Link>
                </td>
                <td className="p-3 text-muted-foreground">{d.organization}</td>
                <td className="p-3 text-muted-foreground">{d.owner}</td>
                <td className="p-3">{formatCurrencyBRL(d.value)}</td>
                <td className="p-3">
                  <Badge variant={d.overdue ? "destructive" : "warning"}>
                    {new Date(d.expectedCloseDate).toLocaleDateString("pt-BR")}
                    {d.overdue ? " (vencida)" : ""}
                  </Badge>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  Nenhuma negociação vencendo nos próximos 15 dias.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
