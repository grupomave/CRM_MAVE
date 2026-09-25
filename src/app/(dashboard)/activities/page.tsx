import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivitiesToolbar } from "./activities-toolbar";
import { ActivityDoneToggle } from "./activity-done-toggle";
import { ActivitiesCalendar } from "./activities-calendar";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Atividades" };

const TYPE_LABEL: Record<string, string> = {
  task: "Tarefa",
  call: "Ligação",
  meeting: "Reunião",
  email: "E-mail",
};

interface ActivityRow {
  id: string;
  type: string;
  subject: string;
  due_date: string | null;
  done: boolean;
  deal_id: string | null;
  deals: { title: string } | null;
}

export default async function ActivitiesPage() {
  const supabase = await createClient();
  const activities = (await fetchAllRows((from, to) =>
    supabase
      .from("activities")
      .select("id, type, subject, due_date, done, deal_id, deals ( title )")
      .order("due_date", { ascending: true, nullsFirst: false })
      .range(from, to),
  )) as unknown as ActivityRow[];

  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const todayCount = activities.filter(
    (a) => !a.done && a.due_date && a.due_date.slice(0, 10) === todayKey,
  ).length;
  const overdueCount = activities.filter(
    (a) => !a.done && a.due_date && new Date(a.due_date) < now && a.due_date.slice(0, 10) !== todayKey,
  ).length;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Atividades"
        description="Tarefas, ligações, reuniões e e-mails"
        actions={<ActivitiesToolbar />}
      />

      <div className="grid grid-cols-2 gap-3 sm:w-96">
        <Card>
          <CardContent className="flex flex-col gap-1 p-4">
            <span className="text-xs text-muted-foreground">Hoje</span>
            <span className="text-2xl font-semibold text-foreground">{todayCount}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 p-4">
            <span className="text-xs text-muted-foreground">Atrasadas</span>
            <span className="text-2xl font-semibold text-destructive">{overdueCount}</span>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">Lista</TabsTrigger>
          <TabsTrigger value="calendar">Calendário</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Feito</TableHead>
                  <TableHead>Assunto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Negócio</TableHead>
                  <TableHead>Data/hora</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.map((a) => {
                  const overdue =
                    !a.done && a.due_date && new Date(a.due_date) < now;
                  return (
                    <TableRow key={a.id}>
                      <TableCell>
                        <ActivityDoneToggle activityId={a.id} done={a.done} />
                      </TableCell>
                      <TableCell className="font-medium">{a.subject}</TableCell>
                      <TableCell>
                        <Badge variant="neutral">{TYPE_LABEL[a.type] ?? a.type}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {a.deals?.title ?? "—"}
                      </TableCell>
                      <TableCell className={overdue ? "numeric text-destructive" : "numeric text-muted-foreground"}>
                        {a.due_date
                          ? new Date(a.due_date).toLocaleString("pt-BR", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                          : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {activities.length === 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={5}>
                      <EmptyState
                        icon={CalendarClock}
                        title="Nenhuma atividade cadastrada"
                        description="Agende ligações, reuniões e tarefas para não perder nenhum follow-up."
                        action={<ActivitiesToolbar />}
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
        </TabsContent>

        <TabsContent value="calendar">
          <ActivitiesCalendar
            activities={activities.map((a) => ({
              id: a.id,
              type: a.type,
              subject: a.subject,
              due_date: a.due_date,
              done: a.done,
              deal_id: a.deal_id,
              deal_title: a.deals?.title ?? null,
            }))}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
