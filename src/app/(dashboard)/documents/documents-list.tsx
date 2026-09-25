"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarClock, Download, FileArchive, FileText } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { BulkActionBar, useRowSelection } from "@/components/list/bulk-action-bar";
import { ZipProgressDialog } from "@/components/zip-progress-dialog";
import { downloadAttachment, formatBytes, useZipDownload, zipFileName } from "@/lib/attachments-download";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  FilterSelect,
  FilterToggle,
  ListToolbar,
  SearchInput,
} from "@/components/list/list-toolbar";
import { matchesSearch } from "@/lib/filters/params";
import { formatDate } from "@/lib/utils";
import { DOCUMENT_CATEGORIES } from "@/components/entity-files-tab";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface DocumentRow {
  id: string;
  file_name: string;
  storage_path: string;
  size_bytes: number;
  created_at: string;
  category: string | null;
  expires_at: string | null;
  entity_type: string;
  entity_name: string;
  entity_href: string;
}

const ENTITY_LABEL: Record<string, string> = {
  deal: "Negócio",
  contact: "Contato",
  organization: "Organização",
};

export function DocumentsList({ documents }: { documents: DocumentRow[] }) {
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("");
  const [category, setCategory] = useState("");
  const [onlyExpiring, setOnlyExpiring] = useState(false);
  const zip = useZipDownload();
  const selection = useRowSelection(documents.map((d) => d.id));

  const now = new Date();
  const filtered = documents.filter((d) => {
    if (!matchesSearch(search, d.file_name, d.entity_name)) return false;
    if (entityType && d.entity_type !== entityType) return false;
    if (category && d.category !== category) return false;
    if (onlyExpiring) {
      if (!d.expires_at) return false;
      const daysLeft = (new Date(d.expires_at).getTime() - now.getTime()) / 86400000;
      if (daysLeft > 30) return false;
    }
    return true;
  });

  const filteredIds = filtered.map((d) => d.id);
  const selectedDocs = documents.filter((d) => selection.selected.has(d.id));

  return (
    <div className="flex flex-col gap-4">
      <ListToolbar
        search={
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar por arquivo ou registro..."
          />
        }
        filters={
          <>
            <FilterSelect
              label="Tipo de registro"
              value={entityType}
              onChange={setEntityType}
              allLabel="Todos os tipos"
              options={[
                { value: "deal", label: "Negócios" },
                { value: "contact", label: "Contatos" },
                { value: "organization", label: "Organizações" },
              ]}
            />
            <FilterSelect
              label="Categoria"
              value={category}
              onChange={setCategory}
              allLabel="Todas as categorias"
              options={DOCUMENT_CATEGORIES.map((c) => ({ value: c, label: c }))}
            />
            <FilterToggle active={onlyExpiring} onClick={() => setOnlyExpiring((v) => !v)}>
              <CalendarClock />
              Vencendo em 30 dias
            </FilterToggle>
          </>
        }
      />

      <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  aria-label="Selecionar todos os documentos filtrados"
                  checked={selection.headerState(filteredIds)}
                  onCheckedChange={(checked) => selection.setMany(filteredIds, checked === true)}
                  disabled={filteredIds.length === 0}
                />
              </TableHead>
              <TableHead>Arquivo</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Vinculado a</TableHead>
              <TableHead>Validade</TableHead>
              <TableHead>Enviado em</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((d) => {
              const expired = d.expires_at && new Date(d.expires_at) < now;
              const expiringSoon =
                d.expires_at &&
                !expired &&
                new Date(d.expires_at).getTime() - now.getTime() < 30 * 86400000;
              const isSelected = selection.selected.has(d.id);
              return (
                <TableRow key={d.id} data-state={isSelected ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox
                      aria-label={`Selecionar ${d.file_name}`}
                      checked={isSelected}
                      onCheckedChange={(checked) => selection.toggle(d.id, checked === true)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{d.file_name}</TableCell>
                  <TableCell className="text-muted-foreground">{d.category ?? "—"}</TableCell>
                  <TableCell>
                    <Link href={d.entity_href} className="text-primary hover:underline">
                      {ENTITY_LABEL[d.entity_type] ?? d.entity_type}: {d.entity_name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {d.expires_at ? (
                      <Badge variant={expired ? "destructive" : expiringSoon ? "warning" : "neutral"}>
                        {formatDate(`${d.expires_at}T12:00:00`)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="numeric text-muted-foreground">
                    {formatDate(d.created_at)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Baixar ${d.file_name}`}
                      onClick={() => downloadAttachment(d)}
                    >
                      <Download />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  <EmptyState
                    icon={FileText}
                    title={documents.length === 0 ? "Nenhum documento anexado ainda" : "Nenhum documento encontrado"}
                    description={
                      documents.length === 0
                        ? "Arquivos anexados em negócios, pessoas e organizações aparecem aqui."
                        : "Ajuste a busca ou os filtros para ver mais resultados."
                    }
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

      <BulkActionBar
        count={selectedDocs.length}
        totalFiltered={filtered.length}
        onSelectAllFiltered={() => selection.setMany(filteredIds, true)}
        onClear={selection.clear}
      >
        <span className="numeric text-caption text-muted-foreground">
          {formatBytes(selectedDocs.reduce((sum, d) => sum + d.size_bytes, 0))}
        </span>
        <Button size="sm" disabled={zip.busy} onClick={() => zip.start(selectedDocs, zipFileName("documentos"))}>
          <FileArchive />
          Baixar selecionados (.zip)
        </Button>
      </BulkActionBar>

      <ZipProgressDialog progress={zip.progress} onCancel={zip.cancel} />
    </div>
  );
}
