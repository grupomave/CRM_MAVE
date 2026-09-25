"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormField } from "@/components/ui/form-field";
import { createClient } from "@/lib/supabase/client";
import { friendlyError, toast } from "@/lib/toast";

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
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
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const nameError = !fullName.trim() ? "Informe seu nome" : undefined;

  async function onSave() {
    if (nameError) return;
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      toast.error("Sua sessão expirou", { description: "Entre novamente para continuar." });
      return;
    }
    const { error } = await supabase.from("profiles").update({ full_name: fullName.trim() }).eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar", { description: friendlyError(error) });
      return;
    }
    toast.success("Perfil atualizado");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Dados pessoais</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FormField label="Nome completo" htmlFor="fullName" required error={nameError}>
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </FormField>
          <FormField label="Papel" hint="Alterado apenas por um administrador">
            <Badge variant="neutral" className="w-fit">
              {ROLE_LABEL[role] ?? role}
            </Badge>
          </FormField>
          <div className="border-t border-border pt-4">
            <Button onClick={onSave} loading={saving} disabled={fullName.trim() === initialFullName}>
              Salvar
            </Button>
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
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const errors = {
    password: password.length > 0 && password.length < 8 ? "A senha precisa ter pelo menos 8 caracteres" : undefined,
    confirm:
      touched && confirmPassword !== password ? "As senhas não coincidem" : undefined,
  };

  async function onChangePassword() {
    setTouched(true);
    if (password.length < 8 || password !== confirmPassword) return;

    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (error) {
      toast.error("Não foi possível trocar a senha", { description: friendlyError(error) });
      return;
    }

    setPassword("");
    setConfirmPassword("");
    setTouched(false);
    toast.success("Senha alterada");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trocar senha</CardTitle>
        <CardDescription>Use pelo menos 8 caracteres.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Nova senha" htmlFor="newPassword" required error={errors.password}>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormField>
          <FormField label="Confirme a nova senha" htmlFor="confirmNewPassword" required error={errors.confirm}>
            <Input
              id="confirmNewPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </FormField>
        </div>
        <div className="border-t border-border pt-4">
          <Button onClick={onChangePassword} loading={saving} disabled={!password}>
            Trocar senha
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
