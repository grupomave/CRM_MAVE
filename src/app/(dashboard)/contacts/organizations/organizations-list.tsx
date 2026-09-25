"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Building2, ExternalLink, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { UserAvatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { WhatsAppButton } from "@/components/whatsapp-button";
import { useListParams } from "@/components/list/use-list-params";
import {
  FilterSelect,
  FilterToggle,
  ListToolbar,
  SearchInput,
} from "@/components/list/list-toolbar";
import { FilterChips, type FilterChip } from "@/components/list/filter-chips";
import { Pagination } from "@/components/list/pagination";
import { SortableHead } from "@/components/list/sortable-head";
import { BulkActionBar, useRowSelection } from "@/components/list/bulk-action-bar";
import { BulkOwnerButton } from "@/components/list/bulk-owner-dialog";
import {
  applyOrganizationFilters,
  parseOrganizationFilters,
  type OrganizationRow,
} from "@/lib/filters/organizations";
import { getPagination, paginate } from "@/lib/filters/params";
import { formatCurrencyBRL } from "@/lib/utils";
import type { OwnerOption } from "@/lib/data/lists";

const FILTER_KEYS = ["q", "owner", "uf", "sector", "open"];

function uniqueSorted(values: (string | null)[]) {
  return Array.from(new Set(values.filter(Boolean) as string[])).sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
}

