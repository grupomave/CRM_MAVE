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
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { friendlyError, toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { dayKeyInSaoPaulo } from "@/lib/date-range";
import {
  describeEvent,
  HEADLINE_KINDS,
  kindLabel,
  WORKFLOW_KIND_GROUPS,
  WORKFLOW_KINDS,
  type WorkflowRow,
} from "@/lib/workflow";
import {
  endOfDay,
  loadWorkflowSummary,
  startOfDay,
  type WorkflowSummary,
} from "@/lib/workflow-summary";
import { exportWorkbook } from "@/lib/export/excel";
import { exportPdf } from "@/lib/export/pdf";
import { exportHtml } from "@/lib/export/html";
import { loadImageAsDataUrl } from "@/lib/export/capture";

interface Option {
  id: string;
  name: string;
}

export interface WorkflowInitialFilters {
  from?: string;
  to?: string;
  kinds: string[];
  pipeline?: string;
  owner?: string;
}

const PAGE = 50;
const EXPORT_LIMIT = 5000;
const ALL = "all";
const RANK_ROWS = 8;

const SELECT_COLUMNS =
  "id, occurred_at, actor_id, actor_name, action, table_name, record_id, record_label, changes, deal_id, organization_id, contact_id, owner_id, pipeline_id, event_kind";

const timeFmt = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const fullFmt = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

function isoDaysAgoKey(days: number) {
  return dayKeyInSaoPaulo(new Date(Date.now() - days * 86400000));
}

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

const brDate = (key: string) => key.split("-").reverse().join("/");

// Lista ordenada com barras proporcionais; clicar aplica (ou remove) o filtro correspondente
function RankList({
  title,
  items,
  selected,
  onSelect,
}: {
  title: string;
  items: { key: string | null; label: string; total: number }[];
  selected: string | null;
  onSelect: (key: string) => void;
}) {
  const max = Math.max(1, ...items.map((i) => i.total));
  return (
    <section aria-label={title} className="rounded-lg border border-border bg-card p-4 shadow-xs">
      <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
      {items.length === 0 ? (
        <p className="text-caption text-muted-foreground">Sem eventos no período.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.slice(0, RANK_ROWS).map((item) => {
            const active = item.key !== null && item.key === selected;
            const content = (
              <>
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 rounded-sm bg-primary-subtle"
                  style={{ width: `${(item.total / max) * 100}%` }}
                />
                <span className="relative min-w-0 flex-1 truncate text-left text-sm text-foreground">{item.label}</span>
                <span className="numeric relative text-sm font-medium text-foreground">{item.total}</span>
              </>
            );
            return (
              <li key={item.key ?? "none"}>
                {item.key === null ? (
                  <div className="relative flex items-center gap-3 rounded-sm px-2 py-1.5">{content}</div>
                ) : (
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => onSelect(item.key as string)}
                    className={cn(
                      "relative flex w-full items-center gap-3 rounded-sm px-2 py-1.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                      active ? "ring-1 ring-primary" : "hover:bg-muted",
                    )}
                  >
                    {content}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {items.length > RANK_ROWS && (
        <p className="mt-2 text-caption text-muted-foreground">
          +{items.length - RANK_ROWS} não exibidos (use os filtros para detalhar)
        </p>
      )}
    </section>
  );
}

export function WorkflowFeed({
  isAdmin,
  initial,
  users,
  pipelines,
  organizations,
  deals,
  contacts,
}: {
  isAdmin: boolean;
  initial: WorkflowInitialFilters;
  users: Option[];
  pipelines: Option[];
  organizations: Option[];
  deals: Option[];
  contacts: Option[];
}) {
  const [from, setFrom] = useState(initial.from ?? isoDaysAgoKey(30));
  const [to, setTo] = useState(initial.to ?? dayKeyInSaoPaulo(new Date()));
  const [kinds, setKinds] = useState<string[]>(initial.kinds);
  const [pipeline, setPipeline] = useState<string>(initial.pipeline ?? ALL);
  const [actor, setActor] = useState<string>(ALL);
  const [owner, setOwner] = useState<string>(initial.owner ?? ALL);
  const [organization, setOrganization] = useState<string | null>(null);
  const [deal, setDeal] = useState<string | null>(null);
  const [contact, setContact] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [rows, setRows] = useState<WorkflowRow[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<WorkflowSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const requestId = useRef(0);
  const summaryRequestId = useRef(0);

  const orgName = useMemo(() => new Map(organizations.map((o) => [o.id, o.name])), [organizations]);
  const dealName = useMemo(() => new Map(deals.map((o) => [o.id, o.name])), [deals]);
  const contactName = useMemo(() => new Map(contacts.map((o) => [o.id, o.name])), [contacts]);
  const userName = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users]);
  const pipelineName = useMemo(() => new Map(pipelines.map((p) => [p.id, p.name])), [pipelines]);

  const visibleKinds = useMemo(() => WORKFLOW_KINDS.filter((k) => isAdmin || k.value !== "config"), [isAdmin]);

  // Mantém os filtros principais na URL (link compartilhável; o Dashboard abre o Workflow já filtrado)
  useEffect(() => {
    const params = new URLSearchParams();
    params.set("from", from);
    params.set("to", to);
    if (kinds.length > 0) params.set("kinds", kinds.join(","));
    if (pipeline !== ALL) params.set("pipeline", pipeline);
    if (owner !== ALL) params.set("owner", owner);
    window.history.replaceState(null, "", `?${params.toString()}`);
  }, [from, to, kinds, pipeline, owner]);

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
      if (pipeline !== ALL) q = q.eq("pipeline_id", pipeline);
      if (organization) q = q.eq("organization_id", organization);
      if (deal) q = q.eq("deal_id", deal);
      if (contact) q = q.eq("contact_id", contact);
      if (kinds.length > 0) q = q.in("event_kind", kinds);
      const term = search.trim().replace(/[%,()]/g, " ");
      if (term) q = q.ilike("record_label", `%${term}%`);
      return q;
    },
    [from, to, actor, owner, pipeline, organization, deal, contact, kinds, search],
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

  // Resumo (contagens por tipo, responsável e funil) com os mesmos filtros da lista
  useEffect(() => {
    const current = ++summaryRequestId.current;
    loadWorkflowSummary(createClient(), {
      from,
      to,
      actor: actor === ALL ? null : actor,
      owner: owner === ALL ? null : owner,
      pipeline: pipeline === ALL ? null : pipeline,
      organization,
      deal,
      contact,
      kinds,
      search,
    })
      .then((s) => {
        if (current === summaryRequestId.current) setSummary(s);
      })
      .catch((error) => {
        if (current === summaryRequestId.current)
          toast.error("Não foi possível carregar o resumo", { description: friendlyError(error) });
      });
  }, [from, to, actor, owner, pipeline, organization, deal, contact, kinds, search]);

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
    kinds.length > 0 ||
    pipeline !== ALL ||
    actor !== ALL ||
    owner !== ALL ||
    !!organization ||
    !!deal ||
    !!contact ||
    !!search;

  function clearFilters() {
    setKinds([]);
    setPipeline(ALL);
    setActor(ALL);
    setOwner(ALL);
    setOrganization(null);
    setDeal(null);
    setContact(null);
    setSearch("");
  }

  const toggleKind = (value: string) =>
    setKinds((prev) => (prev.includes(value) ? prev.filter((k) => k !== value) : [...prev, value]));

  const kindsTriggerLabel =
    kinds.length === 0
      ? "Todos os eventos"
      : kinds.length === 1
        ? kindLabel(kinds[0])
        : `${kinds.length} tipos selecionados`;

  const ownerItems = (summary?.owners ?? []).map((o) => ({
    key: o.key,
    label: o.key ? (userName.get(o.key) ?? "Usuário") : "Sem responsável",
    total: o.total,
  }));
  const pipelineItems = (summary?.pipelines ?? []).map((p) => ({
    key: p.key,
    label: p.key ? (pipelineName.get(p.key) ?? "Funil") : "Não ligado a um funil",
    total: p.total,
  }));

  async function onExport(kind: "excel" | "pdf" | "html") {
    setExporting(true);
    try {
      const { data, error } = await buildQuery(createClient(), false).range(0, EXPORT_LIMIT - 1);
      if (error) throw error;
      const all = (data ?? []) as unknown as WorkflowRow[];
      const columns = [
        "Data/hora",
        "Quem fez",
        "Tipo de evento",
        "O que aconteceu",
        "Funil",
        "Responsável",
        "Negócio",
        "Organização",
        "Pessoa",
      ];
      const tableRows = all.map((r) => {
        const ev = describeEvent(r);
        return [
          fullFmt.format(new Date(r.occurred_at)),
          r.actor_name,
          kindLabel(ev.kind),
          ev.text,
          (r.pipeline_id && pipelineName.get(r.pipeline_id)) || "",
          (r.owner_id && userName.get(r.owner_id)) || "",
          (r.deal_id && dealName.get(r.deal_id)) || "",
          (r.organization_id && orgName.get(r.organization_id)) || "",
          (r.contact_id && contactName.get(r.contact_id)) || "",
        ];
      });

      // Resumo para a diretoria: por tipo, por responsável e por funil
      const byKind = visibleKinds
        .map((k) => [k.label, summary?.kinds[k.value] ?? 0] as [string, number])
        .filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1]);
      const summarySections = [
        { title: "Resumo por tipo de evento", columns: ["Tipo de evento", "Eventos"], rows: byKind },
        { title: "Resumo por responsável", columns: ["Responsável", "Eventos"], rows: ownerItems.map((i) => [i.label, i.total]) },
        { title: "Resumo por funil", columns: ["Funil", "Eventos"], rows: pipelineItems.map((i) => [i.label, i.total]) },
      ].filter((s) => s.rows.length > 0);

      const filterNotes = [
        kinds.length > 0 ? `Tipos: ${kinds.map(kindLabel).join(", ")}` : null,
        pipeline !== ALL ? `Funil: ${pipelineName.get(pipeline) ?? ""}` : null,
        owner !== ALL ? `Responsável: ${userName.get(owner) ?? ""}` : null,
      ].filter(Boolean);
      const subtitle = `Período ${brDate(from)} a ${brDate(to)} · ${all.length} eventos${
        total > all.length ? ` (limitado aos ${EXPORT_LIMIT} mais recentes)` : ""
      }${filterNotes.length ? ` · ${filterNotes.join(" · ")}` : ""}`;
      const filename = `workflow-${from}-a-${to}`;
      const logoDataUrl = await loadImageAsDataUrl("/logo-mark.png").catch(() => undefined);
      const stringRows = (rs: (string | number)[][]) => rs.map((r) => r.map(String));

      if (kind === "excel") {
        await exportWorkbook(
          filename,
          [
            ...summarySections.map((s) => ({
              name: s.title.replace("Resumo por ", "Por ").slice(0, 31),
              columns: s.columns.map((h, i) => ({ header: h, key: `c${i}`, width: i === 0 ? 40 : 14 })),
              rows: s.rows.map((r) => Object.fromEntries(r.map((v, i) => [`c${i}`, v]))),
            })),
            {
              name: "Workflow",
              columns: columns.map((h, i) => ({ header: h, key: `c${i}`, width: i === 3 ? 70 : 24 })),
              rows: tableRows.map((r) => Object.fromEntries(r.map((v, i) => [`c${i}`, v]))),
            },
          ],
          { logoDataUrl, title: "Workflow — Grupo Mave CRM", subtitle },
        );
      } else if (kind === "pdf") {
        exportPdf(
          filename,
          "Workflow — Grupo Mave CRM",
          [
            ...summarySections.map((s) => ({ title: s.title, columns: s.columns, rows: stringRows(s.rows) })),
            { title: "Eventos", columns, rows: tableRows },
          ],
          { subtitle, logoDataUrl },
        );
      } else {
        exportHtml(
          filename,
          "Workflow — Grupo Mave CRM",
          [
            ...summarySections.map((s) => ({ title: s.title, columns: s.columns, rows: stringRows(s.rows) })),
            { title: "Eventos", columns, rows: tableRows },
          ],
          {
            subtitle,
            logoDataUrl,
            kpis: [
              { label: "Eventos no período", value: String(all.length) },
              ...HEADLINE_KINDS.map((k) => ({ label: kindLabel(k), value: String(summary?.kinds[k] ?? 0) })),
            ],
          },
        );
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
        <FormField label="Tipo de evento" htmlFor="wf-kinds">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button id="wf-kinds" variant="secondary" className="w-full justify-between font-normal">
                <span className="truncate">{kindsTriggerLabel}</span>
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-96 w-72 overflow-y-auto">
              <DropdownMenuItem disabled={kinds.length === 0} onSelect={() => setKinds([])}>
                Todos os eventos
              </DropdownMenuItem>
              {WORKFLOW_KIND_GROUPS.map((group) => {
                const items = visibleKinds.filter((k) => k.group === group);
                if (items.length === 0) return null;
                return (
                  <div key={group}>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">
                      {group}
                    </DropdownMenuLabel>
                    {items.map((k) => (
                      <DropdownMenuCheckboxItem
                        key={k.value}
                        checked={kinds.includes(k.value)}
                        onCheckedChange={() => toggleKind(k.value)}
                        onSelect={(e) => e.preventDefault()}
                      >
                        <span className="flex-1">{k.label}</span>
                        <span className="numeric text-caption text-muted-foreground">{summary?.kinds[k.value] ?? 0}</span>
                      </DropdownMenuCheckboxItem>
                    ))}
                  </div>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </FormField>
        <FormField label="Funil" htmlFor="wf-pipeline">
          <Select value={pipeline} onValueChange={setPipeline}>
            <SelectTrigger id="wf-pipeline">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os funis</SelectItem>
              {pipelines.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
        <FormField label="Buscar pelo nome do registro" htmlFor="wf-search" className="sm:col-span-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Negócio, arquivo, atividade..." />
        </FormField>
      </div>

      <section aria-label="Resumo do período" className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {HEADLINE_KINDS.map((value) => {
            const active = kinds.includes(value);
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => toggleKind(value)}
                className={cn(
                  "flex flex-col gap-1 rounded-lg border bg-card p-4 text-left shadow-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "border-primary bg-primary-subtle" : "border-border hover:border-primary/50",
                )}
              >
                <span className="text-caption font-medium text-muted-foreground">{kindLabel(value)}</span>
                <span className="numeric text-display text-foreground">
                  {summary ? (summary.kinds[value] ?? 0) : "—"}
                </span>
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <RankList
            title={kinds.length > 0 ? "Eventos por responsável (tipos selecionados)" : "Eventos por responsável"}
            items={ownerItems}
            selected={owner === ALL ? null : owner}
            onSelect={(key) => setOwner((prev) => (prev === key ? ALL : key))}
          />
          <RankList
            title={kinds.length > 0 ? "Eventos por funil (tipos selecionados)" : "Eventos por funil"}
            items={pipelineItems}
            selected={pipeline === ALL ? null : pipeline}
            onSelect={(key) => setPipeline((prev) => (prev === key ? ALL : key))}
          />
        </div>
      </section>

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
                  const pipelineLabel = r.pipeline_id ? pipelineName.get(r.pipeline_id) : null;
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
                          {pipelineLabel && <span>Funil: {pipelineLabel}</span>}
                          {r.owner_id && userName.get(r.owner_id) && (
                            <span>Responsável: {userName.get(r.owner_id)}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Badge variant={ev.tone}>{kindLabel(ev.kind)}</Badge>
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
