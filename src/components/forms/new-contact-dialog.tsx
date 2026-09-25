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
import { FormField } from "@/components/ui/form-field";
import { MaskedInput } from "@/components/ui/masked-inputs";
import { createClient } from "@/lib/supabase/client";
import { friendlyError, toast } from "@/lib/toast";
import { isValidPhoneBR } from "@/lib/masks";

const schema = z.object({
  name: z.string().trim().min(1, "Informe o nome"),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  phone: z
    .string()
    .optional()
    .refine((v) => !v || isValidPhoneBR(v), "Telefone incompleto — use DDD + número"),
});

type FormValues = z.infer<typeof schema>;

export function NewContactDialog({
  trigger,
  onCreated,
  open: openProp,
  onOpenChange,
  organizationId,
}: {
  trigger?: React.ReactNode;
  onCreated?: (created?: { id: string; name: string }) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  organizationId?: string;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast.error("Sua sessão expirou", { description: "Entre novamente para continuar." });
      return;
    }

    const { data, error } = await supabase
      .from("contacts")
      .insert({
        name: values.name,
        email: values.email || null,
        phone: values.phone || null,
        organization_id: organizationId ?? null,
        owner_id: user.id,
      })
      .select("id, name")
      .single();

    if (error) {
      toast.error("Não foi possível criar o contato", { description: friendlyError(error) });
      return;
    }

    toast.success("Contato criado", { description: values.name });
    reset();
    setOpen(false);
    onCreated?.(data ?? undefined);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo contato</DialogTitle>
          <DialogDescription>Cadastra uma nova pessoa.</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          onSubmit={(e) => {
            // O DialogContent do Radix é portalizado para fora do form pai no
            // DOM, mas o React ainda propaga o evento pela árvore de
            // componentes — sem isso, este submit também disparava o submit
            // do formulário pai (ex.: "Novo negócio") antes deste terminar.
            e.stopPropagation();
            handleSubmit(onSubmit)(e);
          }}
          className="flex flex-col gap-4"
        >
          <FormField label="Nome" htmlFor="contact-name" required error={errors.name?.message}>
            <Input id="contact-name" autoFocus placeholder="Nome completo" {...register("name")} />
          </FormField>
          <FormField label="E-mail" htmlFor="contact-email" error={errors.email?.message}>
            <Input id="contact-email" type="email" placeholder="nome@empresa.com.br" {...register("email")} />
          </FormField>
          <FormField label="Telefone" htmlFor="contact-phone" error={errors.phone?.message}>
            <MaskedInput id="contact-phone" mask="phone" {...register("phone")} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Criar contato
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
