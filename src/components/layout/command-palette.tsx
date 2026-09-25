"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Search } from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav";
import { createClient } from "@/lib/supabase/client";

interface SearchResult {
  id: string;
  label: string;
  href: string;
  group: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!query || query.length < 2) {
      return;
    }
    const timeout = setTimeout(async () => {
      const supabase = createClient();
      const [deals, contacts, organizations] = await Promise.all([
        supabase
          .from("deals")
          .select("id, title")
          .ilike("title", `%${query}%`)
          .limit(5),
        supabase
          .from("contacts")
          .select("id, name")
          .ilike("name", `%${query}%`)
          .limit(5),
        supabase
          .from("organizations")
          .select("id, name")
          .ilike("name", `%${query}%`)
          .limit(5),
      ]);

      setResults([
        ...(deals.data ?? []).map((d) => ({
          id: d.id,
          label: d.title,
          href: `/deals/${d.id}`,
          group: "Negócios",
        })),
        ...(contacts.data ?? []).map((c) => ({
          id: c.id,
          label: c.name,
          href: `/contacts/people/${c.id}`,
          group: "Pessoas",
        })),
        ...(organizations.data ?? []).map((o) => ({
          id: o.id,
          label: o.name,
          href: `/contacts/organizations/${o.id}`,
          group: "Organizações",
        })),
      ]);
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  const visibleResults = query.length < 2 ? [] : results;

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-9 w-64 items-center gap-2 rounded-md border border-input bg-transparent px-3 text-sm text-muted-foreground outline-none hover:bg-muted"
      >
        <Search className="size-4" />
        Buscar...
        <kbd className="ml-auto rounded border border-border bg-muted px-1.5 text-micro">
          Ctrl K
        </kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[15vh]">
          <div
            className="absolute inset-0"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <Command className="relative z-10 w-full max-w-lg overflow-hidden rounded-lg border border-border bg-card shadow-lg">
            <div className="flex items-center border-b border-border px-3">
              <Search className="size-4 text-muted-foreground" />
              <Command.Input
                autoFocus
                value={query}
                onValueChange={setQuery}
                placeholder="Buscar negócios, contatos, organizações..."
                className="h-11 w-full bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <Command.List className="max-h-80 overflow-y-auto p-2">
              <Command.Empty className="px-2 py-6 text-center text-sm text-muted-foreground">
                Nenhum resultado.
              </Command.Empty>

              <Command.Group heading="Navegar" className="text-xs font-medium text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
                {NAV_ITEMS.map((item) => (
                  <Command.Item
                    key={item.href}
                    value={item.label}
                    onSelect={() => go(item.href)}
                    className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground data-[selected=true]:bg-muted"
                  >
                    <item.icon className="size-4" />
                    {item.label}
                  </Command.Item>
                ))}
              </Command.Group>

              {visibleResults.length > 0 && (
                <Command.Group heading="Resultados" className="text-xs font-medium text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
                  {visibleResults.map((r) => (
                    <Command.Item
                      key={`${r.group}-${r.id}`}
                      value={r.label}
                      onSelect={() => go(r.href)}
                      className="flex cursor-pointer items-center justify-between rounded-sm px-2 py-1.5 text-sm text-foreground data-[selected=true]:bg-muted"
                    >
                      {r.label}
                      <span className="text-xs text-muted-foreground">
                        {r.group}
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </Command.List>
          </Command>
        </div>
      )}
    </>
  );
}
