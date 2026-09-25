import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { dayKeyInSaoPaulo } from "@/lib/date-range";
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
  contact_id: string | null;
  deals: { title: string } | null;
  contacts: { name: string } | null;
}

// Atividade não tem página própria: abre o negócio (ou a pessoa) a que está
// vinculada — o mesmo destino do clique no Calendário.
function activityHref(a: { deal_id: string | null; contact_id: string | null }) {
  if (a.deal_id) return `/deals/${a.deal_id}`;
  if (a.contact_id) return `/contacts/people/${a.contact_id}`;
  return null;
}

export default async function ActivitiesPage() {
  const supabase = await createClient();
  const activities = (await fetchAllRows((from, to) =>
    supabase
      .from("activities")
      .select("id, type, subject, due_date, done, deal_id, contact_id, deals ( title ), contacts ( name )")
      .order("due_date", { ascending: true, nullsFirst: false })
      .range(from, to),
  )) as unknown as ActivityRow[];

  const now = new Date();
  const todayKey = dayKeyInSaoPaulo(now);
  const todayCount = activities.filter(
    (a) => !a.done && a.due_date && dayKeyInSaoPaulo(a.due_date) === todayKey,
  ).length;
  const overdueCount = activities.filter(
    (a) => !a.done && a.due_date && new Date(a.due_date) < now && dayKeyInSaoPaulo(a.due_date) !== todayKey,
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
            <span className="text-sm font-medium text-muted-foreground">Hoje</span>
            <span className="numeric text-display text-foreground">{todayCount}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 p-4">
            <span className="text-sm font-medium text-muted-foreground">Atrasadas</span>
            <span className="numeric text-display text-destructive">{overdueCount}</span>
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
                  <TableHead>Vinculada a</TableHead>
                  <TableHead>Data/hora</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.map((a) => {
                  const overdue =
                    !a.done && a.due_date && new Date(a.due_date) < now;
                  const href = activityHref(a);
                  return (
                    <TableRow key={a.id}>
                      <TableCell>
                        <ActivityDoneToggle activityId={a.id} done={a.done} label={a.subject} />
                      </TableCell>
                      <TableCell className="font-medium">
                        {href ? (
                          <Link
                            href={href}
                            className={a.done ? "text-muted-foreground line-through hover:text-primary hover:underline" : "hover:text-primary hover:underline"}
                          >
                            {a.subject}
                          </Link>
                        ) : (
                          <span className={a.done ? "text-muted-foreground line-through" : undefined}>{a.subject}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="neutral">{TYPE_LABEL[a.type] ?? a.type}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {a.deal_id && a.deals?.title ? (
                          <Link href={`/deals/${a.deal_id}`} className="hover:text-primary hover:underline">
                            {a.deals.title}
                          </Link>
                        ) : a.contact_id && a.contacts?.name ? (
                          <Link href={`/contacts/people/${a.contact_id}`} className="hover:text-primary hover:underline">
                            {a.contacts.name}
                          </Link>
                        ) : (
                          "—"
                        )}
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
              contact_id: a.contact_id,
            }))}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
