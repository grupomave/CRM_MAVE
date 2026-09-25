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
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card/95 px-4 backdrop-blur sm:gap-3 sm:px-6">
      <div className="flex items-center gap-2 lg:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Abrir menu">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="gap-0 bg-sidebar p-0">
            <div className="flex h-14 items-center border-b border-border px-4">
              <Logo />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <SidebarNav onNavigate={() => setMobileOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
        <div className="sm:hidden">
          <Logo collapsed />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 items-center">
        <CommandPalette />
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <QuickCreateButton />
        <NotificationsBell userId={userId} />
        <UserMenu fullName={fullName} email={email} avatarUrl={avatarUrl} />
      </div>
    </header>
  );
}
