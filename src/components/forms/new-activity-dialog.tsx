"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Mail, Phone, Users, type LucideIcon } from "lucide-react";
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
import { FormField } from "@/components/ui/form-field";
import { DateInput } from "@/components/ui/masked-inputs";
import { createClient } from "@/lib/supabase/client";
import { friendlyError, toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { ActivityType } from "@/lib/supabase/types";

const schema = z
  .object({
    subject: z.string().trim().min(1, "Informe o assunto"),
    type: z.enum(["task", "call", "meeting", "email"]),
    date: z.string().optional(),
    time: z.string().optional(),
  })
  .refine((v) => !v.time || !!v.date, { path: ["date"], message: "Informe a data para o horário escolhido" });

type FormValues = z.infer<typeof schema>;

const TYPES: { value: ActivityType; label: string; icon: LucideIcon }[] = [
  { value: "call", label: "Ligação", icon: Phone },
  { value: "meeting", label: "Reunião", icon: Users },
  { value: "task", label: "Tarefa", icon: CheckCircle2 },
  { value: "email", label: "E-mail", icon: Mail },
];

// Data (aaaa-mm-dd) + hora (hh:mm) no fuso do navegador -> ISO com fuso.
// Sem isso o Postgres interpretava "2026-09-25T14:00" como UTC (11h em Brasília).
function toDueDate(date?: string, time?: string) {
  if (!date) return null;
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = (time || "09:00").split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm).toISOString();
}

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

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { subject: "", type: "call", date: "", time: "" },
  });

  async function onSubmit(values: FormValues) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast.error("Sua sessão expirou", { description: "Entre novamente para continuar." });
      return;
    }

    const { error } = await supabase.from("activities").insert({
      subject: values.subject,
      type: values.type,
      due_date: toDueDate(values.date, values.time),
      done: false,
      deal_id: dealId ?? null,
      contact_id: contactId ?? null,
      owner_id: user.id,
    });

    if (error) {
      toast.error("Não foi possível criar a atividade", { description: friendlyError(error) });
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
          <DialogDescription>Ligação, reunião, tarefa ou e-mail.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <FormField label="Tipo" htmlFor="activity-type">
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <div id="activity-type" role="radiogroup" aria-label="Tipo de atividade" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      role="radio"
                      aria-checked={field.value === t.value}
                      onClick={() => field.onChange(t.value)}
                      className={cn(
                        "flex h-9 items-center justify-center gap-1.5 rounded-md border text-sm font-medium transition-colors",
                        field.value === t.value
                          ? "border-primary bg-primary-subtle text-primary"
                          : "border-input bg-card text-muted-foreground hover:border-border-strong hover:text-foreground",
                      )}
                    >
                      <t.icon className="size-4" />
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            />
          </FormField>

          <FormField label="Assunto" htmlFor="activity-subject" required error={errors.subject?.message}>
            <Input id="activity-subject" autoFocus placeholder="Ex.: Retornar sobre a proposta" {...register("subject")} />
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
            <FormField label="Data" htmlFor="activity-date" error={errors.date?.message}>
              <Controller
                control={control}
                name="date"
                render={({ field }) => (
                  <DateInput id="activity-date" value={field.value ?? ""} onValueChange={field.onChange} />
                )}
              />
            </FormField>
            <FormField label="Horário" htmlFor="activity-time" hint="Padrão 09:00">
              <Input id="activity-time" type="time" {...register("time")} />
            </FormField>
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Criar atividade
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
