"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { maskPhoneBR } from "@/lib/utils";

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
  const [saved, setSaved] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  function set<K extends keyof Contact>(key: K, value: Contact[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSave() {
    setSaving(true);
    const { id, ...rest } = form;
    const { error } = await supabase
      .from("contacts")
      .update({ ...rest, name: form.name.trim() || contact.name })
      .eq("id", id);
    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    }
  }

  async function onDelete() {
    if (
      !window.confirm(
        "Excluir este contato? Atividades e notas vinculadas diretamente a ele também serão excluídas. Negócios vinculados são mantidos, só deixam de ter esse contato. Essa ação não pode ser desfeita.",
      )
    )
      return;
    await supabase.from("contacts").delete().eq("id", contact.id);
    router.push("/contacts/people");
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nome">
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Cargo">
            <Input
              value={form.job_title ?? ""}
              onChange={(e) => set("job_title", e.target.value || null)}
            />
          </Field>
          <Field label="E-mail">
            <Input
              type="email"
              value={form.email ?? ""}
              onChange={(e) => set("email", e.target.value || null)}
            />
          </Field>
          <Field label="Telefone">
            <div className="flex gap-1">
              <Input
                value={maskPhoneBR(form.phone ?? "")}
                onChange={(e) => set("phone", maskPhoneBR(e.target.value) || null)}
                placeholder="(00) 00000-0000"
              />
              <WhatsAppButton phone={form.phone} contactId={contact.id} />
            </div>
          </Field>
          <Field label="WhatsApp">
            <div className="flex gap-1">
              <Input
                value={maskPhoneBR(form.whatsapp ?? "")}
                onChange={(e) => set("whatsapp", maskPhoneBR(e.target.value) || null)}
                placeholder="(00) 00000-0000"
              />
              <WhatsAppButton phone={form.whatsapp} contactId={contact.id} />
            </div>
          </Field>
          <Field label="Organização">
            <Select
              value={form.organization_id ?? "none"}
              onValueChange={(v) => set("organization_id", v === "none" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Nenhuma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                {organizations.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Preferência de contato">
            <Input
              value={form.contact_preference ?? ""}
              onChange={(e) => set("contact_preference", e.target.value || null)}
              placeholder="ex.: WhatsApp, e-mail, ligação"
            />
          </Field>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={onSave} disabled={saving} className="self-start">
            {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
          {saved && <span className="text-sm text-success">Salvo!</span>}
          {canDelete && (
            <Button variant="destructive" onClick={onDelete} className="ml-auto">
              Excluir contato
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
