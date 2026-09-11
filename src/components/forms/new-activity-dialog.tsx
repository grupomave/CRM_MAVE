"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import type { ActivityType } from "@/lib/supabase/types";

const schema = z.object({
  subject: z.string().min(1, "Informe o assunto"),
  type: z.enum(["task", "call", "meeting", "email"]),
  due_date: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const TYPE_LABELS: Record<ActivityType, string> = {
  task: "Tarefa",
  call: "Ligação",
  meeting: "Reunião",
  email: "E-mail",
};

export function NewActivityDialog({
  trigger,
  dealId,
  contactId,
  onCreated,
  open: openProp,
  onOpenChange,
}: {
  trigger?: React.ReactNode;
  dealId?: string;
  contactId?: string;
  onCreated?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [submitError, setSubmitError] = useState<string | null>(null);
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { subject: "", type: "task" },
  });

  async function onSubmit(values: FormValues) {
    setSubmitError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSubmitError("Sessão expirada, faça login novamente.");
      return;
    }

    const { error } = await supabase.from("activities").insert({
      subject: values.subject,
      type: values.type,
      due_date: values.due_date || null,
      done: false,
      deal_id: dealId ?? null,
      contact_id: contactId ?? null,
      owner_id: user.id,
    });

    if (error) {
      setSubmitError("Não foi possível criar a atividade. Tente novamente.");
      return;
    }

    reset();
    setOpen(false);
    onCreated?.();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova atividade</DialogTitle>
          <DialogDescription>
            Tarefa, ligação, reunião ou e-mail.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="subject">Assunto</Label>
            <Input id="subject" {...register("subject")} autoFocus />
            {errors.subject && (
              <p className="text-xs text-destructive">
                {errors.subject.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Tipo</Label>
            <Select
              value={watch("type")}
              onValueChange={(v) => setValue("type", v as FormValues["type"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="due_date">Data/hora</Label>
            <Input id="due_date" type="datetime-local" {...register("due_date")} />
          </div>

          {submitError && (
            <p className="text-sm text-destructive">{submitError}</p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Criando..." : "Criar atividade"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
