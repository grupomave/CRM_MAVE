"use client";

import { useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { SIDEBAR_COOKIE } from "@/lib/nav";
import { cn } from "@/lib/utils";

// Sidebar recolhível (modo só ícones). O estado fica num cookie para que o
// layout do servidor já renderize a largura certa, sem "pulo" na hidratação.
export function Sidebar({ initialCollapsed = false }: { initialCollapsed?: boolean }) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
  }

  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const toggleLabel = collapsed ? "Expandir menu" : "Recolher menu";

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-200 lg:flex",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-border",
          collapsed ? "justify-center px-2" : "px-4",
        )}
      >
        <Logo collapsed={collapsed} />
      </div>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        <SidebarNav collapsed={collapsed} />
      </div>
      <div className={cn("border-t border-border p-2", collapsed && "flex justify-center")}>
        <SimpleTooltip content={collapsed ? toggleLabel : null} side="right">
          <button
            type="button"
            onClick={toggle}
            aria-label={toggleLabel}
            aria-expanded={!collapsed}
            className={cn(
              "flex h-8 items-center gap-2 rounded-md px-2.5 text-caption font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              collapsed ? "w-8 justify-center px-0" : "w-full",
            )}
          >
            <ToggleIcon className="size-4 shrink-0" />
            {!collapsed && "Recolher menu"}
          </button>
        </SimpleTooltip>
      </div>
    </aside>
  );
}
