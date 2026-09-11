"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { createClient } from "@/lib/supabase/client";

export function ActivityDoneToggle({
  activityId,
  done,
}: {
  activityId: string;
  done: boolean;
}) {
  const [checked, setChecked] = useState(done);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const supabase = createClient();

  return (
    <Checkbox
      checked={checked}
      onCheckedChange={(value) => {
        const next = value === true;
        setChecked(next);
        startTransition(async () => {
          await supabase
            .from("activities")
            .update({ done: next })
            .eq("id", activityId);
          router.refresh();
        });
      }}
    />
  );
}
