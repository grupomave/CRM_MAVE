"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, MoreHorizontal, Pencil, Plus, ThumbsDown, Trash2 } from "lucide-react";
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

export interface SettingsLostReason {
  id: string;
  name: string;
  is_active: boolean;
  order_index: number;
}

/** Quantidade de negócios perdidos por motivo (id do motivo -> total) */
export type LostReasonUsage = Record<string, number>;

export function LostReasonsSettings({
  reasons,
  usage,
  isAdmin,
}: {
  reasons: SettingsLostReason[];
  usage: LostReasonUsage;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ mode: "create" } | { mode: "edit"; reason: SettingsLostReason } | null>(null);

  const sorted = [...reasons].sort(
    (a, b) => a.order_index - b.order_index || a.name.localeCompare(b.name, "pt-BR"),
  );

  async function toggleActive(reason: SettingsLostReason, next: boolean) {
    setBusyId(reason.id);
    const { error } = await createClient().from("lost_reasons").update({ is_active: next }).eq("id", reason.id);
    setBusyId(null);
    if (error) {
      toast.error("Não foi possível atualizar o motivo", { description: friendlyError(error) });
      return;
    }
    toast.success(next ? "Motivo ativado" : "Motivo desativado", {
      description: next ? undefined : "Ele deixa de aparecer ao marcar negócios como perdidos.",
    });
    router.refresh();
  }

  async function move(index: number, direction: -1 | 1) {
    const a = sorted[index];
    const b = sorted[index + direction];
    if (!a || !b) return;
    setBusyId(a.id);
    // Renumera a lista inteira para evitar empates em order_index
    const reordered = [...sorted];
    reordered[index] = b;
    reordered[index + direction] = a;
    const supabase = createClient();
    const results = await Promise.all(
      reordered.map((r, i) =>
        r.order_index === i ? null : supabase.from("lost_reasons").update({ order_index: i }).eq("id", r.id),
      ),
    );
    setBusyId(null);
    const failed = results.find((res) => res?.error);
    if (failed?.error) {
      toast.error("Não foi possível reordenar", { description: friendlyError(failed.error) });
    }
    router.refresh();
  }

  async function remove(reason: SettingsLostReason) {
    const used = usage[reason.id] ?? 0;
    if (used > 0) {
      toast.warning("Este motivo está em uso", {
        description: `${used} ${used === 1 ? "negócio perdido usa" : "negócios perdidos usam"} “${reason.name}”. Desative-o em vez de excluir.`,
      });
      return;
    }
    const ok = await confirmDialog({
      title: `Excluir o motivo “${reason.name}”?`,
      description: "Essa ação não pode ser desfeita.",
      confirmLabel: "Excluir motivo",
      destructive: true,
    });
    if (!ok) return;
    setBusyId(reason.id);
    const { error } = await createClient().from("lost_reasons").delete().eq("id", reason.id);
    setBusyId(null);
    if (error) {
      toast.error("Não foi possível excluir o motivo", { description: friendlyError(error) });
      return;
    }
    toast.success("Motivo excluído");
    router.refresh();
  }

  return (
    <div className="flex max-w-detail flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Opções exibidas ao marcar um negócio como perdido e usadas nos relatórios de perdas.
        </p>
        {isAdmin && (
          <Button onClick={() => setDialog({ mode: "create" })}>
            <Plus />
            Novo motivo
          </Button>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Motivo</TableHead>
            <TableHead className="text-right">Negócios perdidos</TableHead>
            <TableHead className="w-24">Ativo</TableHead>
            {isAdmin && (
              <TableHead className="w-28">
                <span className="sr-only">Ações</span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((reason, index) => (
            <TableRow key={reason.id} className={reason.is_active ? undefined : "opacity-60"}>
              <TableCell className="font-medium">
                <span className="flex items-center gap-2">
                  {reason.name}
                  {!reason.is_active && <Badge variant="neutral">Inativo</Badge>}
                </span>
              </TableCell>
              <TableCell className="numeric text-right text-muted-foreground">{usage[reason.id] ?? 0}</TableCell>
              <TableCell>
                <Switch
                  checked={reason.is_active}
                  disabled={!isAdmin || busyId === reason.id}
                  onCheckedChange={(next) => toggleActive(reason, next)}
                  aria-label={`${reason.is_active ? "Desativar" : "Ativar"} ${reason.name}`}
                />
              </TableCell>
              {isAdmin && (
                <TableCell>
                  <span className="flex items-center justify-end gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Mover ${reason.name} para cima`}
                      disabled={index === 0 || busyId !== null}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Mover ${reason.name} para baixo`}
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
                          aria-label={`Ações de ${reason.name}`}
                          disabled={busyId === reason.id}
                        >
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setTimeout(() => setDialog({ mode: "edit", reason }), 0)}>
                          <Pencil />
                          Renomear
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => remove(reason)}>
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
              <TableCell colSpan={isAdmin ? 4 : 3}>
                <EmptyState
                  icon={ThumbsDown}
                  title="Nenhum motivo cadastrado"
                  description="Cadastre ao menos um motivo para poder marcar negócios como perdidos."
                />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {dialog && (
        <ReasonDialog
          key={dialog.mode === "edit" ? dialog.reason.id : "new"}
          reason={dialog.mode === "edit" ? dialog.reason : null}
          nextOrder={sorted.length}
          existingNames={reasons.filter((r) => dialog.mode !== "edit" || r.id !== dialog.reason.id).map((r) => r.name)}
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

function ReasonDialog({
  reason,
  nextOrder,
  existingNames,
  onClose,
  onSaved,
}: {
  reason: SettingsLostReason | null;
  nextOrder: number;
  existingNames: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(reason?.name ?? "");
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const trimmed = name.trim();
  const duplicate = existingNames.some((n) => n.trim().toLowerCase() === trimmed.toLowerCase());
  const error = !touched
    ? undefined
    : !trimmed
      ? "Informe o nome do motivo"
      : duplicate
        ? "Já existe um motivo com esse nome"
        : undefined;

  async function onSubmit() {
    setTouched(true);
    if (!trimmed || duplicate) return;
    if (reason && trimmed === reason.name) {
      onClose();
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error: dbError } = reason
      ? await supabase.from("lost_reasons").update({ name: trimmed }).eq("id", reason.id)
      : await supabase.from("lost_reasons").insert({ name: trimmed, order_index: nextOrder });
    setSaving(false);
    if (dbError) {
      toast.error("Não foi possível salvar o motivo", { description: friendlyError(dbError) });
      return;
    }
    toast.success(reason ? "Motivo atualizado" : "Motivo criado");
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{reason ? "Renomear motivo" : "Novo motivo da perda"}</DialogTitle>
          <DialogDescription>
            {reason
              ? "Negócios já perdidos com este motivo passam a mostrar o novo nome."
              : "Aparece na lista ao marcar um negócio como perdido."}
          </DialogDescription>
        </DialogHeader>
        <FormField label="Nome" htmlFor="lost-reason-name" required error={error}>
          <Input
            id="lost-reason-name"
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
