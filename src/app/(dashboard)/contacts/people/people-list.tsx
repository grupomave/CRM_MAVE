"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ExternalLink, Mail, MoreHorizontal, Users } from "lucide-react";
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
import { FilterSelect, ListToolbar, SearchInput } from "@/components/list/list-toolbar";
import { FilterChips, type FilterChip } from "@/components/list/filter-chips";
import { Pagination } from "@/components/list/pagination";
import { SortableHead } from "@/components/list/sortable-head";
import { BulkActionBar, useRowSelection } from "@/components/list/bulk-action-bar";
import { BulkOwnerButton } from "@/components/list/bulk-owner-dialog";
import { applyPersonFilters, parsePersonFilters, type PersonRow } from "@/lib/filters/people";
import { getPagination, paginate } from "@/lib/filters/params";
import type { OwnerOption } from "@/lib/data/lists";

const FILTER_KEYS = ["q", "owner", "org"];
const ORG_FILTER_LABEL = { with: "Com organização", without: "Sem organização" } as const;

export function PeopleList({
  contacts,
  owners,
  canReassign,
}: {
  contacts: PersonRow[];
  owners: OwnerOption[];
  canReassign: boolean;
}) {
  const { params, update, clear } = useListParams();
  const filters = useMemo(() => parsePersonFilters(params), [params]);
  const { page, pageSize } = getPagination(params);

  const filtered = useMemo(() => applyPersonFilters([...contacts], filters), [contacts, filters]);
  const current = paginate(filtered, page, pageSize);
  const filteredIds = useMemo(() => filtered.map((c) => c.id), [filtered]);
  const selection = useRowSelection(filteredIds);
  const pageIds = current.rows.map((c) => c.id);

  const ownerName = (id: string) => owners.find((o) => o.id === id)?.full_name ?? "—";
  const onSort = (s: { key: string; dir: string }) => update({ sort: s.key, dir: s.dir });

  const chips: FilterChip[] = [];
  if (filters.q) chips.push({ key: "q", label: `Busca: “${filters.q}”`, onRemove: () => update({ q: null }) });
  if (filters.owner)
    chips.push({ key: "owner", label: `Responsável: ${ownerName(filters.owner)}`, onRemove: () => update({ owner: null }) });
  if (filters.org !== "all")
    chips.push({ key: "org", label: ORG_FILTER_LABEL[filters.org], onRemove: () => update({ org: null }) });

  return (
    <div className="flex flex-col gap-3">
      <ListToolbar
        search={
          <SearchInput
            value={filters.q}
            onChange={(q) => update({ q })}
            placeholder="Buscar por nome, e-mail, telefone..."
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
            <FilterSelect
              label="Organização"
              value={filters.org === "all" ? "" : filters.org}
              onChange={(org) => update({ org })}
              allLabel="Com e sem organização"
              options={[
                { value: "with", label: ORG_FILTER_LABEL.with },
                { value: "without", label: ORG_FILTER_LABEL.without },
              ]}
            />
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
              Nome
            </SortableHead>
            <SortableHead sortKey="email" sort={filters.sort} onSort={onSort}>
              E-mail
            </SortableHead>
            <TableHead>Telefone</TableHead>
            <SortableHead sortKey="organization" sort={filters.sort} onSort={onSort}>
              Organização
            </SortableHead>
            <SortableHead sortKey="owner" sort={filters.sort} onSort={onSort}>
              Responsável
            </SortableHead>
            <TableHead className="w-12">
              <span className="sr-only">Ações</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {current.rows.map((c) => {
            const isSelected = selection.selected.has(c.id);
            return (
              <TableRow key={c.id} data-state={isSelected ? "selected" : undefined}>
                {canReassign && (
                <TableCell>
                  <Checkbox
                    aria-label={`Selecionar ${c.name}`}
                    checked={isSelected}
                    onCheckedChange={(checked) => selection.toggle(c.id, checked === true)}
                  />
                </TableCell>
                )}
                <TableCell>
                  <Link href={`/contacts/people/${c.id}`} className="group/link flex min-w-40 flex-col">
                    <span className="font-medium group-hover/link:text-primary group-hover/link:underline">
                      {c.name}
                    </span>
                    {c.job_title && <span className="text-caption text-muted-foreground">{c.job_title}</span>}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {c.email ? (
                    <a href={`mailto:${c.email}`} className="hover:text-primary hover:underline">
                      {c.email}
                    </a>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="numeric">{c.phone ?? c.whatsapp ?? "—"}</span>
                    <WhatsAppButton phone={c.whatsapp ?? c.phone} contactId={c.id} />
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {c.organization_id ? (
                    <Link
                      href={`/contacts/organizations/${c.organization_id}`}
                      className="hover:text-primary hover:underline"
                    >
                      {c.organization_name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  {c.owner_name ? (
                    <span className="flex items-center gap-2">
                      <UserAvatar name={c.owner_name} size="sm" showTooltip={false} />
                      <span className="truncate text-muted-foreground">{c.owner_name}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <TableRowActions>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-xs" aria-label={`Ações de ${c.name}`}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/contacts/people/${c.id}`}>
                            <ExternalLink />
                            Abrir pessoa
                          </Link>
                        </DropdownMenuItem>
                        {c.email && (
                          <DropdownMenuItem asChild>
                            <a href={`mailto:${c.email}`}>
                              <Mail />
                              Enviar e-mail
                            </a>
                          </DropdownMenuItem>
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
              <TableCell colSpan={canReassign ? 7 : 6}>
                <EmptyState
                  icon={Users}
                  title={contacts.length === 0 ? "Nenhuma pessoa cadastrada" : "Nenhuma pessoa encontrada"}
                  description={
                    contacts.length === 0
                      ? "Cadastre os contatos das organizações para registrar negócios e atividades."
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
        noun="pessoas"
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
            table="contacts"
            ids={[...selection.selected]}
            owners={owners}
            onDone={selection.clear}
          />
        )}
      </BulkActionBar>
    </div>
  );
}
