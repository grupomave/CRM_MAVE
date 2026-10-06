"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Building2, ChevronDown, FileDown, Handshake, Loader2, User, Workflow as WorkflowIcon, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { DateInput } from "@/components/ui/masked-inputs";
import { SearchInput } from "@/components/list/list-toolbar";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { friendlyError, toast } from "@/lib/toast";
import { dayKeyInSaoPaulo } from "@/lib/date-range";
import { describeEvent, WORKFLOW_CATEGORIES, type WorkflowRow } from "@/lib/workflow";
import { exportWorkbook } from "@/lib/export/excel";
import { exportPdf } from "@/lib/export/pdf";
import { exportHtml } from "@/lib/export/html";
import { loadImageAsDataUrl } from "@/lib/export/capture";

interface Option {
  id: string;
  name: string;
}

const PAGE = 50;
const EXPORT_LIMIT = 5000;
const ALL = "all";

const SELECT_COLUMNS =
  "id, occurred_at, actor_id, actor_name, action, table_name, record_id, record_label, changes, deal_id, organization_id, contact_id, owner_id";

const timeFmt = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const fullFmt = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

function isoDaysAgoKey(days: number) {
  return dayKeyInSaoPaulo(new Date(Date.now() - days * 86400000));
}

// 00:00 e 23:59:59 do dia (Brasília, UTC-3 sem horário de verão)
const startOfDay = (key: string) => new Date(`${key}T00:00:00-03:00`).toISOString();
const endOfDay = (key: string) => new Date(`${key}T23:59:59.999-03:00`).toISOString();

