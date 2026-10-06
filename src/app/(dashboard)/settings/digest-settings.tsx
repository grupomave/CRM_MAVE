"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/lib/supabase/client";
import { friendlyError, toast } from "@/lib/toast";

export interface DigestSettingsRow {
  enabled: boolean;
  include_today: boolean;
  include_overdue: boolean;
  notify_sellers: boolean;
  notify_managers: boolean;
}

type Key = keyof DigestSettingsRow;

const OPTIONS: { key: Key; label: string; hint: string }[] = [
  { key: "include_today", label: "Atividades do dia", hint: "Pendentes com vencimento hoje." },
  {
    key: "include_overdue",
    label: "Atividades atrasadas",
    hint: "Pendentes com vencimento anterior a hoje, com o tempo de atraso.",
  },
  { key: "notify_sellers", label: "Enviar ao responsável", hint: "Cada vendedor recebe as próprias atividades." },
  {
    key: "notify_managers",
    label: "Enviar ao gestor da equipe",
    hint: "O gestor recebe o resumo da equipe, agrupado por vendedor.",
  },
];

export function DigestSettings({ settings, canEdit }: { settings: DigestSettingsRow; canEdit: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<Key | null>(null);

  async function toggle(key: Key, value: boolean) {
    setBusy(key);
    const { error } = await createClient().from("digest_settings").update({ [key]: value } as Partial<DigestSettingsRow>).eq("id", 1);
    setBusy(null);
    if (error) {
      toast.error("Não foi possível salvar", { description: friendlyError(error) });
      return;
    }
    toast.success("Configuração salva");
    router.refresh();
  }

  return (
    <Card className="max-w-detail">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="size-4 text-primary" aria-hidden />
          Resumo diário de atividades por e-mail
        </CardTitle>
        <CardDescription>
          Enviado todos os dias às 08:00 (horário de Brasília). Por equipe: o gestor recebe o resumo da equipe
          definida em Usuários e permissões.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col divide-y divide-border">
        <Row
          label="Envio ativo"
          hint="Desligue para pausar todos os e-mails do resumo."
          checked={settings.enabled}
          disabled={!canEdit || busy !== null}
          onChange={(v) => toggle("enabled", v)}
        />
        {OPTIONS.map((o) => (
          <Row
            key={o.key}
            label={o.label}
            hint={o.hint}
            checked={settings[o.key]}
            disabled={!canEdit || busy !== null || !settings.enabled}
            onChange={(v) => toggle(o.key, v)}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex min-w-0 flex-col">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-caption text-muted-foreground">{hint}</span>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}
