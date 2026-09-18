import { createClient } from "@/lib/supabase/server";
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

  const [profilesRes, pipelinesRes, stagesRes, customFieldsRes, teamsRes] =
    await Promise.all([
      supabase.from("profiles").select("id, full_name, role, team_id, is_active"),
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

  const isAdmin = myProfile?.role === "admin";

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
        profiles={profilesRes.data ?? []}
        pipelines={pipelinesRes.data ?? []}
        stages={stagesRes.data ?? []}
        customFields={customFieldsRes.data ?? []}
        teams={teamsRes.data ?? []}
      />
    </div>
  );
}