function dayHeading(key: string) {
  const today = dayKeyInSaoPaulo(new Date());
  const yesterday = isoDaysAgoKey(1);
  const [y, m, d] = key.split("-");
  const date = `${d}/${m}/${y}`;
  if (key === today) return `Hoje · ${date}`;
  if (key === yesterday) return `Ontem · ${date}`;
  const weekday = new Date(`${key}T12:00:00-03:00`).toLocaleDateString("pt-BR", { weekday: "long" });
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} · ${date}`;
}

export function WorkflowFeed({
  isAdmin,
  users,
  organizations,
  deals,
  contacts,
}: {
  isAdmin: boolean;
  users: Option[];
  organizations: Option[];
  deals: Option[];
  contacts: Option[];
}) {
  const [from, setFrom] = useState(isoDaysAgoKey(30));
  const [to, setTo] = useState(dayKeyInSaoPaulo(new Date()));
  const [category, setCategory] = useState<string>(ALL);
  const [actor, setActor] = useState<string>(ALL);
  const [owner, setOwner] = useState<string>(ALL);
  const [organization, setOrganization] = useState<string | null>(null);
  const [deal, setDeal] = useState<string | null>(null);
  const [contact, setContact] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [rows, setRows] = useState<WorkflowRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const requestId = useRef(0);

  const orgName = useMemo(() => new Map(organizations.map((o) => [o.id, o.name])), [organizations]);
  const dealName = useMemo(() => new Map(deals.map((o) => [o.id, o.name])), [deals]);
  const contactName = useMemo(() => new Map(contacts.map((o) => [o.id, o.name])), [contacts]);
  const userName = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users]);

  // Monta a consulta com todos os filtros (RLS limita ao que o usuário pode ver)
  const buildQuery = useCallback(
    (supabase: ReturnType<typeof createClient>, withCount: boolean) => {
      let q = supabase
        .from("audit_logs")
        .select(SELECT_COLUMNS, withCount ? { count: "exact" } : undefined)
        .order("occurred_at", { ascending: false })
        .order("id", { ascending: false });
      if (from) q = q.gte("occurred_at", startOfDay(from));
      if (to) q = q.lte("occurred_at", endOfDay(to));
      if (actor !== ALL) q = q.eq("actor_id", actor);
      if (owner !== ALL) q = q.eq("owner_id", owner);
      if (organization) q = q.eq("organization_id", organization);
      if (deal) q = q.eq("deal_id", deal);
      if (contact) q = q.eq("contact_id", contact);
      if (category !== ALL) {
        const cat = WORKFLOW_CATEGORIES.find((c) => c.value === category);
        if (cat) q = q.in("table_name", cat.tables);
        if (category === "funil") q = q.eq("action", "update").not("changes->stage_id", "is", null);
      }
      const term = search.trim().replace(/[%,()]/g, " ");
      if (term) q = q.ilike("record_label", `%${term}%`);
      return q;
    },
    [from, to, actor, owner, organization, deal, contact, category, search],
  );

  const load = useCallback(async () => {
    const current = ++requestId.current;
    setLoading(true);
    const { data, count, error } = await buildQuery(createClient(), true).range(0, PAGE - 1);
    if (current !== requestId.current) return;
    setLoading(false);
    if (error) {
      toast.error("Não foi possível carregar o workflow", { description: friendlyError(error) });
      return;
    }
    setRows((data ?? []) as unknown as WorkflowRow[]);
    setTotal(count ?? 0);
  }, [buildQuery]);

  useEffect(() => {
    // Busca no Supabase (sistema externo): o setState ocorre após o await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function loadMore() {
    setLoadingMore(true);
    const { data, error } = await buildQuery(createClient(), false).range(rows.length, rows.length + PAGE - 1);
    setLoadingMore(false);
    if (error) {
      toast.error("Não foi possível carregar mais eventos", { description: friendlyError(error) });
      return;
    }
    setRows((prev) => [...prev, ...((data ?? []) as unknown as WorkflowRow[])]);
  }

  // Agrupa por dia (Brasília)
  const groups = useMemo(() => {
    const map = new Map<string, WorkflowRow[]>();
    for (const r of rows) {
      const key = dayKeyInSaoPaulo(r.occurred_at);
      const list = map.get(key);
      if (list) list.push(r);
      else map.set(key, [r]);
    }
    return Array.from(map.entries());
  }, [rows]);

  const hasFilters =
    category !== ALL || actor !== ALL || owner !== ALL || !!organization || !!deal || !!contact || !!search;

  function clearFilters() {
    setCategory(ALL);
    setActor(ALL);
    setOwner(ALL);
    setOrganization(null);
    setDeal(null);
    setContact(null);
    setSearch("");
  }

  async function onExport(kind: "excel" | "pdf" | "html") {
    setExporting(true);
    try {
      const { data, error } = await buildQuery(createClient(), false).range(0, EXPORT_LIMIT - 1);
      if (error) throw error;
      const all = (data ?? []) as unknown as WorkflowRow[];
      const columns = ["Data/hora", "Quem fez", "O que aconteceu", "Negócio", "Organização", "Pessoa"];
      const tableRows = all.map((r) => {
        const ev = describeEvent(r);
        return [
          fullFmt.format(new Date(r.occurred_at)),
          r.actor_name,
          ev.text,
          (r.deal_id && dealName.get(r.deal_id)) || "",
          (r.organization_id && orgName.get(r.organization_id)) || "",
          (r.contact_id && contactName.get(r.contact_id)) || "",
        ];
      });
      const subtitle = `Período ${from.split("-").reverse().join("/")} a ${to.split("-").reverse().join("/")} · ${all.length} eventos${
        total > all.length ? ` (limitado aos ${EXPORT_LIMIT} mais recentes)` : ""
      }`;
      const filename = `workflow-${from}-a-${to}`;
      const logoDataUrl = await loadImageAsDataUrl("/logo-mark.png").catch(() => undefined);
      if (kind === "excel") {
        await exportWorkbook(
          filename,
          [
            {
              name: "Workflow",
              columns: columns.map((h, i) => ({ header: h, key: `c${i}`, width: i === 2 ? 70 : 24 })),
              rows: tableRows.map((r) => Object.fromEntries(r.map((v, i) => [`c${i}`, v]))),
            },
          ],
          { logoDataUrl, title: "Workflow — Grupo Mave CRM", subtitle },
        );
      } else if (kind === "pdf") {
        exportPdf(filename, "Workflow — Grupo Mave CRM", [{ title: "Eventos", columns, rows: tableRows }], {
          subtitle,
          logoDataUrl,
        });
      } else {
        exportHtml(filename, "Workflow — Grupo Mave CRM", [{ title: "Eventos", columns, rows: tableRows }], {
          subtitle,
          logoDataUrl,
          kpis: [{ label: "Eventos no período", value: String(all.length) }],
        });
      }
    } catch (err) {
      toast.error("Não foi possível exportar", { description: friendlyError(err as Error) });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FormField label="De" htmlFor="wf-from">
          <DateInput id="wf-from" value={from} onValueChange={(iso) => iso && setFrom(iso)} />
        </FormField>
        <FormField label="Até" htmlFor="wf-to">
          <DateInput id="wf-to" value={to} onValueChange={(iso) => iso && setTo(iso)} />
        </FormField>
        <FormField label="Tipo de evento" htmlFor="wf-category">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger id="wf-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os eventos</SelectItem>
              {WORKFLOW_CATEGORIES.filter((c) => isAdmin || c.value !== "config").map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Buscar pelo nome do registro" htmlFor="wf-search">
          <SearchInput value={search} onChange={setSearch} placeholder="Negócio, arquivo, atividade..." />
        </FormField>
        <FormField label="Quem fez" htmlFor="wf-actor">
          <Select value={actor} onValueChange={setActor}>
            <SelectTrigger id="wf-actor">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Responsável pelo registro" htmlFor="wf-owner">
          <Select value={owner} onValueChange={setOwner}>
            <SelectTrigger id="wf-owner">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Organização" htmlFor="wf-org">
          <Combobox
            id="wf-org"
            value={organization}
            onChange={setOrganization}
            options={organizations.map((o) => ({ value: o.id, label: o.name }))}
            placeholder="Todas"
            searchPlaceholder="Buscar organização..."
          />
        </FormField>
        <FormField label="Negócio" htmlFor="wf-deal">
          <Combobox
            id="wf-deal"
            value={deal}
            onChange={setDeal}
            options={deals.map((o) => ({ value: o.id, label: o.name }))}
            placeholder="Todos"
            searchPlaceholder="Buscar negócio..."
          />
        </FormField>
        <FormField label="Pessoa de contato" htmlFor="wf-contact">
          <Combobox
            id="wf-contact"
            value={contact}
            onChange={setContact}
            options={contacts.map((o) => ({ value: o.id, label: o.name }))}
            placeholder="Todas"
            searchPlaceholder="Buscar pessoa..."
          />
        </FormField>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          <span className="numeric font-medium text-foreground">{total}</span>{" "}
          {total === 1 ? "evento" : "eventos"} no período
          {hasFilters && (
            <Button variant="link" size="sm" onClick={clearFilters} className="ml-2">
              <X />
              Limpar filtros
            </Button>
          )}
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" disabled={exporting || total === 0}>
              {exporting ? <Loader2 className="animate-spin" /> : <FileDown />}
              Exportar
              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => void onExport("excel")}>Excel (.xlsx)</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void onExport("pdf")}>PDF</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void onExport("html")}>HTML interativo</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={WorkflowIcon}
          title="Nenhum evento encontrado"
          description="Ajuste o período ou os filtros. O histórico vale a partir da ativação do log de auditoria."
        />
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map(([day, items]) => (
            <section key={day} aria-label={dayHeading(day)} className="flex flex-col gap-1.5">
              <h2 className="sticky top-14 z-10 bg-background/95 py-1.5 text-caption font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
                {dayHeading(day)}
              </h2>
              <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card shadow-xs">
                {items.map((r) => {
                  const ev = describeEvent(r);
                  const dealLabel = r.deal_id ? dealName.get(r.deal_id) : null;
                  const orgLabel = r.organization_id ? orgName.get(r.organization_id) : null;
                  const contactLabel = r.contact_id ? contactName.get(r.contact_id) : null;
                  return (
                    <li key={r.id} className="flex items-start gap-3 px-4 py-3">
                      <UserAvatar name={r.actor_name} size="sm" />
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <p className="text-sm text-foreground">
                          <strong className="font-semibold">{r.actor_name}</strong>{" "}
                          {ev.href ? (
                            <Link href={ev.href} className="hover:text-primary hover:underline">
                              {ev.text}
                            </Link>
                          ) : (
                            ev.text
                          )}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground">
                          {dealLabel && r.table_name !== "deals" && (
                            <Link href={`/deals/${r.deal_id}`} className="inline-flex items-center gap-1 hover:text-primary hover:underline">
                              <Handshake className="size-3" aria-hidden />
                              {dealLabel}
                            </Link>
                          )}
                          {orgLabel && r.table_name !== "organizations" && (
                            <Link
                              href={`/contacts/organizations/${r.organization_id}`}
                              className="inline-flex items-center gap-1 hover:text-primary hover:underline"
                            >
                              <Building2 className="size-3" aria-hidden />
                              {orgLabel}
                            </Link>
                          )}
                          {contactLabel && r.table_name !== "contacts" && (
                            <Link
                              href={`/contacts/people/${r.contact_id}`}
                              className="inline-flex items-center gap-1 hover:text-primary hover:underline"
                            >
                              <User className="size-3" aria-hidden />
                              {contactLabel}
                            </Link>
                          )}
                          {r.owner_id && userName.get(r.owner_id) && (
                            <span>Responsável: {userName.get(r.owner_id)}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Badge variant={ev.tone}>{WORKFLOW_CATEGORIES.find((c) => c.value === ev.category)?.label.split(" (")[0]}</Badge>
                        <time dateTime={r.occurred_at} className="numeric text-caption text-muted-foreground">
                          {timeFmt.format(new Date(r.occurred_at))}
                        </time>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          {rows.length < total && (
            <div className="flex justify-center">
              <Button variant="secondary" onClick={loadMore} loading={loadingMore}>
                Carregar mais ({total - rows.length} restantes)
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
