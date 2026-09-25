import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Meu perfil" };

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
    <div className="mx-auto flex w-full max-w-form flex-col gap-6">
      <PageHeader
        title="Meu perfil"
        description={user?.email}
        breadcrumbs={[{ label: "Configurações", href: "/settings" }, { label: "Meu perfil" }]}
      />
      <ProfileForm
        fullName={profile?.full_name ?? ""}
        role={profile?.role ?? "vendedor"}
      />
    </div>
  );
}
