import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, avatar_url")
    .eq("id", user?.id ?? "")
    .single();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Meu perfil</h1>
        <p className="text-sm text-muted-foreground">{user?.email}</p>
      </div>
      <ProfileForm
        fullName={profile?.full_name ?? ""}
        role={profile?.role ?? "vendedor"}
      />
    </div>
  );
}
