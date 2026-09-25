"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewActivityDialog } from "@/components/forms/new-activity-dialog";

export function ActivitiesToolbar() {
  const router = useRouter();
  return (
    <NewActivityDialog
      trigger={<Button>
          <Plus />
          Nova atividade
        </Button>}
      onCreated={() => router.refresh()}
    />
  );
}
