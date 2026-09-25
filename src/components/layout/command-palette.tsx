"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import { Building2, Inbox, KanbanSquare, Loader2, Search, Users, type LucideIcon } from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav";
import { createClient } from "@/lib/supabase/client";

interface SearchResult {
  id: string;
  label: string;
  sublabel?: string | null;
  href: string;
  group: string;
  icon: LucideIcon;
}

interface DealHit {
  id: string;
  title: string;
  organizations: { name: string } | null;
}

const GROUP_ORDER = ["Negócios", "Leads", "Organizações", "Pessoas"];

// Escapa curingas do ILIKE (% e _) digitados pelo usuário
function likePattern(term: string) {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return;

    let cancelled = false;
    const timeout = setTimeout(async () => {
      setLoading(true);
      const supabase = createClient();
      const pattern = likePattern(term);
      const [deals, leads, contacts, organizations] = await Promise.all([
        supabase
          .from("deals")
          .select("id, title, organizations ( name )")
          .ilike("title", pattern)
          .order("updated_at", { ascending: false })
          .limit(6),
        supabase.from("leads").select("id, name, source").ilike("name", pattern).limit(5),
        supabase
          .from("contacts")
          .select("id, name, email")
          .ilike("name", pattern)
          .limit(5),
        supabase
          .from("organizations")
          .select("id, name, city")
          .ilike("name", pattern)
          .limit(5),
      ]);
      if (cancelled) return;

      setResults([
        ...((deals.data ?? []) as unknown as DealHit[]).map((d) => ({
          id: d.id,
          label: d.title,
          sublabel: d.organizations?.name,
          href: `/deals/${d.id}`,
          group: "Negócios",
          icon: KanbanSquare,
        })),
        ...(leads.data ?? []).map((l) => ({
          id: l.id,
          label: l.name,
          sublabel: l.source,
          href: `/leads/${l.id}`,
          group: "Leads",
          icon: Inbox,
        })),
        ...(organizations.data ?? []).map((o) => ({
          id: o.id,
          label: o.name,
          sublabel: o.city,
          href: `/contacts/organizations/${o.id}`,
          group: "Organizações",
          icon: Building2,
        })),
        ...(contacts.data ?? []).map((c) => ({
          id: c.id,
          label: c.name,
          sublabel: c.email,
          href: `/contacts/people/${c.id}`,
          group: "Pessoas",
          icon: Users,
        })),
      ]);
      setLoading(false);
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query]);

  const searching = query.trim().length >= 2;
  const visibleResults = searching ? results : [];
  const showLoading = searching && loading;

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setQuery("");
      setResults([]);
    }
  }

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  const groupClasses =
    "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-micro [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground";
  const itemClasses =
    "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm text-foreground data-[selected=true]:bg-muted";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Buscar (Ctrl+K)"
        className="flex h-9 w-9 items-center justify-center gap-2 rounded-md border border-input bg-card text-sm text-muted-foreground shadow-xs transition-colors hover:border-border-strong hover:text-foreground sm:w-full sm:max-w-sm sm:justify-start sm:px-3"
      >
        <Search className="size-4 shrink-0" />
        <span className="hidden truncate sm:inline">Buscar negócios, leads, organizações...</span>
        <kbd className="ml-auto hidden rounded-sm border border-border bg-muted px-1.5 font-sans text-micro text-muted-foreground md:inline">
          Ctrl K
        </kbd>
      </button>

      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed left-1/2 top-[12vh] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          >
            <DialogPrimitive.Title className="sr-only">Busca global</DialogPrimitive.Title>
            <Command shouldFilter={!searching} loop>
              <div className="flex items-center gap-2 border-b border-border px-3">
                {showLoading ? (
                  <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                ) : (
                  <Search className="size-4 shrink-0 text-muted-foreground" />
                )}
                <Command.Input
                  autoFocus
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Buscar negócios, leads, pessoas, organizações ou páginas..."
                  className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                <kbd className="hidden rounded-sm border border-border bg-muted px-1.5 text-micro text-muted-foreground sm:inline">
                  Esc
                </kbd>
              </div>
              <Command.List className="scrollbar-thin max-h-[min(24rem,60vh)] overflow-y-auto p-2">
                <Command.Empty className="px-2 py-8 text-center text-sm text-muted-foreground">
                  {showLoading ? "Buscando..." : "Nenhum resultado para essa busca."}
                </Command.Empty>

                {GROUP_ORDER.map((group) => {
                  const items = visibleResults.filter((r) => r.group === group);
                  if (items.length === 0) return null;
                  return (
                    <Command.Group key={group} heading={group} className={groupClasses}>
                      {items.map((r) => (
                        <Command.Item
                          key={`${r.group}-${r.id}`}
                          value={`${r.group}-${r.id}`}
                          onSelect={() => go(r.href)}
                          className={itemClasses}
                        >
                          <r.icon className="size-4 shrink-0 text-muted-foreground" />
                          <span className="truncate">{r.label}</span>
                          {r.sublabel && (
                            <span className="ml-auto truncate pl-2 text-caption text-muted-foreground">
                              {r.sublabel}
                            </span>
                          )}
                        </Command.Item>
                      ))}
                    </Command.Group>
                  );
                })}

                <Command.Group heading="Ir para" className={groupClasses}>
                  {NAV_ITEMS.filter(
                    (item) =>
                      !searching || item.label.toLowerCase().includes(query.trim().toLowerCase()),
                  ).map((item) => (
                    <Command.Item
                      key={item.href}
                      value={`nav-${item.label}`}
                      keywords={[item.label]}
                      onSelect={() => go(item.href)}
                      className={itemClasses}
                    >
                      <item.icon className="size-4 shrink-0 text-muted-foreground" />
                      {item.label}
                    </Command.Item>
                  ))}
                </Command.Group>
              </Command.List>
              <div className="flex items-center gap-3 border-t border-border bg-muted/50 px-3 py-2 text-micro text-muted-foreground">
                <span>
                  <kbd className="font-sans">↑↓</kbd> navegar
                </span>
                <span>
                  <kbd className="font-sans">Enter</kbd> abrir
                </span>
              </div>
            </Command>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
