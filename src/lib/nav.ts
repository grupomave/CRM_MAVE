import type { LucideIcon } from "lucide-react";
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
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

// Seção 3.1 do prompt.md — 8 módulos da sidebar
export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Negócios", href: "/pipeline", icon: KanbanSquare },
  { label: "Leads", href: "/leads", icon: Inbox },
  { label: "Pessoas", href: "/contacts/people", icon: Users },
  { label: "Organizações", href: "/contacts/organizations", icon: Building2 },
  { label: "Atividades", href: "/activities", icon: CalendarClock },
  { label: "Documentos", href: "/documents", icon: FileText },
  { label: "Automações", href: "/automations", icon: Zap },
  { label: "Relatórios", href: "/reports", icon: BarChart3 },
  { label: "Configurações", href: "/settings", icon: Settings },
];
