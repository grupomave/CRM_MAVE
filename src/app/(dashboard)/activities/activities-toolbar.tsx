"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { NewActivityDialog } from "@/components/forms/new-activity-dialog";

export function ActivitiesToolbar() {
  const router = useRouter();
  return (
    <NewActivityDialog
      trigger={<Button>Nova atividade</Button>}
      onCreated={() => router.refresh()}
    />
  );
}
