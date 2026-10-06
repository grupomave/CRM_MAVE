"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, MoreHorizontal, Pencil, Plus, Trash2, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import { friendlyError, toast } from "@/lib/toast";

export interface CatalogRow {
  id: string;
  name: string;
  is_active: boolean;
  order_index: number;
}

interface Labels {
  /** Ex.: "Origem" / "Segmento" */
  singular: string;
  /** Ex.: "origens" / "segmentos" */
  plural: string;
  /** Artigo para as frases: "a" (origem) ou "o" (segmento) */
  article: "a" | "o";
  description: string;
  usageHeader: string;
  usageNoun: { one: string; other: string };
  emptyTitle: string;
}

/**
 * Lista cadastrável genérica (origens de lead, segmentos...). Mesmo padrão de
 * Motivos da perda: ativar/desativar, reordenar, renomear e excluir (só sem uso).
 * Admin e gestor editam; os demais só visualizam.
 */
export function CatalogSettings({
  table,
  rows,
  usage,
  canEdit,
  labels,
  icon,
}: {
  table: "lead_sources" | "segments";
  rows: CatalogRow[];
  usage: Record<string, number>;
  canEdit: boolean;
  labels: Labels;
  icon: LucideIcon;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ mode: "create" } | { mode: "edit"; row: CatalogRow } | null>(null);
  const Icon = icon;
  const sorted = [...rows].sort(
    (a, b) => a.order_index - b.order_index || a.name.localeCompare(b.name, "pt-BR"),
  );
  const the = labels.article === "a" ? "a" : "o";

  async function toggleActive(row: CatalogRow, next: boolean) {
    setBusyId(row.id);
    const { error } = await createClient().from(table).update({ is_active: next }).eq("id", row.id);
    setBusyId(null);
    if (error) {
      toast.error(`Não foi possível atualizar ${the} ${labels.singular.toLowerCase()}`, {
        description: friendlyError(error),
      });
      return;
    }
    toast.success(next ? "Ativado" : "Desativado", {
      description: next ? undefined : "Deixa de aparecer nas listas de escolha; os registros existentes são mantidos.",
    });
    router.refresh();
  }

  async function move(index: number, direction: -1 | 1) {
    const a = sorted[index];
    const b = sorted[index + direction];
    if (!a || !b) return;
    setBusyId(a.id);
    const reordered = [...sorted];
    reordered[index] = b;
    reordered[index + direction] = a;
    const supabase = createClient();
    const results = await Promise.all(
      reordered.map((r, i) => (r.order_index === i ? null : supabase.from(table).update({ order_index: i }).eq("id", r.id))),
    );
    setBusyId(null);
    const failed = results.find((res) => res?.error);
    if (failed?.error) toast.error("Não foi possível reordenar", { description: friendlyError(failed.error) });
    router.refresh();
  }

  async function remove(row: CatalogRow) {
    const used = usage[row.id] ?? 0;
    if (used > 0) {
      toast.warning(`${labels.singular} em uso`, {
        description: `${used} ${used === 1 ? labels.usageNoun.one : labels.usageNoun.other} usam “${row.name}”. Desative em vez de excluir.`,
      });
      return;
    }
    const ok = await confirmDialog({
      title: `Excluir “${row.name}”?`,
      description: "Essa ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      destructive: true,
    });
    if (!ok) return;
    setBusyId(row.id);
    const { error } = await createClient().from(table).delete().eq("id", row.id);
    setBusyId(null);
    if (error) {
      toast.error("Não foi possível excluir", { description: friendlyError(error) });
      return;
    }
    toast.success("Excluído");
    router.refresh();
  }

  return (
    <div className="flex max-w-detail flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{labels.description}</p>
        {canEdit && (
          <Button onClick={() => setDialog({ mode: "create" })}>
            <Plus />
            {labels.article === "a" ? "Nova" : "Novo"} {labels.singular.toLowerCase()}
          </Button>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{labels.singular}</TableHead>
            <TableHead className="text-right">{labels.usageHeader}</TableHead>
            <TableHead className="w-24">Ativo</TableHead>
            {canEdit && (
              <TableHead className="w-28">
                <span className="sr-only">Ações</span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((row, index) => (
            <TableRow key={row.id} className={row.is_active ? undefined : "opacity-60"}>
              <TableCell className="font-medium">
                <span className="flex items-center gap-2">
                  {row.name}
                  {!row.is_active && <Badge variant="neutral">Inativo</Badge>}
                </span>
              </TableCell>
              <TableCell className="numeric text-right text-muted-foreground">{usage[row.id] ?? 0}</TableCell>
              <TableCell>
                <Switch
                  checked={row.is_active}
                  disabled={!canEdit || busyId === row.id}
                  onCheckedChange={(next) => toggleActive(row, next)}
                  aria-label={`${row.is_active ? "Desativar" : "Ativar"} ${row.name}`}
                />
              </TableCell>
              {canEdit && (
                <TableCell>
                  <span className="flex items-center justify-end gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Mover ${row.name} para cima`}
                      disabled={index === 0 || busyId !== null}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Mover ${row.name} para baixo`}
                      disabled={index === sorted.length - 1 || busyId !== null}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Ações de ${row.name}`}
                          disabled={busyId === row.id}
                        >
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setTimeout(() => setDialog({ mode: "edit", row }), 0)}>
                          <Pencil />
                          Renomear
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => remove(row)}>
                          <Trash2 />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </span>
                </TableCell>
              )}
            </TableRow>
          ))}
          {sorted.length === 0 && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={canEdit ? 4 : 3}>
                <EmptyState icon={Icon} title={labels.emptyTitle} />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {dialog && (
        <CatalogDialog
          key={dialog.mode === "edit" ? dialog.row.id : "new"}
          table={table}
          labels={labels}
          row={dialog.mode === "edit" ? dialog.row : null}
          nextOrder={sorted.length}
          existingNames={rows.filter((r) => dialog.mode !== "edit" || r.id !== dialog.row.id).map((r) => r.name)}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function CatalogDialog({
  table,
  labels,
  row,
  nextOrder,
  existingNames,
  onClose,
  onSaved,
}: {
  table: "lead_sources" | "segments";
  labels: Labels;
  row: CatalogRow | null;
  nextOrder: number;
  existingNames: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(row?.name ?? "");
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const trimmed = name.trim();
  const duplicate = existingNames.some((n) => n.trim().toLowerCase() === trimmed.toLowerCase());
  const error = !touched
    ? undefined
    : !trimmed
      ? "Informe o nome"
      : duplicate
        ? "Já existe um item com esse nome"
        : undefined;

  async function onSubmit() {
    setTouched(true);
    if (!trimmed || duplicate) return;
    if (row && trimmed === row.name) {
      onClose();
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error: dbError } = row
      ? await supabase.from(table).update({ name: trimmed }).eq("id", row.id)
      : await supabase.from(table).insert({ name: trimmed, order_index: nextOrder });
    setSaving(false);
    if (dbError) {
      toast.error("Não foi possível salvar", { description: friendlyError(dbError) });
      return;
    }
    toast.success(row ? "Atualizado" : "Criado");
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>
            {row ? "Renomear" : labels.article === "a" ? "Nova" : "Novo"} {labels.singular.toLowerCase()}
          </DialogTitle>
          <DialogDescription>
            {row
              ? "Os registros que já usam este item passam a mostrar o novo nome."
              : `Aparece nas listas de escolha de ${labels.plural}.`}
          </DialogDescription>
        </DialogHeader>
        <FormField label="Nome" htmlFor="catalog-name" required error={error}>
          <Input
            id="catalog-name"
            value={name}
            maxLength={80}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void onSubmit()}
          />
        </FormField>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} loading={saving}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
