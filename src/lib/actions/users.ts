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
  await requireAdmin();

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
  await requireAdmin();

  const admin = createAdminClient();

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
}

export async function resetUserPassword(profileId: string, newPassword: string) {
  await requireAdmin();

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
}

export async function setUserActive(profileId: string, isActive: boolean) {
  await requireAdmin();

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
}

export async function deleteUser(profileId: string) {
  await requireAdmin();

  const admin = createAdminClient();

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
}
