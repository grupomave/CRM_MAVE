"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewContactDialog } from "@/components/forms/new-contact-dialog";

export function PeopleToolbar() {
  const router = useRouter();
  return (
    <NewContactDialog
      trigger={<Button>
          <Plus />
          Novo contato
        </Button>}
      onCreated={() => router.refresh()}
    />
  );
}
