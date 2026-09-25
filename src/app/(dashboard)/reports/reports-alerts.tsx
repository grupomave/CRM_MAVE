"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyBRL } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
        <Table containerClassName="rounded-none border-0 shadow-none">
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Assunto</TableHead>
              <TableHead>Negócio</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead>Venceu em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((a) => (
              <TableRow key={a.id}>
                <TableCell>{ACTIVITY_TYPE_LABEL[a.type] ?? a.type}</TableCell>
                <TableCell className="font-medium">{a.subject}</TableCell>
                <TableCell className="text-muted-foreground">
                  {a.dealId && a.dealTitle ? (
                    <Link href={`/deals/${a.dealId}`} className="hover:underline">
                      {a.dealTitle}
                    </Link>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{a.owner}</TableCell>
                <TableCell>
                  <Badge variant="destructive">
                    {new Date(a.dueDate).toLocaleString("pt-BR")}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  Nenhum follow-up atrasado. 🎉
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
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
        <Table containerClassName="rounded-none border-0 shadow-none">
          <TableHeader>
            <TableRow>
              <TableHead>Negócio</TableHead>
              <TableHead>Organização</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead align="right">Valor</TableHead>
              <TableHead>Previsão de fechamento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">
                  <Link href={`/deals/${d.id}`} className="hover:underline">
                    {d.title}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{d.organization}</TableCell>
                <TableCell className="text-muted-foreground">{d.owner}</TableCell>
                <TableCell numeric>{formatCurrencyBRL(d.value)}</TableCell>
                <TableCell>
                  <Badge variant={d.overdue ? "destructive" : "warning"}>
                    {new Date(d.expectedCloseDate).toLocaleDateString("pt-BR")}
                    {d.overdue ? " (vencida)" : ""}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  Nenhuma negociação vencendo nos próximos 15 dias.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
