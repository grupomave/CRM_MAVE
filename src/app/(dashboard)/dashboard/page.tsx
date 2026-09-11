import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrencyBRL, isoDaysAgo } from "@/lib/utils";
import { Handshake, CalendarClock, TrendingUp, AlertTriangle } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const today = new Date();
  const todayStart = new Date(today.setHours(0, 0, 0, 0)).toISOString();
  const todayEnd = new Date(today.setHours(23, 59, 59, 999)).toISOString();

  const [openDealsRes, todayActivitiesRes, stalledDealsRes] = await Promise.all([
    supabase
      .from("deals")
      .select("id, value", { count: "exact" })
      .eq("status", "open"),
    supabase
      .from("activities")
      .select("id, subject, due_date, type", { count: "exact" })
      .eq("done", false)
      .gte("due_date", todayStart)
      .lte("due_date", todayEnd)
      .order("due_date"),
    supabase
      .from("deals")
      .select("id, title, updated_at")
      .eq("status", "open")
      .lt("updated_at", isoDaysAgo(14))
      .limit(5),
  ]);

  const openDeals = openDealsRes.data ?? [];
  const openValue = openDeals.reduce((sum, d) => sum + (d.value ?? 0), 0);
  const todayActivities = todayActivitiesRes.data ?? [];
  const stalledDeals = stalledDealsRes.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          Olá, {user?.email?.split("@")[0]}
        </h1>
        <p className="text-sm text-muted-foreground">
          Visão geral do funil e das suas atividades de hoje.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Negócios em aberto</CardTitle>
            <Handshake className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{openDeals.length}</p>
            <CardDescription>{formatCurrencyBRL(openValue)} em pipeline</CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Atividades hoje</CardTitle>
            <CalendarClock className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{todayActivities.length}</p>
            <CardDescription>pendentes para hoje</CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Negócios parados</CardTitle>
            <AlertTriangle className="size-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stalledDeals.length}</p>
            <CardDescription>sem atualização há 14+ dias</CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Ticket médio</CardTitle>
            <TrendingUp className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrencyBRL(openDeals.length ? openValue / openDeals.length : 0)}
            </p>
            <CardDescription>por negócio em aberto</CardDescription>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Atividades de hoje</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {todayActivities.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhuma atividade agendada para hoje.
              </p>
            )}
            {todayActivities.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-md border border-border p-3 text-sm"
              >
                <span>{a.subject}</span>
                <span className="text-xs text-muted-foreground">
                  {a.due_date && new Date(a.due_date).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Negócios parados</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {stalledDeals.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhum negócio parado. 🎉
              </p>
            )}
            {stalledDeals.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between rounded-md border border-border p-3 text-sm"
              >
                <span>{d.title}</span>
                <span className="text-xs text-muted-foreground">
                  atualizado em{" "}
                  {new Date(d.updated_at).toLocaleDateString("pt-BR")}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
