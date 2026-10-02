"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink, ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { DateInput } from "@/components/ui/masked-inputs";
import { SearchInput } from "@/components/list/list-toolbar";
import { Pagination } from "@/components/list/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PAGE_SIZES } from "@/lib/filters/params";
import { createClient } from "@/lib/supabase/client";
import { friendlyError, toast } from "@/lib/toast";
import { formatCurrencyBRL } from "@/lib/utils";

interface AuditRow {
  id: number;
  occurred_at: string;
  actor_id: string | null;
  actor_name: string;
  action: "insert" | "update" | "delete";
  table_name: string;
  record_id: string | null;
  record_label: string | null;
  changes: Record<string, unknown>;
}

const ACTION_LABEL: Record<AuditRow["action"], string> = {
  insert: "Inclusão",
  update: "Alteração",
  delete: "Exclusão",
};

const ACTION_VARIANT: Record<AuditRow["action"], "success" | "info" | "destructive"> = {
  insert: "success",
  update: "info",
  delete: "destructive",
};

const ENTITY_LABEL: Record<string, string> = {
  deals: "Negócio",
  contacts: "Pessoa",
  organizations: "Organização",
  leads: "Lead",
  activities: "Atividade",
  notes: "Anotação",
  proposals: "Proposta",
  attachments: "Arquivo",
  pipelines: "Funil",
  pipeline_stages: "Etapa do funil",
  lost_reasons: "Motivo da perda",
  custom_fields: "Campo customizado",
  automation_rules: "Automação",
  teams: "Equipe",
  profiles: "Usuário",
};

const FIELD_LABEL: Record<string, string> = {
  title: "Nome",
  name: "Nome",
  full_name: "Nome",
  value: "Valor",
  status: "Status",
  stage_id: "Etapa",
  pipeline_id: "Funil",
  owner_id: "Responsável",
  original_owner_id: "Responsável original",
  organization_id: "Organização",
  contact_id: "Pessoa de contato",
  deal_id: "Negócio",
  expected_close_date: "Previsão de fechamento",
  source: "Origem",
  frozen_at: "Congelado em",
  lost_reason_id: "Motivo da perda",
  currency: "Moeda",
  email: "E-mail",
  phone: "Telefone",
  whatsapp: "WhatsApp",
  job_title: "Cargo",
  contact_preference: "Preferência de contato",
  cnpj: "CNPJ",
  legal_name: "Razão social",
  address: "Endereço",
  sector: "Setor",
  company_size: "Porte",
  nature: "Natureza",
  city: "Cidade",
  state: "UF",
  website: "Site",
  linkedin_url: "LinkedIn",
  instagram_url: "Instagram",
  services_of_interest: "Serviços de interesse",
  notes: "Observações",
  type: "Tipo",
  subject: "Assunto",
  due_date: "Data",
  done: "Concluída",
  content: "Texto",
  mentioned_user_ids: "Menções",
  contact_info: "Contato",
  converted_deal_id: "Convertido no negócio",
  valid_until: "Válida até",
  requires_approval: "Exige aprovação",
  approved_by: "Aprovada por",
  approved_at: "Aprovada em",
  file_name: "Arquivo",
  category: "Categoria",
  expires_at: "Vence em",
  entity_type: "Entidade",
  is_default: "Funil padrão",
  order_index: "Ordem",
  rotting_days: "Dias para estagnar",
  is_active: "Ativo",
  role: "Papel",
  team_id: "Equipe",
  manager_id: "Gestor",
  must_change_password: "Trocar senha no login",
  label: "Rótulo",
  field_type: "Tipo de campo",
  required: "Obrigatório",
  trigger_event: "Gatilho",
  active: "Ativa",
  password: "Senha",
};

const VALUE_LABEL: Record<string, string> = {
  open: "Aberto",
  won: "Ganho",
  lost: "Perdido",
  task: "Tarefa",
  call: "Ligação",
  meeting: "Reunião",
  email: "E-mail",
  whatsapp: "WhatsApp",
  admin: "Administrador",
  gestor: "Gestor",
  vendedor: "Vendedor",
};

const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function formatValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (field === "value" && typeof value === "number") return formatCurrencyBRL(value);
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split("-");
      return `${d}/${m}/${y}`;
    }
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return dateTimeFormat.format(new Date(value));
    return VALUE_LABEL[value] ?? value;
  }
  return String(value);
}

function fieldLabel(field: string) {
  return FIELD_LABEL[field] ?? field.replace(/_/g, " ");
}

function recordHref(row: AuditRow): string | null {
  if (!row.record_id || row.action === "delete") return null;
  switch (row.table_name) {
    case "deals":
      return `/deals/${row.record_id}`;
    case "contacts":
      return `/contacts/people/${row.record_id}`;
    case "organizations":
      return `/contacts/organizations/${row.record_id}`;
    case "leads":
      return `/leads/${row.record_id}`;
    default:
      return null;
  }
}

function isChangePair(v: unknown): v is { old: unknown; new: unknown } {
  return typeof v === "object" && v !== null && "old" in v && "new" in v;
}

function ChangeDetails({ row }: { row: AuditRow }) {
  const entries = Object.entries(row.changes);
  if (entries.length === 0) {
    return <p className="text-caption text-muted-foreground">Sem detalhes registrados.</p>;
  }
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-[minmax(0,12rem)_1fr]">
      {entries.map(([field, change]) => (
        <Fragment key={field}>
          <dt className="text-muted-foreground">{fieldLabel(field)}</dt>
          <dd className="min-w-0 break-words text-foreground">
            {row.action === "update" && isChangePair(change) ? (
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="text-muted-foreground line-through">{formatValue(field, change.old)}</span>
                <span aria-hidden>→</span>
                <span className="font-medium">{formatValue(field, change.new)}</span>
              </span>
            ) : (
              formatValue(field, change)
            )}
          </dd>
        </Fragment>
      ))}
    </dl>
  );
}

