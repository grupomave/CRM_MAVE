"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  gestor: "Gestor",
  vendedor: "Vendedor",
};

export function ProfileForm({
  fullName: initialFullName,
  role,
}: {
  fullName: string;
  role: string;
}) {
  const [fullName, setFullName] = useState(initialFullName);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  async function onSave() {
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  }

  return (
    <div className="flex max-w-md flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fullName">Nome completo</Label>
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Papel</Label>
            <Badge variant="outline" className="w-fit">
              {ROLE_LABEL[role] ?? role}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={onSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
            {saved && <span className="text-sm text-success">Salvo!</span>}
          </div>
        </CardContent>
      </Card>
      <ChangePasswordCard />
    </div>
  );
}

function ChangePasswordCard() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  async function onChangePassword() {
    setError(null);
    if (password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (updateError) {
      setError("Não foi possível trocar a senha.");
      return;
    }

    setPassword("");
    setConfirmPassword("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <Label className="text-sm font-medium">Trocar senha</Label>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="newPassword">Nova senha</Label>
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirmNewPassword">Confirme a nova senha</Label>
          <Input
            id="confirmNewPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex items-center gap-2">
          <Button onClick={onChangePassword} disabled={saving}>
            {saving ? "Salvando..." : "Trocar senha"}
          </Button>
          {saved && <span className="text-sm text-success">Senha alterada!</span>}
        </div>
      </CardContent>
    </Card>
  );
}
