"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { friendlyError, toast } from "@/lib/toast";

type OwnedTable = "leads" | "contacts" | "organizations" | "deals";

const CHUNK = 100;

// Reatribui o responsável de vários registros. A RLS continua sendo quem
// decide: linhas que o usuário não pode alterar simplesmente não voltam no
// .select() e são reportadas como "sem permissão".
export function BulkOwnerButton({
  table,
  ids,
  owners,
  onDone,
}: {
  table: OwnedTable;
  ids: string[];
  owners: { id: string; full_name: string; is_active?: boolean }[];
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [ownerId, setOwnerId] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function apply() {
    if (!ownerId) return;
    setSaving(true);
    const supabase = createClient();
    let updated = 0;
    let failure: unknown = null;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      const { data, error } = await supabase
        .from(table)
        .update({ owner_id: ownerId })
        .in("id", chunk)
        .select("id");
      if (error) {
        failure = error;
        break;
      }
      updated += data?.length ?? 0;
    }
    setSaving(false);

    if (failure) {
      toast.error(
        updated > 0
          ? `Alteração interrompida: ${updated} de ${ids.length} registros foram alterados`
          : "Não foi possível alterar o responsável",
        { description: friendlyError(failure) },
      );
    } else if (updated < ids.length) {
      toast.warning(`${updated} de ${ids.length} registros alterados`, {
        description: "Os demais não puderam ser alterados por falta de permissão.",
      });
    } else {
      const name = owners.find((o) => o.id === ownerId)?.full_name;
      toast.success(`${updated} ${updated === 1 ? "registro atribuído" : "registros atribuídos"} a ${name}`);
    }
    setOpen(false);
    setOwnerId("");
    onDone();
    router.refresh();
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <UserCog />
        Alterar responsável
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Alterar responsável</DialogTitle>
            <DialogDescription>
              {ids.length} {ids.length === 1 ? "registro selecionado" : "registros selecionados"}{" "}
              passarão para o novo responsável.
            </DialogDescription>
          </DialogHeader>
          <FormField label="Novo responsável" htmlFor="bulk-owner" required>
            <Select value={ownerId} onValueChange={setOwnerId}>
              <SelectTrigger id="bulk-owner">
                <SelectValue placeholder="Selecione um usuário" />
              </SelectTrigger>
              <SelectContent>
                {owners
                  .filter((o) => o.is_active !== false)
                  .map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.full_name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </FormField>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={apply} disabled={!ownerId} loading={saving}>
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
