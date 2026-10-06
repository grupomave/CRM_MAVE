import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { PageHeader } from "@/components/ui/page-header";
import { loadOwners } from "@/lib/data/lists";
import { WORKFLOW_KINDS } from "@/lib/workflow";
import { WorkflowFeed } from "./workflow-feed";

export const metadata = { title: "Workflow" };

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

export default async function WorkflowPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; kinds?: string; pipeline?: string; owner?: string }>;
}) {
  const params = await searchParams;
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

  const [users, pipelines, organizations, deals, contacts] = await Promise.all([
    loadOwners(supabase),
    supabase
      .from("pipelines")
      .select("id, name")
      .order("name")
      .then((r) => (r.data ?? []) as { id: string; name: string }[]),
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

  // Filtros iniciais vindos da URL (links do Dashboard e filtros compartilhados)
  const validKinds = new Set(WORKFLOW_KINDS.map((k) => k.value));
  const initial = {
    from: params.from && DAY_KEY.test(params.from) ? params.from : undefined,
    to: params.to && DAY_KEY.test(params.to) ? params.to : undefined,
    kinds: (params.kinds ?? "").split(",").filter((k) => validKinds.has(k)),
    pipeline: pipelines.some((p) => p.id === params.pipeline) ? params.pipeline : undefined,
    owner: users.some((u) => u.id === params.owner) ? params.owner : undefined,
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Workflow"
        description="Tudo o que acontece no CRM, em ordem cronológica: movimentações de funil, atividades, arquivos, propostas e mais. O histórico é guardado permanentemente e não pode ser editado nem apagado; vale daqui para frente, sem recriar o passado."
      />
      <WorkflowFeed
        isAdmin={me.role === "admin"}
        initial={initial}
        users={users.map((u) => ({ id: u.id, name: u.full_name }))}
        pipelines={pipelines}
        organizations={organizations}
        deals={deals.map((d) => ({ id: d.id, name: d.title }))}
        contacts={contacts}
      />
    </div>
  );
}
