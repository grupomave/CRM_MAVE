"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/change-password`,
    });

    // Sempre mostra a mesma mensagem, exista ou não o e-mail — evita
    // confirmar para quem está tentando quais e-mails têm conta no sistema.
    setLoading(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <p className="text-sm text-foreground">
          Se <strong>{email}</strong> tiver uma conta no sistema, enviamos um
          e-mail com um link para redefinir a senha.
        </p>
        <Link href="/login" className="text-sm text-primary hover:underline">
          Voltar para o login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">E-mail corporativo</Label>
        <Input
          id="email"
          type="email"
          placeholder="voce@grupomave.com.br"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <Button type="submit" disabled={loading} className="mt-2">
        {loading ? "Enviando..." : "Enviar link de redefinição"}
      </Button>

      <Link href="/login" className="text-center text-sm text-primary hover:underline">
        Voltar para o login
      </Link>
    </form>
  );
}
