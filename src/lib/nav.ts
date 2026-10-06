import type { LucideIcon } from "lucide-react";
import type { UserRole } from "@/lib/supabase/types";
import {
  LayoutDashboard,
  KanbanSquare,
  Inbox,
  Users,
  Building2,
  CalendarClock,
  FileText,
  Zap,
  BarChart3,
  Settings,
  Workflow,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Quando definido, só estes papéis veem o item no menu */
  roles?: UserRole[];
}

export interface NavGroup {
  label: string | null;
  items: NavItem[];
}

// Agrupamento lógico da sidebar. Um único pacote de ícones (lucide) e um
// ícone por módulo — o mesmo ícone é usado no Ctrl+K e nos estados vazios.
export const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Vendas",
    items: [
      { label: "Negócios", href: "/pipeline", icon: KanbanSquare },
      { label: "Leads", href: "/leads", icon: Inbox },
      { label: "Atividades", href: "/activities", icon: CalendarClock },
    ],
  },
  {
    label: "Contatos",
    items: [
      { label: "Pessoas", href: "/contacts/people", icon: Users },
      { label: "Organizações", href: "/contacts/organizations", icon: Building2 },
    ],
  },
  {
    label: "Gestão",
    items: [
      { label: "Documentos", href: "/documents", icon: FileText },
      { label: "Automações", href: "/automations", icon: Zap },
      { label: "Workflow", href: "/workflow", icon: Workflow, roles: ["admin", "gestor"] },
      { label: "Relatórios", href: "/reports", icon: BarChart3 },
    ],
  },
];

export const SETTINGS_NAV_ITEM: NavItem = {
  label: "Configurações",
  href: "/settings",
  icon: Settings,
};

export const NAV_ITEMS: NavItem[] = [
  ...NAV_GROUPS.flatMap((g) => g.items),
  SETTINGS_NAV_ITEM,
];

export const SIDEBAR_COOKIE = "mave-sidebar";
// Largura do menu expandido (px), ajustável arrastando a borda
export const SIDEBAR_WIDTH_COOKIE = "mave-sidebar-width";
export const SIDEBAR_WIDTH_MIN = 200;
export const SIDEBAR_WIDTH_MAX = 380;
export const SIDEBAR_WIDTH_DEFAULT = 240;

export function isNavItemActive(pathname: string, href: string) {
  // /deals/[id] pertence ao módulo Negócios (/pipeline)
  if (href === "/pipeline" && pathname.startsWith("/deals/")) return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Itens do menu visíveis para o papel do usuário */
export function navItemVisible(item: NavItem, role: UserRole | null | undefined) {
  return !item.roles || (role != null && item.roles.includes(role));
}