function startOfDayISO(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
}

function endOfDayISO(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
}

export function AuditLogSettings({ users }: { users: { id: string; full_name: string }[] }) {
  const [actor, setActor] = useState("all");
  const [action, setAction] = useState("all");
  const [entity, setEntity] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const current = ++requestId.current;
    setLoading(true);
    let query = createClient()
      .from("audit_logs")
      .select("id, occurred_at, actor_id, actor_name, action, table_name, record_id, record_label, changes", {
        count: "exact",
      })
      .order("occurred_at", { ascending: false })
      .order("id", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);
    if (actor !== "all") query = query.eq("actor_id", actor);
    if (action !== "all") query = query.eq("action", action as AuditRow["action"]);
    if (entity !== "all") query = query.eq("table_name", entity);
    if (from) query = query.gte("occurred_at", startOfDayISO(from));
    if (to) query = query.lte("occurred_at", endOfDayISO(to));
    const term = search.trim().replace(/[%,()]/g, " ");
    if (term) query = query.ilike("record_label", `%${term}%`);

    const { data, count, error } = await query;
    if (current !== requestId.current) return; // resposta de uma consulta antiga
    setLoading(false);
    if (error) {
      toast.error("Não foi possível carregar os logs", { description: friendlyError(error) });
      return;
    }
    setRows((data ?? []) as unknown as AuditRow[]);
    setTotal(count ?? 0);
    setExpanded(new Set());
  }, [actor, action, entity, from, to, search, page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  function filter<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const hasFilters = actor !== "all" || action !== "all" || entity !== "all" || !!from || !!to || !!search;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Registro de quem incluiu, alterou ou excluiu informações no CRM. Visível apenas para administradores; os
        registros não podem ser editados nem apagados pelo sistema.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <FormField label="Usuário" htmlFor="audit-actor">
          <Select value={actor} onValueChange={filter(setActor)}>
            <SelectTrigger id="audit-actor">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {[...users]
                .sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"))
                .map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Ação" htmlFor="audit-action">
          <Select value={action} onValueChange={filter(setAction)}>
            <SelectTrigger id="audit-action">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {Object.entries(ACTION_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Registro" htmlFor="audit-entity">
          <Select value={entity} onValueChange={filter(setEntity)}>
            <SelectTrigger id="audit-entity">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(ENTITY_LABEL)
                .sort((a, b) => a[1].localeCompare(b[1], "pt-BR"))
                .map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="De" htmlFor="audit-from">
          <DateInput id="audit-from" value={from} onValueChange={filter(setFrom)} />
        </FormField>
        <FormField label="Até" htmlFor="audit-to">
          <DateInput id="audit-to" value={to} onValueChange={filter(setTo)} />
        </FormField>
        <FormField label="Buscar pelo nome" htmlFor="audit-search">
          <SearchInput
            value={search}
            onChange={filter(setSearch)}
            placeholder="Nome do registro..."
          />
        </FormField>
      </div>

      {hasFilters && (
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setActor("all");
              setAction("all");
              setEntity("all");
              setFrom("");
              setTo("");
              setSearch("");
              setPage(1);
            }}
          >
            Limpar filtros
          </Button>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <span className="sr-only">Detalhes</span>
            </TableHead>
            <TableHead>Data e hora</TableHead>
            <TableHead>Usuário</TableHead>
            <TableHead>Ação</TableHead>
            <TableHead>Registro</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading &&
            rows.length === 0 &&
            Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={`s-${i}`} className="hover:bg-transparent">
                <TableCell colSpan={5}>
                  <Skeleton className="h-5 w-full" />
                </TableCell>
              </TableRow>
            ))}
          {rows.map((row) => {
            const open = expanded.has(row.id);
            const href = recordHref(row);
            return (
              <Fragment key={row.id}>
                <TableRow className={loading ? "opacity-60" : undefined}>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-expanded={open}
                      aria-label={open ? "Ocultar detalhes" : "Ver detalhes"}
                      onClick={() => toggle(row.id)}
                    >
                      {open ? <ChevronDown /> : <ChevronRight />}
                    </Button>
                  </TableCell>
                  <TableCell className="numeric whitespace-nowrap text-muted-foreground">
                    {dateTimeFormat.format(new Date(row.occurred_at))}
                  </TableCell>
                  <TableCell className="font-medium">{row.actor_name}</TableCell>
                  <TableCell>
                    <Badge variant={ACTION_VARIANT[row.action]}>{ACTION_LABEL[row.action]}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className="flex min-w-0 flex-col">
                      <span className="text-caption text-muted-foreground">
                        {ENTITY_LABEL[row.table_name] ?? row.table_name}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="truncate">{row.record_label ?? "—"}</span>
                        {href && (
                          <Link
                            href={href}
                            aria-label="Abrir registro"
                            className="shrink-0 text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="size-3.5" />
                          </Link>
                        )}
                      </span>
                    </span>
                  </TableCell>
                </TableRow>
                {open && (
                  <TableRow className="bg-muted hover:bg-muted">
                    <TableCell />
                    <TableCell colSpan={4}>
                      <ChangeDetails row={row} />
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
          {!loading && rows.length === 0 && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={5}>
                <EmptyState
                  icon={ScrollText}
                  title={hasFilters ? "Nenhum log encontrado" : "Nenhum log registrado ainda"}
                  description={
                    hasFilters
                      ? "Ajuste ou limpe os filtros."
                      : "As próximas inclusões, alterações e exclusões aparecerão aqui."
                  }
                />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        noun="logs"
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />
    </div>
  );
}
