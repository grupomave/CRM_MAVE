"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/layout/logo";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { CommandPalette } from "@/components/layout/command-palette";
import { QuickCreateButton } from "@/components/layout/quick-create-button";
import { NotificationsBell } from "@/components/layout/notifications-bell";
import { UserMenu } from "@/components/layout/user-menu";

export function Header({
  userId,
  fullName,
  email,
  avatarUrl,
}: {
  userId: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card px-4">
      <div className="flex items-center gap-2 lg:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Abrir menu">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="bg-sidebar p-0">
            <div className="border-b border-border p-3">
              <Logo />
            </div>
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
        <Logo collapsed />
      </div>

      <div className="flex flex-1 items-center justify-center">
        <CommandPalette />
      </div>

      <div className="flex items-center gap-2">
        <QuickCreateButton />
        <NotificationsBell userId={userId} />
        <UserMenu fullName={fullName} email={email} avatarUrl={avatarUrl} />
      </div>
    </header>
  );
}
