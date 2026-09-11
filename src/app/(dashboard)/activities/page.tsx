import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { ActivitiesToolbar } from "./activities-toolbar";
import { ActivityDoneToggle } from "./activity-done-toggle";

const TYPE_LABEL: Record<string, string> = {
  task: "Tarefa",
  call: "Ligação",
  meeting: "Reunião",
  email: "E-mail",
};

export default async function ActivitiesPage() {
  const supabase = await createClient();
  const { data: activities } = await supabase
    .from("activities")
    .select("id, type, subject, due_date, done, deals ( title )")
    .order("due_date", { ascending: true, nullsFirst: false });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Atividades / Agenda
          </h1>
          <p className="text-sm text-muted-foreground">
            Tarefas, ligações, reuniões e e-mails
          </p>
        </div>
        <ActivitiesToolbar />
      </div>

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
            {(activities ?? []).map((a: any) => (
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
                <td className="p-3 text-muted-foreground">
                  {a.due_date
                    ? new Date(a.due_date).toLocaleString("pt-BR")
                    : "—"}
                </td>
              </tr>
            ))}
            {(activities ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  Nenhuma atividade cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
