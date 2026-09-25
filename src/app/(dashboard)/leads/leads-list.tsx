"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Inbox, ListChecks, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { UserAvatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowActions,
} from "@/components/ui/table";
import { useListParams } from "@/components/list/use-list-params";
import { FilterSelect, ListToolbar, SearchInput } from "@/components/list/list-toolbar";
import { FilterChips, type FilterChip } from "@/components/list/filter-chips";
import { Pagination } from "@/components/list/pagination";
import { SortableHead } from "@/components/list/sortable-head";
import { BulkActionBar, useRowSelection } from "@/components/list/bulk-action-bar";
import { BulkOwnerButton } from "@/components/list/bulk-owner-dialog";
import {
  applyLeadFilters,
  LEAD_STATUS_BADGE,
  LEAD_STATUS_LABEL,
  parseLeadFilters,
  type LeadRow,
} from "@/lib/filters/leads";
import { getPagination, paginate } from "@/lib/filters/params";
import { createClient } from "@/lib/supabase/client";
import { friendlyError, toast } from "@/lib/toast";
import { formatDate } from "@/lib/utils";
import type { LeadStatus } from "@/lib/supabase/types";
import type { OwnerOption } from "@/lib/data/lists";

const EDITABLE_STATUSES: LeadStatus[] = ["new", "contacted", "qualified", "disqualified"];

