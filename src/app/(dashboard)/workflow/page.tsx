import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { PageHeader } from "@/components/ui/page-header";
import { loadOwners } from "@/lib/data/lists";
import { WorkflowFeed } from "./workflow-feed";

export const metadata = { title: "Workflow" };

export default async function WorkflowPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id ?? "")
    .single();

  // Workflow é para administrador e gestor (o gestor vê a própria equipe, via RLS)
  if (me?.role !== "admin" && me?.role !== "gestor") redirect("/dashboard");

  const [users, organizations, deals, contacts] = await Promise.all([
    loadOwners(supabase),
    fetchAllRows<{ id: string; name: string }>((from, to) =>
      supabase.from("organizations").select("id, name").order("name").range(from, to),
    ),
    fetchAllRows<{ id: string; title: string }>((from, to) =>
      supabase.from("deals").select("id, title").order("title").range(from, to),
    ),
    fetchAllRows<{ id: string; name: string }>((from, to) =>
      supabase.from("contacts").select("id, name").order("name").range(from, to),
    ),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Workflow"
        description="Tudo o que acontece no CRM, em ordem cronológica: movimentações de funil, atividades, arquivos, propostas e mais. O histórico é guardado permanentemente e não pode ser editado nem apagado; vale daqui para frente, sem recriar o passado."
      />
      <WorkflowFeed
        isAdmin={me.role === "admin"}
        users={users.map((u) => ({ id: u.id, name: u.full_name }))}
        organizations={organizations}
        deals={deals.map((d) => ({ id: d.id, name: d.title }))}
        contacts={contacts}
      />
    </div>
  );
}
