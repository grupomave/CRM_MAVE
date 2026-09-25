"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { createClient } from "@/lib/supabase/client";
import { friendlyError, toast } from "@/lib/toast";

export function ActivityDoneToggle({
  activityId,
  done,
  label,
}: {
  activityId: string;
  done: boolean;
  label?: string;
}) {
  const [checked, setChecked] = useState(done);
  const [, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Checkbox
      checked={checked}
      aria-label={label ? `Marcar "${label}" como concluída` : "Marcar como concluída"}
      className="rounded-full"
      onCheckedChange={(value) => {
        const next = value === true;
        setChecked(next);
        startTransition(async () => {
          const supabase = createClient();
          const { error } = await supabase
            .from("activities")
            .update({ done: next })
            .eq("id", activityId);
          if (error) {
            setChecked(!next);
            toast.error("Não foi possível atualizar a atividade", { description: friendlyError(error) });
            return;
          }
          if (next) toast.success("Atividade concluída");
          router.refresh();
        });
      }}
    />
  );
}