export function OrganizationsList({
  organizations,
  owners,
  canReassign,
}: {
  organizations: OrganizationRow[];
  owners: OwnerOption[];
  canReassign: boolean;
}) {
  const { params, update, clear } = useListParams();
  const filters = useMemo(() => parseOrganizationFilters(params), [params]);
  const { page, pageSize } = getPagination(params);

  const filtered = useMemo(
    () => applyOrganizationFilters([...organizations], filters),
    [organizations, filters],
  );
  const current = paginate(filtered, page, pageSize);
  const filteredIds = useMemo(() => filtered.map((o) => o.id), [filtered]);
  const selection = useRowSelection(filteredIds);
  const pageIds = current.rows.map((o) => o.id);

  const states = useMemo(() => uniqueSorted(organizations.map((o) => o.state)), [organizations]);
  const sectors = useMemo(() => uniqueSorted(organizations.map((o) => o.sector)), [organizations]);
  const ownerName = (id: string) => owners.find((o) => o.id === id)?.full_name ?? "—";
  const onSort = (s: { key: string; dir: string }) => update({ sort: s.key, dir: s.dir });

  const chips: FilterChip[] = [];
  if (filters.q) chips.push({ key: "q", label: `Busca: “${filters.q}”`, onRemove: () => update({ q: null }) });
  if (filters.owner)
    chips.push({ key: "owner", label: `Responsável: ${ownerName(filters.owner)}`, onRemove: () => update({ owner: null }) });
  if (filters.state) chips.push({ key: "uf", label: `UF: ${filters.state}`, onRemove: () => update({ uf: null }) });
  if (filters.sector)
    chips.push({ key: "sector", label: `Setor: ${filters.sector}`, onRemove: () => update({ sector: null }) });
  if (filters.withOpenDeals)
    chips.push({ key: "open", label: "Com negócios abertos", onRemove: () => update({ open: null }) });

  return (
    <div className="flex flex-col gap-3">
      <ListToolbar
        search={
          <SearchInput
            value={filters.q}
            onChange={(q) => update({ q })}
            placeholder="Buscar por nome, CNPJ, cidade..."
          />
        }
        filters={
          <>
            {owners.length > 1 && (
              <FilterSelect
                label="Responsável"
                value={filters.owner}
                onChange={(owner) => update({ owner })}
                allLabel="Todos os responsáveis"
                options={owners.map((o) => ({ value: o.id, label: o.full_name }))}
              />
            )}
            {sectors.length > 0 && (
              <FilterSelect
                label="Setor"
                value={filters.sector}
                onChange={(sector) => update({ sector })}
                allLabel="Todos os setores"
                options={sectors.map((s) => ({ value: s, label: s }))}
              />
            )}
            {states.length > 0 && (
              <FilterSelect
                label="UF"
                value={filters.state}
                onChange={(uf) => update({ uf })}
                allLabel="Todas as UFs"
                className="sm:w-32"
                options={states.map((s) => ({ value: s, label: s }))}
              />
            )}
            <FilterToggle
              active={filters.withOpenDeals}
              onClick={() => update({ open: !filters.withOpenDeals })}
            >
              Com negócios abertos
            </FilterToggle>
          </>
        }
      />

      <FilterChips chips={chips} onClearAll={() => clear(FILTER_KEYS)} />

      <Table stickyHeader>
        <TableHeader>
          <TableRow>
            {canReassign && (
            <TableHead className="w-10">
              <Checkbox
                aria-label="Selecionar todos desta página"
                checked={selection.headerState(pageIds)}
                onCheckedChange={(checked) => selection.setMany(pageIds, checked === true)}
                disabled={pageIds.length === 0}
              />
            </TableHead>
            )}
            <SortableHead sortKey="name" sort={filters.sort} onSort={onSort}>
              Organização
            </SortableHead>
            <SortableHead sortKey="sector" sort={filters.sort} onSort={onSort}>
              Setor
            </SortableHead>
            <SortableHead sortKey="city" sort={filters.sort} onSort={onSort}>
              Cidade/UF
            </SortableHead>
            <TableHead>Telefone</TableHead>
            <SortableHead sortKey="owner" sort={filters.sort} onSort={onSort}>
              Responsável
            </SortableHead>
            <SortableHead sortKey="contacts" sort={filters.sort} onSort={onSort} align="right" defaultDir="desc">
              Contatos
            </SortableHead>
            <SortableHead sortKey="open_value" sort={filters.sort} onSort={onSort} align="right" defaultDir="desc">
              Em aberto
            </SortableHead>
            <SortableHead sortKey="won_value" sort={filters.sort} onSort={onSort} align="right" defaultDir="desc">
              Ganho
            </SortableHead>
            <TableHead className="w-12">
              <span className="sr-only">Ações</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {current.rows.map((o) => {
            const isSelected = selection.selected.has(o.id);
            return (
              <TableRow key={o.id} data-state={isSelected ? "selected" : undefined}>
                {canReassign && (
                <TableCell>
                  <Checkbox
                    aria-label={`Selecionar ${o.name}`}
                    checked={isSelected}
                    onCheckedChange={(checked) => selection.toggle(o.id, checked === true)}
                  />
                </TableCell>
                )}
                <TableCell>
                  <Link
                    href={`/contacts/organizations/${o.id}`}
                    className="group/link flex min-w-48 items-center gap-2.5"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-caption font-semibold text-muted-foreground">
                      {o.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium group-hover/link:text-primary group-hover/link:underline">
                        {o.name}
                      </span>
                      {o.cnpj && <span className="numeric text-caption text-muted-foreground">{o.cnpj}</span>}
                    </span>
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{o.sector ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {o.city ? `${o.city}${o.state ? `/${o.state}` : ""}` : (o.state ?? "—")}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="numeric">{o.phone ?? "—"}</span>
                    {o.phone && <WhatsAppButton phone={o.phone} />}
                  </span>
                </TableCell>
                <TableCell>
                  {o.owner_name ? (
                    <span className="flex items-center gap-2">
                      <UserAvatar name={o.owner_name} size="sm" showTooltip={false} />
                      <span className="truncate text-muted-foreground">{o.owner_name}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell numeric className="text-muted-foreground">
                  {o.contacts_count || "—"}
                </TableCell>
                <TableCell numeric>
                  {o.open_deals_count > 0 ? (
                    <span className="flex flex-col items-end">
                      <span>{formatCurrencyBRL(o.open_deals_value)}</span>
                      <span className="text-caption text-muted-foreground">
                        {o.open_deals_count} {o.open_deals_count === 1 ? "negócio" : "negócios"}
                      </span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell numeric className={o.won_deals_value > 0 ? "text-success-strong" : "text-muted-foreground"}>
                  {o.won_deals_value > 0 ? formatCurrencyBRL(o.won_deals_value) : "—"}
                </TableCell>
                <TableCell>
                  <TableRowActions>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-xs" aria-label={`Ações de ${o.name}`}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/contacts/organizations/${o.id}`}>
                            <ExternalLink />
                            Abrir organização
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableRowActions>
                </TableCell>
              </TableRow>
            );
          })}
          {current.rows.length === 0 && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={canReassign ? 10 : 9}>
                <EmptyState
                  icon={Building2}
                  title={
                    organizations.length === 0
                      ? "Nenhuma organização cadastrada"
                      : "Nenhuma organização encontrada"
                  }
                  description={
                    organizations.length === 0
                      ? "Cadastre empresas clientes e prospects para vincular pessoas e negócios."
                      : "Ajuste a busca ou os filtros para ver mais resultados."
                  }
                  action={
                    chips.length > 0 && (
                      <Button variant="secondary" size="sm" onClick={() => clear(FILTER_KEYS)}>
                        Limpar filtros
                      </Button>
                    )
                  }
                />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Pagination
        page={current.page}
        pageSize={pageSize}
        total={filtered.length}
        noun="organizações"
        onPageChange={(p) => update({ page: p })}
        onPageSizeChange={(size) => update({ size, page: null })}
      />

      <BulkActionBar
        count={selection.selected.size}
        totalFiltered={filtered.length}
        onSelectAllFiltered={() => selection.setMany(filteredIds, true)}
        onClear={selection.clear}
      >
        {canReassign && (
          <BulkOwnerButton
            table="organizations"
            ids={[...selection.selected]}
            owners={owners}
            onDone={selection.clear}
          />
        )}
      </BulkActionBar>
    </div>
  );
}
