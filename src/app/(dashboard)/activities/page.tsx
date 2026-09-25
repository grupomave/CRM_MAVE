import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivitiesToolbar } from "./activities-toolbar";
import { ActivityDoneToggle } from "./activity-done-toggle";
import { ActivitiesCalendar } from "./activities-calendar";
import { PageHeader } from "@/components/ui/page-header";

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
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3">Feito</th>
                  <th className="p-3">Assunto</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Negócio</th>
                  <th className="p-3">Data/hora</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((a) => {
                  const overdue =
                    !a.done && a.due_date && new Date(a.due_date) < now;
                  return (
                    <tr key={a.id} className="border-t border-border">
                      <td className="p-3">
                        <ActivityDoneToggle activityId={a.id} done={a.done} />
                      </td>
                      <td className="p-3 font-medium">{a.subject}</td>
                      <td className="p-3">
                        <Badge variant="outline">{TYPE_LABEL[a.type] ?? a.type}</Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {a.deals?.title ?? "—"}
                      </td>
                      <td className={overdue ? "p-3 text-destructive" : "p-3 text-muted-foreground"}>
                        {a.due_date ? new Date(a.due_date).toLocaleString("pt-BR") : "—"}
                      </td>
                    </tr>
                  );
                })}
                {activities.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted-foreground">
                      Nenhuma atividade cadastrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
