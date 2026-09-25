"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
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
import { createClient } from "@/lib/supabase/client";
import { friendlyError, toast } from "@/lib/toast";

const schema = z.object({
  name: z.string().trim().min(1, "Informe o nome do lead"),
  contact_info: z.string().optional(),
  source: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function LeadsToolbar() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
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

    const { error } = await supabase.from("leads").insert({
      name: values.name,
      contact_info: values.contact_info || null,
      source: values.source || null,
      status: "new",
      owner_id: user.id,
    });

    if (error) {
      toast.error("Não foi possível criar o lead", { description: friendlyError(error) });
      return;
    }

    toast.success("Lead criado", { description: values.name });
    reset();
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          Novo lead
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo lead</DialogTitle>
          <DialogDescription>
            Registre o contato para qualificar depois e, se fizer sentido, converter em negócio.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <FormField label="Nome" htmlFor="lead-name" required error={errors.name?.message}>
            <Input id="lead-name" autoFocus placeholder="Nome da pessoa ou empresa" {...register("name")} />
          </FormField>
          <FormField label="Contato" htmlFor="lead-contact" hint="E-mail ou telefone">
            <Input id="lead-contact" placeholder="nome@empresa.com.br ou (11) 99999-9999" {...register("contact_info")} />
          </FormField>
          <FormField label="Origem" htmlFor="lead-source">
            <Input id="lead-source" placeholder="Site, indicação, evento..." {...register("source")} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Criar lead
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
