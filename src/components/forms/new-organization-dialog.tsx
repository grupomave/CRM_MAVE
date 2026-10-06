"use client";

import { useEffect, useState } from "react";
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
import { BR_STATES, isValidCNPJ, isValidPhoneBR, maskCEP } from "@/lib/masks";
import { CnpjLookupButton, useCnpjLookup } from "@/components/forms/cnpj-lookup";
import type { CnpjData } from "@/lib/cnpj";

const NONE = "__none__";

const schema = z.object({
  name: z.string().trim().min(1, "Informe o nome fantasia"),
  legal_name: z.string().optional(),
  cnpj: z
    .string()
    .optional()
    .refine((v) => !v || isValidCNPJ(v), "CNPJ inválido — confira os dígitos"),
  segment_id: z.string().optional(),
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
  address_number: z.string().optional(),
  address_complement: z.string().optional(),
  neighborhood: z.string().optional(),
  zip_code: z.string().optional(),
  email: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "E-mail inválido"),
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
  const [segments, setSegments] = useState<{ id: string; name: string }[]>([]);

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // Segmentos cadastrados (Configurações > Segmentos), carregados ao abrir
  useEffect(() => {
    if (!open || segments.length > 0) return;
    createClient()
      .from("segments")
      .select("id, name")
      .eq("is_active", true)
      .order("order_index")
      .order("name")
      .then(({ data }) => setSegments(data ?? []));
  }, [open, segments.length]);

  // Preenche o formulário com os dados da Receita Federal (CNPJ digitado)
  function applyCnpjData(d: CnpjData) {
    const opts = { shouldDirty: true, shouldValidate: true } as const;
    if (d.name) setValue("name", d.name, opts);
    if (d.legal_name) setValue("legal_name", d.legal_name, opts);
    if (d.address) setValue("address", d.address, opts);
    if (d.address_number) setValue("address_number", d.address_number, opts);
    if (d.address_complement) setValue("address_complement", d.address_complement, opts);
    if (d.neighborhood) setValue("neighborhood", d.neighborhood, opts);
    if (d.zip_code) setValue("zip_code", d.zip_code, opts);
    if (d.city) setValue("city", d.city, opts);
    if (d.state) setValue("state", d.state, opts);
    if (d.email) setValue("email", d.email, opts);
    if (d.phone) setValue("phone", d.phone, opts);
  }
  const cnpjLookup = useCnpjLookup(applyCnpjData);

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
        segment_id: values.segment_id || null,
        company_size: values.company_size || null,
        nature: values.nature || null,
        phone: values.phone || null,
        city: values.city || null,
        state: values.state || null,
        website: values.website || null,
        linkedin_url: values.linkedin_url || null,
        instagram_url: values.instagram_url || null,
        address: values.address || null,
        address_number: values.address_number || null,
        address_complement: values.address_complement || null,
        neighborhood: values.neighborhood || null,
        zip_code: values.zip_code || null,
        email: values.email || null,
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
            <FormField
              label="CNPJ"
              htmlFor="org-cnpj"
              error={errors.cnpj?.message}
              hint="Ao digitar o CNPJ completo, os dados são buscados na Receita Federal."
            >
              <div className="flex gap-1">
                <MaskedInput
                  id="org-cnpj"
                  mask="cnpj"
                  {...register("cnpj", { onChange: (e) => cnpjLookup.autoLookup(e.target.value) })}
                />
                <CnpjLookupButton
                  onClick={() =>
                    cnpjLookup.lookup((document.getElementById("org-cnpj") as HTMLInputElement | null)?.value)
                  }
                  loading={cnpjLookup.loading}
                />
              </div>
            </FormField>
            <FormField label="Segmento" htmlFor="org-segment">
              <Controller
                control={control}
                name="segment_id"
                render={({ field }) => (
                  <Select
                    value={field.value || NONE}
                    onValueChange={(v) => field.onChange(v === NONE ? "" : v)}
                  >
                    <SelectTrigger id="org-segment">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Não informado</SelectItem>
                      {segments.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
            <FormField label="Endereço" htmlFor="org-address" className="sm:col-span-4">
              <Input id="org-address" placeholder="Rua, avenida..." {...register("address")} />
            </FormField>
            <FormField label="Nº" htmlFor="org-number" className="sm:col-span-2">
              <Input id="org-number" {...register("address_number")} />
            </FormField>
            <FormField label="Complemento" htmlFor="org-complement" className="sm:col-span-2">
              <Input id="org-complement" {...register("address_complement")} />
            </FormField>
            <FormField label="Bairro" htmlFor="org-neighborhood" className="sm:col-span-2">
              <Input id="org-neighborhood" {...register("neighborhood")} />
            </FormField>
            <FormField label="CEP" htmlFor="org-zip" className="sm:col-span-2">
              <Input
                id="org-zip"
                inputMode="numeric"
                placeholder="00000-000"
                {...register("zip_code", { onChange: (e) => (e.target.value = maskCEP(e.target.value)) })}
              />
            </FormField>
            <FormField label="E-mail" htmlFor="org-email" className="sm:col-span-6" error={errors.email?.message}>
              <Input id="org-email" type="email" {...register("email")} />
            </FormField>
          </div>

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
