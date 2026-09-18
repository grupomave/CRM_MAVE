"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

export function OrganizationDetailForm({ organization }: { organization: Organization }) {
  const [form, setForm] = useState(organization);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  function set<K extends keyof Organization>(key: K, value: Organization[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSave() {
    setSaving(true);
    const { id, ...rest } = form;
    const { error } = await supabase
      .from("organizations")
      .update({ ...rest, name: form.name.trim() || organization.name })
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
        "Excluir esta organização? Contatos e negócios vinculados deixam de referenciá-la, mas não são excluídos. Essa ação não pode ser desfeita.",
      )
    )
      return;
    await supabase.from("organizations").delete().eq("id", organization.id);
    router.push("/contacts/organizations");
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nome fantasia">
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Razão social">
            <Input
              value={form.legal_name ?? ""}
              onChange={(e) => set("legal_name", e.target.value || null)}
            />
          </Field>
          <Field label="CNPJ">
            <Input value={form.cnpj ?? ""} onChange={(e) => set("cnpj", e.target.value || null)} />
          </Field>
          <Field label="Setor">
            <Input
              value={form.sector ?? ""}
              onChange={(e) => set("sector", e.target.value || null)}
            />
          </Field>
          <Field label="Porte (nº de funcionários)">
            <Input
              value={form.company_size ?? ""}
              onChange={(e) => set("company_size", e.target.value || null)}
            />
          </Field>
          <Field label="Natureza">
            <Select
              value={form.nature ?? "none"}
              onValueChange={(v) => set("nature", v === "none" ? null : (v as "publica" | "privada"))}
            >
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                <SelectItem value="publica">Pública</SelectItem>
                <SelectItem value="privada">Privada</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Telefone">
            <div className="flex gap-1">
              <Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value || null)} />
              <WhatsAppButton phone={form.phone} />
            </div>
          </Field>
          <Field label="Cidade">
            <Input value={form.city ?? ""} onChange={(e) => set("city", e.target.value || null)} />
          </Field>
          <Field label="Estado">
            <Input value={form.state ?? ""} onChange={(e) => set("state", e.target.value || null)} />
          </Field>
          <Field label="Site">
            <Input
              value={form.website ?? ""}
              onChange={(e) => set("website", e.target.value || null)}
            />
          </Field>
          <Field label="LinkedIn">
            <Input
              value={form.linkedin_url ?? ""}
              onChange={(e) => set("linkedin_url", e.target.value || null)}
            />
          </Field>
          <Field label="Instagram">
            <Input
              value={form.instagram_url ?? ""}
              onChange={(e) => set("instagram_url", e.target.value || null)}
            />
          </Field>
        </div>

        <Field label="Endereço">
          <Input
            value={form.address ?? ""}
            onChange={(e) => set("address", e.target.value || null)}
          />
        </Field>

        <Field label="Serviços de interesse">
          <Input
            value={form.services_of_interest ?? ""}
            onChange={(e) => set("services_of_interest", e.target.value || null)}
            placeholder="ex.: Portaria, Limpeza e Vigilância"
          />
        </Field>

        <Field label="Observações">
          <Textarea
            value={form.notes ?? ""}
            onChange={(e) => set("notes", e.target.value || null)}
            rows={3}
          />
        </Field>

        <div className="flex items-center gap-2">
          <Button onClick={onSave} disabled={saving} className="self-start">
            {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
          {saved && <span className="text-sm text-success">Salvo!</span>}
          <Button variant="destructive" onClick={onDelete} className="ml-auto">
            Excluir organização
          </Button>
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
