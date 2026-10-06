"use client";

import type { UserRole } from "@/lib/supabase/types";
import { useRef, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { SimpleTooltip } from "@/components/ui/tooltip";
import {
  SIDEBAR_COOKIE,
  SIDEBAR_WIDTH_COOKIE,
  SIDEBAR_WIDTH_DEFAULT,
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_MIN,
} from "@/lib/nav";
import { cn } from "@/lib/utils";

const clampWidth = (w: number) => Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, Math.round(w)));

// Sidebar recolhível (modo só ícones) e com largura ajustável (arrastar a
// borda direita). Estado e largura ficam em cookies para que o layout do
// servidor já renderize o tamanho certo, sem "pulo" na hidratação.
export function Sidebar({
  initialCollapsed = false,
  initialWidth = SIDEBAR_WIDTH_DEFAULT,
  role,
}: {
  initialCollapsed?: boolean;
  initialWidth?: number;
  role?: UserRole | null;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [width, setWidth] = useState(initialWidth);
  const [resizing, setResizing] = useState(false);
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);

  function saveWidth(w: number) {
    document.cookie = `${SIDEBAR_WIDTH_COOKIE}=${w}; path=/; max-age=31536000; samesite=lax`;
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startWidth: width };
    setResizing(true);
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    setWidth(clampWidth(drag.current.startWidth + e.clientX - drag.current.startX));
  }
  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const next = clampWidth(drag.current.startWidth + e.clientX - drag.current.startX);
    drag.current = null;
    setResizing(false);
    setWidth(next);
    saveWidth(next);
  }
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next = clampWidth(width + (e.key === "ArrowRight" ? 16 : -16));
    setWidth(next);
    saveWidth(next);
  }
  function resetWidth() {
    setWidth(SIDEBAR_WIDTH_DEFAULT);
    saveWidth(SIDEBAR_WIDTH_DEFAULT);
  }

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
  }

  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const toggleLabel = collapsed ? "Expandir menu" : "Recolher menu";

  return (
    <aside
      style={collapsed ? undefined : { width }}
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-sidebar lg:flex",
        resizing ? "select-none" : "transition-[width] duration-200",
        collapsed && "w-16",
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
        <SidebarNav collapsed={collapsed} role={role} />
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
      {!collapsed && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Ajustar largura do menu (setas esquerda e direita; duplo clique restaura)"
          aria-valuemin={SIDEBAR_WIDTH_MIN}
          aria-valuemax={SIDEBAR_WIDTH_MAX}
          aria-valuenow={width}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
          onDoubleClick={resetWidth}
          className={cn(
            "absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize touch-none outline-none transition-colors",
            "hover:bg-primary/30 focus-visible:bg-primary/40",
            resizing && "bg-primary/40",
          )}
        />
      )}
    </aside>
  );
}
