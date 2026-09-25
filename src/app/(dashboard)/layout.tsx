import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { AppointmentAlert } from "@/components/appointment-alert";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SIDEBAR_COOKIE } from "@/lib/nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, cookieStore] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", user.id)
      .single(),
    cookies(),
  ]);

  const sidebarCollapsed = cookieStore.get(SIDEBAR_COOKIE)?.value === "collapsed";

  return (
    <TooltipProvider delayDuration={300}>
      <a
        href="#conteudo"
        className="sr-only z-100 rounded-md bg-card px-3 py-2 text-sm font-medium shadow-md focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Pular para o conteúdo
      </a>
      <div className="flex min-h-dvh">
        <Sidebar initialCollapsed={sidebarCollapsed} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header
            userId={user.id}
            fullName={profile?.full_name ?? user.email ?? "Usuário"}
            email={user.email ?? ""}
            avatarUrl={profile?.avatar_url ?? null}
          />
          <main id="conteudo" className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6">
            {children}
          </main>
        </div>
        <AppointmentAlert userId={user.id} />
      </div>
    </TooltipProvider>
  );
}
