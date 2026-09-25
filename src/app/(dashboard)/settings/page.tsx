import { createClient } from "@/lib/supabase/server";
import { listUsersForAdmin, type AdminUserRow } from "@/lib/actions/users";
import { SettingsTabs } from "./settings-tabs";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import type { StageStats } from "./pipelines-settings";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id ?? "")
    .single();

  const isAdmin = myProfile?.role === "admin";

  const [profilesRes, pipelinesRes, stagesRes, customFieldsRes, teamsRes] =
    await Promise.all([
      // Admin ve todo mundo com e-mail (via listUsersForAdmin, que usa o
      // client de service role); os demais papeis ficam com o que a RLS
      // de profiles ja libera (proprio perfil, ou equipe no caso de gestor).
      isAdmin
        ? listUsersForAdmin()
        : supabase
            .from("profiles")
            .select("id, full_name, phone, role, team_id, is_active")
            .then(({ data }) =>
              (data ?? []).map((p) => ({ ...p, email: null })) as AdminUserRow[],
            ),
      supabase.from("pipelines").select("id, name, is_default"),
      supabase
        .from("pipeline_stages")
        .select("id, name, order_index, pipeline_id, rotting_days")
        .order("order_index"),
      supabase
        .from("custom_fields")
        .select("id, entity_type, label, field_type, required, order_index")
        .order("order_index"),
      supabase.from("teams").select("id, name"),
    ]);

  // Quantidade e valor dos negócios por etapa (para mover/excluir etapas)
  const dealsByStage = await fetchAllRows<{ stage_id: string; value: number }>((from, to) =>
    supabase.from("deals").select("stage_id, value").range(from, to),
  );
  const stageStats: StageStats = {};
  for (const d of dealsByStage) {
    const current = stageStats[d.stage_id] ?? { count: 0, value: 0 };
    current.count += 1;
    current.value += Number(d.value) || 0;
    stageStats[d.stage_id] = current;
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Configurações"
        description="Usuários e permissões, pipelines e campos customizados"
      />

      {!isAdmin && (
        <p className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
          Algumas ações aqui são restritas ao papel <strong>admin</strong> — a
          escrita é bloqueada pelas políticas de RLS do Supabase mesmo que a
          tela apareça.
        </p>
      )}

      <SettingsTabs
        isAdmin={isAdmin}
        stageStats={stageStats}
        profiles={profilesRes}
        pipelines={pipelinesRes.data ?? []}
        stages={stagesRes.data ?? []}
        customFields={customFieldsRes.data ?? []}
        teams={teamsRes.data ?? []}
      />
    </div>
  );
}
