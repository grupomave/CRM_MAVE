"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import type { TriggerEvent } from "@/lib/supabase/types";

interface Stage {
  id: string;
  name: string;
}

export function AutomationsToolbar() {
  const [open, setOpen] = useState(false);
  const [stages, setStages] = useState<Stage[]>([]);
  const [triggerEvent, setTriggerEvent] = useState<TriggerEvent>("deal_stage_changed");
  const [toStageId, setToStageId] = useState("");
  const [actionType, setActionType] = useState<"create_activity" | "notify_user">(
    "create_activity",
  );
  const [actionText, setActionText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (!open) return;
    supabase
      .from("pipeline_stages")
      .select("id, name")
      .order("order_index")
      .then(({ data }) => data && setStages(data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const conditions_json =
      triggerEvent === "deal_stage_changed" ? { to_stage_id: toStageId } : {};

    const actions_json =
      actionType === "create_activity"
        ? [{ type: "create_activity", activity_type: "task", subject: actionText }]
        : [{ type: "notify_user", user_id: "owner", message: actionText }];

    await supabase.from("automation_rules").insert({
      trigger_event: triggerEvent,
      conditions_json,
      actions_json,
      active: true,
    });

    setSubmitting(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Nova automação</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova automação</DialogTitle>
          <DialogDescription>
            Quando algo acontecer, execute uma ação automaticamente.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Quando</Label>
            <Select
              value={triggerEvent}
              onValueChange={(v) => setTriggerEvent(v as TriggerEvent)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="deal_stage_changed">
                  Negócio muda de estágio
                </SelectItem>
                <SelectItem value="deal_created">Negócio é criado</SelectItem>
                <SelectItem value="activity_overdue">
                  Atividade fica atrasada
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {triggerEvent === "deal_stage_changed" && (
            <div className="flex flex-col gap-1.5">
              <Label>Para o estágio</Label>
              <Select value={toStageId} onValueChange={setToStageId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o estágio" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label>Então</Label>
            <Select
              value={actionType}
              onValueChange={(v) => setActionType(v as typeof actionType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="create_activity">Criar atividade</SelectItem>
                <SelectItem value="notify_user">
                  Notificar o responsável
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="actionText">
              {actionType === "create_activity" ? "Assunto da atividade" : "Mensagem"}
            </Label>
            <Input
              id="actionText"
              value={actionText}
              onChange={(e) => setActionText(e.target.value)}
              required
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Criando..." : "Criar automação"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
