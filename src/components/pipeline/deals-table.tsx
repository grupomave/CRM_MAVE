"use client";

import Link from "next/link";
import { ExternalLink, KanbanSquare, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { SortableHead } from "@/components/list/sortable-head";
import { Pagination } from "@/components/list/pagination";
import { DEAL_STATUS_BADGE, DEAL_STATUS_LABEL, type DealFilters } from "@/lib/filters/deals";
import { paginate } from "@/lib/filters/params";
import { formatCurrencyBRL, formatDate } from "@/lib/utils";
import type { useRowSelection } from "@/components/list/bulk-action-bar";
import type { PipelineDeal, PipelineStage } from "./types";

type Selection = ReturnType<typeof useRowSelection>;

export function DealsTable({
  deals,
  stages,
  filters,
  page,
  pageSize,
  selection,
  update,
  emptyAction,
}: {
  deals: PipelineDeal[];
  stages: PipelineStage[];
  filters: DealFilters;
  page: number;
  pageSize: number;
  selection: Selection;
  update: (updates: Record<string, string | number | boolean | null>) => void;
  emptyAction?: React.ReactNode;
}) {
  const current = paginate(deals, page, pageSize);
  const pageIds = current.rows.map((d) => d.id);
  const stageName = new Map(stages.map((s) => [s.id, s.name]));
  const onSort = (s: { key: string; dir: string }) => update({ sort: s.key, dir: s.dir });
  const total = deals.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="flex flex-col gap-3">
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
            <SortableHead sortKey="title" sort={filters.sort} onSort={onSort}>
              Negócio
            </SortableHead>
            <SortableHead sortKey="organization" sort={filters.sort} onSort={onSort}>
              Organização
            </SortableHead>
            <SortableHead sortKey="stage" sort={filters.sort} onSort={onSort}>
              Etapa
            </SortableHead>
            <SortableHead sortKey="status" sort={filters.sort} onSort={onSort}>
              Status
            </SortableHead>
            <SortableHead sortKey="value" sort={filters.sort} onSort={onSort} align="right" defaultDir="desc">
              Valor
            </SortableHead>
            <SortableHead sortKey="expected_close" sort={filters.sort} onSort={onSort}>
              Previsão
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
          {current.rows.map((d) => {
            const isSelected = selection.selected.has(d.id);
            return (
              <TableRow key={d.id} data-state={isSelected ? "selected" : undefined}>
                <TableCell>
                  <Checkbox
                    aria-label={`Selecionar ${d.title}`}
                    checked={isSelected}
                    onCheckedChange={(checked) => selection.toggle(d.id, checked === true)}
                  />
                </TableCell>
                <TableCell className="min-w-48 font-medium">
                  <Link href={`/deals/${d.id}`} className="hover:text-primary hover:underline">
                    {d.title}
                  </Link>
                  {d.contact_name && (
                    <span className="block text-caption font-normal text-muted-foreground">{d.contact_name}</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{d.organization_name ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {stageName.get(d.stage_id) ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={DEAL_STATUS_BADGE[d.status]}>{DEAL_STATUS_LABEL[d.status]}</Badge>
                </TableCell>
                <TableCell numeric className="font-medium">
                  {formatCurrencyBRL(d.value)}
                </TableCell>
                <TableCell className="numeric whitespace-nowrap text-muted-foreground">
                  {d.expected_close_date ? formatDate(`${d.expected_close_date}T12:00:00`) : "—"}
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-2">
                    <UserAvatar name={d.owner_name} size="sm" showTooltip={false} />
                    <span className="truncate text-muted-foreground">{d.owner_name}</span>
                  </span>
                </TableCell>
                <TableCell>
                  <TableRowActions>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-xs" aria-label={`Ações de ${d.title}`}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/deals/${d.id}`}>
                            <ExternalLink />
                            Abrir negócio
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
              <TableCell colSpan={9}>
                <EmptyState
                  icon={KanbanSquare}
                  title="Nenhum negócio encontrado"
                  description="Ajuste a busca ou os filtros, ou crie um novo negócio neste funil."
                  action={emptyAction}
                />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Pagination
        page={current.page}
        pageSize={pageSize}
        total={deals.length}
        noun={`negócios · ${formatCurrencyBRL(total)}`}
        onPageChange={(p) => update({ page: p })}
        onPageSizeChange={(size) => update({ size, page: null })}
      />
    </div>
  );
}
