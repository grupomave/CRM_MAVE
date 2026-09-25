"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, SETTINGS_NAV_ITEM, isNavItemActive, type NavItem } from "@/lib/nav";
import { SimpleTooltip } from "@/components/ui/tooltip";

function NavLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={cn(
        "relative flex h-9 items-center gap-3 rounded-md px-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-muted hover:text-foreground",
        active &&
          "bg-sidebar-active text-sidebar-active-foreground hover:bg-sidebar-active hover:text-sidebar-active-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute inset-y-1.5 -left-2 w-1 rounded-r-full bg-primary"
        />
      )}
      <Icon className="size-4 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );

  return collapsed ? (
    <SimpleTooltip content={item.label} side="right">
      {link}
    </SimpleTooltip>
  ) : (
    link
  );
}

export function SidebarNav({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Menu principal" className="flex h-full flex-col px-2 py-3">
      <div className="flex flex-1 flex-col gap-4">
        {NAV_GROUPS.map((group, i) => (
          <div key={group.label ?? i} className="flex flex-col gap-0.5">
            {group.label &&
              (collapsed ? (
                <div aria-hidden className="mx-2 mb-1 h-px bg-border" />
              ) : (
                <p className="px-2.5 pb-1 text-micro font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </p>
              ))}
            {group.items.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={isNavItemActive(pathname, item.href)}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="border-t border-border pt-3">
        <NavLink
          item={SETTINGS_NAV_ITEM}
          active={isNavItemActive(pathname, SETTINGS_NAV_ITEM.href)}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
      </div>
    </nav>
  );
}
