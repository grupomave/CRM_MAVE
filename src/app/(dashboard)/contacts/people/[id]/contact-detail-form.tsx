"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { FormField } from "@/components/ui/form-field";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { createClient } from "@/lib/supabase/client";
import { friendlyError, toast } from "@/lib/toast";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { isValidPhoneBR, maskPhoneBR } from "@/lib/masks";

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  job_title: string | null;
  contact_preference: string | null;
  organization_id: string | null;
}

interface OrganizationOption {
  id: string;
  name: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ContactDetailForm({
  contact,
  organizations,
  canDelete,
}: {
  contact: Contact;
  organizations: OrganizationOption[];
  canDelete: boolean;
}) {
  const [form, setForm] = useState(contact);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const router = useRouter();

  function set<K extends keyof Contact>(key: K, value: Contact[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const errors = {
    name: !form.name.trim() ? "Informe o nome" : undefined,
    email: form.email && !EMAIL_RE.test(form.email) ? "E-mail inválido" : undefined,
    phone: form.phone && !isValidPhoneBR(form.phone) ? "Telefone incompleto — use DDD + número" : undefined,
    whatsapp: form.whatsapp && !isValidPhoneBR(form.whatsapp) ? "WhatsApp incompleto — use DDD + número" : undefined,
  };
  const hasErrors = Object.values(errors).some(Boolean);
  const dirty = JSON.stringify(form) !== JSON.stringify(contact);

  async function onSave() {
    setTouched(true);
    if (hasErrors) return;
    setSaving(true);
    const supabase = createClient();
    const { id, ...rest } = form;
    const { error } = await supabase
      .from("contacts")
      .update({ ...rest, name: form.name.trim() })
      .eq("id", id);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar", { description: friendlyError(error) });
      return;
    }
    toast.success("Contato atualizado");
    router.refresh();
  }

  async function onDelete() {
    const ok = await confirmDialog({
      title: "Excluir esta pessoa?",
      description:
        "Atividades e anotações vinculadas diretamente a ela também serão excluídas. Negócios vinculados são mantidos, só deixam de ter este contato. Essa ação não pode ser desfeita.",
      confirmLabel: "Excluir pessoa",
      destructive: true,
    });
    if (!ok) return;
    const supabase = createClient();
    const { error } = await supabase.from("contacts").delete().eq("id", contact.id);
    if (error) {
      toast.error("Não foi possível excluir", { description: friendlyError(error) });
      return;
    }
    toast.success("Pessoa excluída");
    router.push("/contacts/people");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dados da pessoa</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Nome" htmlFor="person-name" required error={touched ? errors.name : undefined}>
            <Input id="person-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </FormField>
          <FormField label="Cargo" htmlFor="person-role">
            <Input
              id="person-role"
              placeholder="Ex.: Síndico, Gerente de Facilities"
              value={form.job_title ?? ""}
              onChange={(e) => set("job_title", e.target.value || null)}
            />
          </FormField>
          <FormField label="E-mail" htmlFor="person-email" error={errors.email}>
            <Input
              id="person-email"
              type="email"
              placeholder="nome@empresa.com.br"
              value={form.email ?? ""}
              onChange={(e) => set("email", e.target.value || null)}
            />
          </FormField>
          <FormField label="Organização" htmlFor="person-org">
            <Combobox
              id="person-org"
              value={form.organization_id}
              onChange={(v) => set("organization_id", v)}
              options={organizations.map((o) => ({ value: o.id, label: o.name }))}
              placeholder="Nenhuma"
              searchPlaceholder="Buscar organização..."
            />
          </FormField>
          <FormField label="Telefone" htmlFor="person-phone" error={errors.phone}>
            <div className="flex gap-1">
              <Input
                id="person-phone"
                inputMode="tel"
                value={maskPhoneBR(form.phone ?? "")}
                onChange={(e) => set("phone", maskPhoneBR(e.target.value) || null)}
                placeholder="(00) 00000-0000"
                aria-invalid={errors.phone ? true : undefined}
              />
              <WhatsAppButton phone={form.phone} contactId={contact.id} />
            </div>
          </FormField>
          <FormField label="WhatsApp" htmlFor="person-whatsapp" error={errors.whatsapp}>
            <div className="flex gap-1">
              <Input
                id="person-whatsapp"
                inputMode="tel"
                value={maskPhoneBR(form.whatsapp ?? "")}
                onChange={(e) => set("whatsapp", maskPhoneBR(e.target.value) || null)}
                placeholder="(00) 00000-0000"
                aria-invalid={errors.whatsapp ? true : undefined}
              />
              <WhatsAppButton phone={form.whatsapp} contactId={contact.id} />
            </div>
          </FormField>
          <FormField label="Preferência de contato" htmlFor="person-pref" className="sm:col-span-2">
            <Input
              id="person-pref"
              value={form.contact_preference ?? ""}
              onChange={(e) => set("contact_preference", e.target.value || null)}
              placeholder="Ex.: WhatsApp à tarde, e-mail, ligação"
            />
          </FormField>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Button onClick={onSave} loading={saving} disabled={!dirty}>
            Salvar alterações
          </Button>
          {dirty && (
            <Button variant="ghost" onClick={() => setForm(contact)} disabled={saving}>
              Descartar
            </Button>
          )}
          {canDelete && (
            <Button variant="destructive-outline" onClick={onDelete} className="ml-auto">
              <Trash2 />
              Excluir pessoa
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
