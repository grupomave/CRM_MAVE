"use client";

import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewActivityDialog, type EditableActivity } from "@/components/forms/new-activity-dialog";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

export function ActivityEditButton({
  activity,
  compact = false,
  className,
}: {
  activity: EditableActivity;
  /** Versão miúda para caber dentro das etiquetas do calendário */
  compact?: boolean;
  className?: string;
}) {
  const router = useRouter();
  return (
    <NewActivityDialog
      // remonta com os dados novos depois de salvar
      key={`${activity.id}-${activity.type}-${activity.subject}-${activity.due_date}`}
      activity={activity}
      onCreated={() => {
        toast.success("Atividade atualizada");
        router.refresh();
      }}
      trigger={
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`Editar atividade "${activity.subject}"`}
          className={cn(compact && "size-4 rounded-sm p-0 [&_svg]:size-3", className)}
        >
          <Pencil />
        </Button>
      }
    />
  );
}
