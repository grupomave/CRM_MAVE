"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/supabase/types";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Sessão expirada.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    throw new Error("Apenas administradores podem gerenciar usuários.");
  }

  return { id: user.id };
}

// Criar/editar/excluir usuário roda com a service role (auth.uid() nulo), então
// o gatilho de auditoria não sabe quem foi: o log é gravado aqui, com o admin
// que executou a ação. Uma falha no log nunca derruba a ação principal.
type AdminClient = ReturnType<typeof createAdminClient>;

async function logUserAudit(
  actorId: string,
  entry: {
    action: "insert" | "update" | "delete";
    recordId: string;
    label: string;
    changes: Record<string, unknown>;
  },
) {
  try {
    const admin = createAdminClient();
    const { data: actor } = await admin.from("profiles").select("full_name").eq("id", actorId).maybeSingle();
    const { error } = await admin.from("audit_logs").insert({
      actor_id: actorId,
      actor_name: actor?.full_name ?? "Usuário removido",
      action: entry.action,
      table_name: "profiles",
      record_id: entry.recordId,
      record_label: entry.label,
      changes: entry.changes,
    });
    if (error) console.error("Falha ao gravar log de auditoria:", error.message);
  } catch (err) {
    console.error("Falha ao gravar log de auditoria:", err);
  }
}

async function profileLabel(admin: AdminClient, profileId: string) {
  const { data } = await admin.from("profiles").select("full_name").eq("id", profileId).maybeSingle();
  return data?.full_name ?? "Usuário";
}

export interface AdminUserRow {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  team_id: string | null;
  is_active: boolean;
}

