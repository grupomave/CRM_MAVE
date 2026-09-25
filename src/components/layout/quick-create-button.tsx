"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Handshake, UserPlus, CalendarPlus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { NewDealDialog } from "@/components/forms/new-deal-dialog";
import { NewContactDialog } from "@/components/forms/new-contact-dialog";
import { NewActivityDialog } from "@/components/forms/new-activity-dialog";

type ActiveDialog = "deal" | "contact" | "activity" | null;

export function QuickCreateButton() {
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);
  const router = useRouter();

  function handleCreated() {
    router.refresh();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" className="h-9 px-2.5 sm:px-3" aria-label="Criar">
            <Plus />
            <span className="hidden sm:inline">Criar</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setActiveDialog("deal")}>
            <Handshake />
            Novo negócio
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setActiveDialog("contact")}>
            <UserPlus />
            Novo contato
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setActiveDialog("activity")}>
            <CalendarPlus />
            Nova atividade
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <NewDealDialog
        open={activeDialog === "deal"}
        onOpenChange={(o) => setActiveDialog(o ? "deal" : null)}
        onCreated={handleCreated}
      />
      <NewContactDialog
        open={activeDialog === "contact"}
        onOpenChange={(o) => setActiveDialog(o ? "contact" : null)}
        onCreated={handleCreated}
      />
      <NewActivityDialog
        open={activeDialog === "activity"}
        onOpenChange={(o) => setActiveDialog(o ? "activity" : null)}
        onCreated={handleCreated}
      />
    </>
  );
}
