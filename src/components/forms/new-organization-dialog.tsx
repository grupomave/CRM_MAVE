"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
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
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { MaskedInput } from "@/components/ui/masked-inputs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { friendlyError, toast } from "@/lib/toast";
import { BR_STATES, isValidCNPJ, isValidPhoneBR } from "@/lib/masks";

const NONE = "__none__";

const schema = z.object({
  name: z.string().trim().min(1, "Informe o nome fantasia"),
  legal_name: z.string().optional(),
  cnpj: z
    .string()
    .optional()
    .refine((v) => !v || isValidCNPJ(v), "CNPJ inválido — confira os dígitos"),
  sector: z.string().optional(),
  company_size: z.string().optional(),
  nature: z.enum(["publica", "privada"]).optional(),
  phone: z
    .string()
    .optional()
    .refine((v) => !v || isValidPhoneBR(v), "Telefone incompleto — use DDD + número"),
  city: z.string().optional(),
  state: z.string().optional(),
  website: z.string().optional(),
  linkedin_url: z.string().optional(),
  instagram_url: z.string().optional(),
  address: z.string().optional(),
  services_of_interest: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function NewOrganizationDialog({
  trigger,
  onCreated,
}: {
  trigger: React.ReactNode;
  onCreated?: (created?: { id: string; name: string }) => void;
}) {
  const [open, setOpen] = useState(false);

  const {
    register,
    handleSubmit,
    control,
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
      .from("organizations")
      .insert({
        name: values.name,
        legal_name: values.legal_name || null,
        cnpj: values.cnpj || null,
        sector: values.sector || null,
        company_size: values.company_size || null,
        nature: values.nature || null,
        phone: values.phone || null,
        city: values.city || null,
        state: values.state || null,
        website: values.website || null,
        linkedin_url: values.linkedin_url || null,
        instagram_url: values.instagram_url || null,
        address: values.address || null,
        services_of_interest: values.services_of_interest || null,
        notes: values.notes || null,
        owner_id: user.id,
      })
      .select("id, name")
      .single();

    if (error) {
      toast.error("Não foi possível criar a organização", { description: friendlyError(error) });
      return;
    }

    toast.success("Organização criada", { description: values.name });
    reset();
    setOpen(false);
    onCreated?.(data ?? undefined);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Nova organização</DialogTitle>
          <DialogDescription>Campos com * são obrigatórios.</DialogDescription>
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
          <FormField label="Nome fantasia" htmlFor="org-name" required error={errors.name?.message}>
            <Input id="org-name" autoFocus placeholder="Como a empresa é conhecida" {...register("name")} />
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Razão social" htmlFor="org-legal">
              <Input id="org-legal" {...register("legal_name")} />
            </FormField>
            <FormField label="CNPJ" htmlFor="org-cnpj" error={errors.cnpj?.message}>
              <MaskedInput id="org-cnpj" mask="cnpj" {...register("cnpj")} />
            </FormField>
            <FormField label="Setor" htmlFor="org-sector">
              <Input id="org-sector" placeholder="Ex.: Condomínio, Indústria" {...register("sector")} />
            </FormField>
            <FormField label="Porte" htmlFor="org-size" hint="Número aproximado de funcionários">
              <Input id="org-size" {...register("company_size")} />
            </FormField>
            <FormField label="Natureza" htmlFor="org-nature">
              <Controller
                control={control}
                name="nature"
                render={({ field }) => (
                  <Select
                    value={field.value ?? NONE}
                    onValueChange={(v) => field.onChange(v === NONE ? undefined : v)}
                  >
                    <SelectTrigger id="org-nature">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Não informada</SelectItem>
                      <SelectItem value="publica">Pública</SelectItem>
                      <SelectItem value="privada">Privada</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <FormField label="Telefone" htmlFor="org-phone" error={errors.phone?.message}>
              <MaskedInput id="org-phone" mask="phone" {...register("phone")} />
            </FormField>
            <FormField label="Cidade" htmlFor="org-city">
              <Input id="org-city" {...register("city")} />
            </FormField>
            <FormField label="UF" htmlFor="org-state">
              <Controller
                control={control}
                name="state"
                render={({ field }) => (
                  <Select
                    value={field.value || NONE}
                    onValueChange={(v) => field.onChange(v === NONE ? "" : v)}
                  >
                    <SelectTrigger id="org-state">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Selecione</SelectItem>
                      {BR_STATES.map((uf) => (
                        <SelectItem key={uf} value={uf}>
                          {uf}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <FormField label="Site" htmlFor="org-site">
              <Input id="org-site" type="url" placeholder="https://" {...register("website")} />
            </FormField>
            <FormField label="LinkedIn" htmlFor="org-linkedin">
              <Input id="org-linkedin" type="url" placeholder="https://linkedin.com/company/..." {...register("linkedin_url")} />
            </FormField>
            <FormField label="Instagram" htmlFor="org-instagram">
              <Input id="org-instagram" placeholder="@empresa" {...register("instagram_url")} />
            </FormField>
          </div>

          <FormField label="Endereço" htmlFor="org-address">
            <Input id="org-address" placeholder="Rua, número, bairro" {...register("address")} />
          </FormField>

          <FormField label="Serviços de interesse" htmlFor="org-services">
            <Input
              id="org-services"
              placeholder="Ex.: Portaria, Limpeza e Vigilância"
              {...register("services_of_interest")}
            />
          </FormField>

          <FormField label="Observações" htmlFor="org-notes">
            <Textarea id="org-notes" rows={2} {...register("notes")} />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Criar organização
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