export function LeadsList({
  leads,
  owners,
  canReassign,
}: {
  leads: LeadRow[];
  owners: OwnerOption[];
  canReassign: boolean;
}) {
  const router = useRouter();
  const { params, update, clear } = useListParams();
  const filters = useMemo(() => parseLeadFilters(params), [params]);
  const { page, pageSize } = getPagination(params);

  const filtered = useMemo(() => applyLeadFilters([...leads], filters), [leads, filters]);
  const current = paginate(filtered, page, pageSize);
  const filteredIds = useMemo(() => filtered.map((l) => l.id), [filtered]);
  const selection = useRowSelection(filteredIds);
  const pageIds = current.rows.map((l) => l.id);

  const sources = useMemo(
    () =>
      Array.from(new Set(leads.map((l) => l.source).filter(Boolean) as string[])).sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      ),
    [leads],
  );
  const ownerName = (id: string) => owners.find((o) => o.id === id)?.full_name ?? "—";

  const chips: FilterChip[] = [];
  if (filters.q) chips.push({ key: "q", label: `Busca: “${filters.q}”`, onRemove: () => update({ q: null }) });
  if (filters.status !== "all")
    chips.push({ key: "status", label: `Status: ${LEAD_STATUS_LABEL[filters.status]}`, onRemove: () => update({ status: null }) });
  if (filters.source)
    chips.push({ key: "source", label: `Origem: ${filters.source}`, onRemove: () => update({ source: null }) });
  if (filters.owner)
    chips.push({ key: "owner", label: `Responsável: ${ownerName(filters.owner)}`, onRemove: () => update({ owner: null }) });

  async function setStatus(requested: string[], status: LeadStatus) {
    // Lead convertido já virou negócio: voltar o status permitiria
    // convertê-lo de novo e duplicar o negócio.
    const convertedIds = new Set(leads.filter((l) => l.status === "converted").map((l) => l.id));
    const ids = requested.filter((id) => !convertedIds.has(id));
    const skipped = requested.length - ids.length;
    if (ids.length === 0) {
      toast.warning("Leads convertidos não podem mudar de status");
      return;
    }
    const supabase = createClient();
    const { data, error } = await supabase.from("leads").update({ status }).in("id", ids).select("id");
    if (error) {
      toast.error("Não foi possível alterar o status", { description: friendlyError(error) });
      return;
    }
    toast.success(
      `${data?.length ?? 0} ${data?.length === 1 ? "lead marcado" : "leads marcados"} como ${LEAD_STATUS_LABEL[status].toLowerCase()}`,
      skipped > 0
        ? { description: `${skipped} ${skipped === 1 ? "lead convertido foi ignorado" : "leads convertidos foram ignorados"}.` }
        : undefined,
    );
    selection.clear();
    router.refresh();
  }

  const hasFilters = chips.length > 0;

  return (
    <div className="flex flex-col gap-3">
      <ListToolbar
        search={
          <SearchInput
            value={filters.q}
            onChange={(q) => update({ q })}
            placeholder="Buscar por nome, contato ou origem"
          />
        }
        filters={
          <>
            <FilterSelect
              label="Status"
              value={filters.status === "all" ? "" : filters.status}
              onChange={(status) => update({ status })}
              allLabel="Todos os status"
              options={Object.entries(LEAD_STATUS_LABEL).map(([value, label]) => ({ value, label }))}
            />
            {sources.length > 0 && (
              <FilterSelect
                label="Origem"
                value={filters.source}
                onChange={(source) => update({ source })}
                allLabel="Todas as origens"
                options={sources.map((s) => ({ value: s, label: s }))}
              />
            )}
            {owners.length > 1 && (
              <FilterSelect
                label="Responsável"
                value={filters.owner}
                onChange={(owner) => update({ owner })}
                allLabel="Todos os responsáveis"
                options={owners.map((o) => ({ value: o.id, label: o.full_name }))}
              />
            )}
          </>
        }
      />

      <FilterChips chips={chips} onClearAll={() => clear(["q", "status", "source", "owner"])} />

      <Table stickyHeader>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                aria-label="Selecionar todos desta página"
                checked={selection.headerState(pageIds)}
                onCheckedChange={(checked) => selection.setMany(pageIds, checked === true)}
                disabled={pageIds.length === 0}
              />
            </TableHead>
            <SortableHead sortKey="name" sort={filters.sort} onSort={(s) => update({ sort: s.key, dir: s.dir })}>
              Nome
            </SortableHead>
            <TableHead>Contato</TableHead>
            <SortableHead sortKey="source" sort={filters.sort} onSort={(s) => update({ sort: s.key, dir: s.dir })}>
              Origem
            </SortableHead>
            <SortableHead sortKey="status" sort={filters.sort} onSort={(s) => update({ sort: s.key, dir: s.dir })}>
              Status
            </SortableHead>
            <SortableHead sortKey="owner" sort={filters.sort} onSort={(s) => update({ sort: s.key, dir: s.dir })}>
              Responsável
            </SortableHead>
            <SortableHead
              sortKey="created_at"
              sort={filters.sort}
              defaultDir="desc"
              onSort={(s) => update({ sort: s.key, dir: s.dir })}
            >
              Criado em
            </SortableHead>
            <TableHead className="w-12">
              <span className="sr-only">Ações</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {current.rows.map((lead) => {
            const isSelected = selection.selected.has(lead.id);
            return (
              <TableRow key={lead.id} data-state={isSelected ? "selected" : undefined}>
                <TableCell>
                  <Checkbox
                    aria-label={`Selecionar ${lead.name}`}
                    checked={isSelected}
                    onCheckedChange={(checked) => selection.toggle(lead.id, checked === true)}
                  />
                </TableCell>
                <TableCell className="font-medium">
                  <Link href={`/leads/${lead.id}`} className="hover:text-primary hover:underline">
                    {lead.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{lead.contact_info ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{lead.source ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={LEAD_STATUS_BADGE[lead.status]}>{LEAD_STATUS_LABEL[lead.status]}</Badge>
                </TableCell>
                <TableCell>
                  {lead.owner_name ? (
                    <span className="flex items-center gap-2">
                      <UserAvatar name={lead.owner_name} size="sm" showTooltip={false} />
                      <span className="truncate text-muted-foreground">{lead.owner_name}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="numeric text-muted-foreground">{formatDate(lead.created_at)}</TableCell>
                <TableCell>
                  <TableRowActions>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-xs" aria-label={`Ações de ${lead.name}`}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/leads/${lead.id}`}>
                            <ExternalLink />
                            Abrir lead
                          </Link>
                        </DropdownMenuItem>
                        {lead.status !== "converted" && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel>Marcar como</DropdownMenuLabel>
                            {EDITABLE_STATUSES.filter((s) => s !== lead.status).map((s) => (
                              <DropdownMenuItem key={s} onSelect={() => setStatus([lead.id], s)}>
                                {LEAD_STATUS_LABEL[s]}
                              </DropdownMenuItem>
                            ))}
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableRowActions>
                </TableCell>
              </TableRow>
            );
          })}
          {current.rows.length === 0 && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={8}>
                {leads.length === 0 ? (
                  <EmptyState
                    icon={Inbox}
                    title="Nenhum lead na caixa de entrada"
                    description="Leads recebidos pelo site, indicações ou eventos aparecem aqui para qualificação."
                  />
                ) : (
                  <EmptyState
                    icon={Inbox}
                    title="Nenhum lead encontrado"
                    description="Ajuste a busca ou os filtros para ver mais resultados."
                    action={
                      hasFilters && (
                        <Button variant="secondary" size="sm" onClick={() => clear(["q", "status", "source", "owner"])}>
                          Limpar filtros
                        </Button>
                      )
                    }
                  />
                )}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Pagination
        page={current.page}
        pageSize={pageSize}
        total={filtered.length}
        noun="leads"
        onPageChange={(p) => update({ page: p })}
        onPageSizeChange={(size) => update({ size, page: null })}
      />

      <BulkActionBar
        count={selection.selected.size}
        totalFiltered={filtered.length}
        onSelectAllFiltered={() => selection.setMany(filteredIds, true)}
        onClear={selection.clear}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm">
              <ListChecks />
              Alterar status
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {EDITABLE_STATUSES.map((s) => (
              <DropdownMenuItem key={s} onSelect={() => setStatus([...selection.selected], s)}>
                {LEAD_STATUS_LABEL[s]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {canReassign && (
          <BulkOwnerButton
            table="leads"
            ids={[...selection.selected]}
            owners={owners}
            onDone={selection.clear}
          />
        )}
      </BulkActionBar>
    </div>
  );
}
