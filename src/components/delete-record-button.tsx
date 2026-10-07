"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { createClient } from "@/lib/supabase/client";
import { friendlyError, toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

/** Botão de excluir (anotação ou atividade) com confirmação. */
export function DeleteRecordButton({
  table,
  id,
  label,
  title,
  description,
  successMessage,
  compact = false,
  className,
}: {
  table: "notes" | "activities";
  id: string;
  label: string;
  title: string;
  description?: string;
  successMessage: string;
  /** Versão miúda para caber dentro das etiquetas do calendário */
  compact?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    if (deleting) return;
    const ok = await confirmDialog({
      title,
      description: description ?? "Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      destructive: true,
    });
    if (!ok) return;
    setDeleting(true);
    const supabase = createClient();
    // select() devolve as linhas afetadas: o RLS bloqueia sem erro (0 linhas)
    const { data, error } = await supabase.from(table).delete().eq("id", id).select("id");
    setDeleting(false);
    if (error) {
      toast.error("Não foi possível excluir", { description: friendlyError(error) });
      return;
    }
    if (!data?.length) {
      toast.error("Você não tem permissão para excluir este registro");
      return;
    }
    toast.success(successMessage);
    router.refresh();
  }

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label={label}
      onClick={remove}
      loading={deleting}
      className={cn(compact && "size-4 rounded-sm p-0 [&_svg]:size-3", className)}
    >
      <Trash2 />
    </Button>
  );
}