// A lista de usuários combina profiles (nome, telefone, papel) com o
// e-mail, que só existe em auth.users — por isso precisa do client admin
// mesmo pra leitura.
export async function listUsersForAdmin(): Promise<AdminUserRow[]> {
  await requireAdmin();

  const admin = createAdminClient();

  const [{ data: profiles, error: profilesError }, { data: authList, error: authError }] =
    await Promise.all([
      admin
        .from("profiles")
        .select("id, full_name, phone, role, team_id, is_active"),
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

  if (profilesError) throw new Error(profilesError.message);
  if (authError) throw new Error(authError.message);

  const emailById = new Map(authList.users.map((u) => [u.id, u.email ?? null]));

  return (profiles ?? []).map((p) => ({
    ...p,
    email: emailById.get(p.id) ?? null,
  }));
}

export async function createUserWithPassword({
  email,
  fullName,
  phone,
  role,
  teamId,
  tempPassword,
}: {
  email: string;
  fullName: string;
  phone: string | null;
  role: UserRole;
  teamId: string | null;
  tempPassword: string;
}) {
  const actor = await requireAdmin();

  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (error || !data.user) {
    throw new Error(error?.message ?? "Não foi possível criar o usuário.");
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({ role, team_id: teamId, phone, must_change_password: true })
    .eq("id", data.user.id);

  if (profileError) {
    throw new Error(profileError.message);
  }

  let teamName: string | null = null;
  if (teamId) {
    const { data: team } = await admin.from("teams").select("name").eq("id", teamId).maybeSingle();
    teamName = team?.name ?? null;
  }
  await logUserAudit(actor.id, {
    action: "insert",
    recordId: data.user.id,
    label: fullName,
    changes: { full_name: fullName, email, phone, role, team_id: teamName },
  });

  return { id: data.user.id };
}

export async function updateUserProfile({
  profileId,
  fullName,
  email,
  phone,
}: {
  profileId: string;
  fullName: string;
  email: string;
  phone: string | null;
}) {
  const actor = await requireAdmin();

  const admin = createAdminClient();

  const [{ data: before }, { data: beforeAuth }] = await Promise.all([
    admin.from("profiles").select("full_name, phone").eq("id", profileId).maybeSingle(),
    admin.auth.admin.getUserById(profileId),
  ]);

  const { error: profileError } = await admin
    .from("profiles")
    .update({ full_name: fullName, phone })
    .eq("id", profileId);

  if (profileError) throw new Error(profileError.message);

  const { error: authError } = await admin.auth.admin.updateUserById(profileId, {
    email,
    user_metadata: { full_name: fullName },
  });

  if (authError) throw new Error(authError.message);

  const changes: Record<string, { old: unknown; new: unknown }> = {};
  if ((before?.full_name ?? null) !== fullName) changes.full_name = { old: before?.full_name ?? null, new: fullName };
  if ((beforeAuth?.user?.email ?? null) !== email) changes.email = { old: beforeAuth?.user?.email ?? null, new: email };
  if ((before?.phone ?? null) !== phone) changes.phone = { old: before?.phone ?? null, new: phone };
  if (Object.keys(changes).length > 0) {
    await logUserAudit(actor.id, { action: "update", recordId: profileId, label: fullName, changes });
  }
}

export async function resetUserPassword(profileId: string, newPassword: string) {
  const actor = await requireAdmin();

  if (newPassword.length < 8) {
    throw new Error("A senha precisa ter pelo menos 8 caracteres.");
  }

  const admin = createAdminClient();

  const { error: authError } = await admin.auth.admin.updateUserById(profileId, {
    password: newPassword,
  });

  if (authError) throw new Error(authError.message);

  // Mesmo padrão da criação: força a troca no próximo login, já que quem
  // definiu a senha foi o admin, não o próprio usuário.
  const { error: profileError } = await admin
    .from("profiles")
    .update({ must_change_password: true })
    .eq("id", profileId);

  if (profileError) throw new Error(profileError.message);

  // Nunca grava a senha: só o fato de ter sido redefinida
  await logUserAudit(actor.id, {
    action: "update",
    recordId: profileId,
    label: await profileLabel(admin, profileId),
    changes: { password: { old: "—", new: "redefinida pelo administrador" } },
  });
}

export async function setUserActive(profileId: string, isActive: boolean) {
  const actor = await requireAdmin();

  const admin = createAdminClient();

  const { error: authError } = await admin.auth.admin.updateUserById(
    profileId,
    { ban_duration: isActive ? "none" : "876000h" },
  );

  if (authError) throw new Error(authError.message);

  const { error: profileError } = await admin
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", profileId);

  if (profileError) throw new Error(profileError.message);

  await logUserAudit(actor.id, {
    action: "update",
    recordId: profileId,
    label: await profileLabel(admin, profileId),
    changes: { is_active: { old: !isActive, new: isActive } },
  });
}

export async function deleteUser(profileId: string) {
  const actor = await requireAdmin();

  const admin = createAdminClient();

  // Lido antes de excluir: depois o perfil não existe mais
  const [{ data: before }, { data: beforeAuth }] = await Promise.all([
    admin.from("profiles").select("full_name, role").eq("id", profileId).maybeSingle(),
    admin.auth.admin.getUserById(profileId),
  ]);

  const { error } = await admin.auth.admin.deleteUser(profileId);

  if (error) {
    // owner_id em deals/contacts/organizations/activities referencia
    // profiles sem "on delete cascade" — se o usuário ainda for dono de
    // algum registro, o banco recusa o delete (violação de FK). Traduz
    // pra uma mensagem acionável em vez do erro cru do Postgres.
    if (/foreign key|violates/i.test(error.message)) {
      throw new Error(
        "Não é possível excluir: este usuário ainda é responsável por negócios, contatos, organizações ou atividades. Transfira esses registros para outro usuário ou apenas desative-o.",
      );
    }
    throw new Error(error.message);
  }

  await logUserAudit(actor.id, {
    action: "delete",
    recordId: profileId,
    label: before?.full_name ?? "Usuário",
    changes: {
      full_name: before?.full_name ?? null,
      email: beforeAuth?.user?.email ?? null,
      role: before?.role ?? null,
    },
  });
}
