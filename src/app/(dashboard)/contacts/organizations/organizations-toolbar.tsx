"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewOrganizationDialog } from "@/components/forms/new-organization-dialog";

export function OrganizationsToolbar() {
  const router = useRouter();
  return (
    <NewOrganizationDialog
      trigger={<Button>
          <Plus />
          Nova organização
        </Button>}
      onCreated={() => router.refresh()}
    />
  );
}
