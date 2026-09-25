"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { friendlyError, toast } from "@/lib/toast";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { BR_STATES, isValidCNPJ, isValidPhoneBR, maskCNPJ, maskPhoneBR } from "@/lib/masks";

const NONE = "__none__";

interface Organization {
  id: string;
  name: string;
  legal_name: string | null;
  cnpj: string | null;
  sector: string | null;
  company_size: string | null;
  nature: "publica" | "privada" | null;
  city: string | null;
  state: string | null;
  address: string | null;
  website: string | null;
  linkedin_url: string | null;
  instagram_url: string | null;
  phone: string | null;
  services_of_interest: string | null;
  notes: string | null;
}

export function OrganizationDetailForm({
  organization,
  canDelete,
}: {
  organization: Organization;
  canDelete: boolean;
}) {
  const [form, setForm] = useState(organization);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const router = useRouter();

  function set<K extends keyof Organization>(key: K, value: Organization[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const errors = {
    name: !form.name.trim() ? "Informe o nome fantasia" : undefined,
    cnpj: form.cnpj && !isValidCNPJ(form.cnpj) ? "CNPJ inválido — confira os dígitos" : undefined,
    phone: form.phone && !isValidPhoneBR(form.phone) ? "Telefone incompleto — use DDD + número" : undefined,
  };
  const hasErrors = Object.values(errors).some(Boolean);
  const dirty = JSON.stringify(form) !== JSON.stringify(organization);

  async function onSave() {
    setTouched(true);
    if (hasErrors) return;
    setSaving(true);
    const supabase = createClient();
    const { id, ...rest } = form;
    const { error } = await supabase
      .from("organizations")
      .update({ ...rest, name: form.name.trim() })
      .eq("id", id);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar", { description: friendlyError(error) });
      return;
    }
    toast.success("Organização atualizada");
    router.refresh();
  }

  async function onDelete() {
    const ok = await confirmDialog({
      title: "Excluir esta organização?",
      description:
        "Pessoas e negócios vinculados deixam de referenciá-la, mas não são excluídos. Essa ação não pode ser desfeita.",
      confirmLabel: "Excluir organização",
      destructive: true,
    });
    if (!ok) return;
    const supabase = createClient();
    const { error } = await supabase.from("organizations").delete().eq("id", organization.id);
    if (error) {
      toast.error("Não foi possível excluir", { description: friendlyError(error) });
      return;
    }
    toast.success("Organização excluída");
    router.push("/contacts/organizations");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dados da organização</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Nome fantasia" htmlFor="org-name" required error={touched ? errors.name : undefined}>
            <Input id="org-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </FormField>
          <FormField label="Razão social" htmlFor="org-legal">
            <Input
              id="org-legal"
              value={form.legal_name ?? ""}
              onChange={(e) => set("legal_name", e.target.value || null)}
            />
          </FormField>
          <FormField label="CNPJ" htmlFor="org-cnpj" error={errors.cnpj}>
            <Input
              id="org-cnpj"
              inputMode="numeric"
              value={maskCNPJ(form.cnpj ?? "")}
              onChange={(e) => set("cnpj", maskCNPJ(e.target.value) || null)}
              placeholder="00.000.000/0000-00"
            />
          </FormField>
          <FormField label="Setor" htmlFor="org-sector">
            <Input id="org-sector" value={form.sector ?? ""} onChange={(e) => set("sector", e.target.value || null)} />
          </FormField>
          <FormField label="Porte" htmlFor="org-size" hint="Número aproximado de funcionários">
            <Input
              id="org-size"
              value={form.company_size ?? ""}
              onChange={(e) => set("company_size", e.target.value || null)}
            />
          </FormField>
          <FormField label="Natureza" htmlFor="org-nature">
            <Select
              value={form.nature ?? NONE}
              onValueChange={(v) => set("nature", v === NONE ? null : (v as "publica" | "privada"))}
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
          </FormField>
          <FormField label="Telefone" htmlFor="org-phone" error={errors.phone}>
            <div className="flex gap-1">
              <Input
                id="org-phone"
                inputMode="tel"
                value={maskPhoneBR(form.phone ?? "")}
                onChange={(e) => set("phone", maskPhoneBR(e.target.value) || null)}
                placeholder="(00) 00000-0000"
                aria-invalid={errors.phone ? true : undefined}
              />
              <WhatsAppButton phone={form.phone} />
            </div>
          </FormField>
          <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-4">
            <FormField label="Cidade" htmlFor="org-city">
              <Input id="org-city" value={form.city ?? ""} onChange={(e) => set("city", e.target.value || null)} />
            </FormField>
            <FormField label="UF" htmlFor="org-state">
              <Select value={form.state || NONE} onValueChange={(v) => set("state", v === NONE ? null : v)}>
                <SelectTrigger id="org-state">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {/* Mantém um valor legado fora da lista (ex.: importado do Pipedrive) */}
                  {form.state && !(BR_STATES as readonly string[]).includes(form.state) && (
                    <SelectItem value={form.state}>{form.state}</SelectItem>
                  )}
                  {BR_STATES.map((uf) => (
                    <SelectItem key={uf} value={uf}>
                      {uf}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <FormField label="Site" htmlFor="org-site">
            <Input
              id="org-site"
              type="url"
              placeholder="https://"
              value={form.website ?? ""}
              onChange={(e) => set("website", e.target.value || null)}
            />
          </FormField>
          <FormField label="LinkedIn" htmlFor="org-linkedin">
            <Input
              id="org-linkedin"
              type="url"
              value={form.linkedin_url ?? ""}
              onChange={(e) => set("linkedin_url", e.target.value || null)}
            />
          </FormField>
          <FormField label="Instagram" htmlFor="org-instagram">
            <Input
              id="org-instagram"
              placeholder="@empresa"
              value={form.instagram_url ?? ""}
              onChange={(e) => set("instagram_url", e.target.value || null)}
            />
          </FormField>
        </div>

        <FormField label="Endereço" htmlFor="org-address">
          <Input
            id="org-address"
            placeholder="Rua, número, bairro"
            value={form.address ?? ""}
            onChange={(e) => set("address", e.target.value || null)}
          />
        </FormField>

        <FormField label="Serviços de interesse" htmlFor="org-services">
          <Input
            id="org-services"
            value={form.services_of_interest ?? ""}
            onChange={(e) => set("services_of_interest", e.target.value || null)}
            placeholder="Ex.: Portaria, Limpeza e Vigilância"
          />
        </FormField>

        <FormField label="Observações" htmlFor="org-notes">
          <Textarea
            id="org-notes"
            value={form.notes ?? ""}
            onChange={(e) => set("notes", e.target.value || null)}
            rows={3}
          />
        </FormField>

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Button onClick={onSave} loading={saving} disabled={!dirty}>
            Salvar alterações
          </Button>
          {dirty && (
            <Button variant="ghost" onClick={() => setForm(organization)} disabled={saving}>
              Descartar
            </Button>
          )}
          {canDelete && (
            <Button variant="destructive-outline" onClick={onDelete} className="ml-auto">
              <Trash2 />
              Excluir organização
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
