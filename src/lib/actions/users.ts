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

export async function createUserWithPassword({
  email,
  fullName,
  role,
  teamId,
  tempPassword,
}: {
  email: string;
  fullName: string;
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
    .update({ role, team_id: teamId, must_change_password: true })
    .eq("id", data.user.id);

  if (profileError) {
    throw new Error(profileError.message);
  }

  return { id: data.user.id };
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
