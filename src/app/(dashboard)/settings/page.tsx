import { createClient } from "@/lib/supabase/server";
import { listUsersForAdmin, type AdminUserRow } from "@/lib/actions/users";
import { SettingsTabs } from "./settings-tabs";

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

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Usuários e permissões, pipelines e campos customizados
        </p>
      </div>

      {!isAdmin && (
        <p className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
          Algumas ações aqui são restritas ao papel <strong>admin</strong> — a
          escrita é bloqueada pelas políticas de RLS do Supabase mesmo que a
          tela apareça.
        </p>
      )}

      <SettingsTabs
        profiles={profilesRes}
        pipelines={pipelinesRes.data ?? []}
        stages={stagesRes.data ?? []}
        customFields={customFieldsRes.data ?? []}
        teams={teamsRes.data ?? []}
      />
    </div>
  );
}
