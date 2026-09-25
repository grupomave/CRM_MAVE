import { AuthShell } from "@/components/auth/auth-shell";
import { ChangePasswordForm } from "./change-password-form";

export const metadata = { title: "Trocar senha" };

export default function ChangePasswordPage() {
  return (
    <AuthShell
      title="Defina sua senha"
      subtitle="Escolha uma nova senha para continuar."
    >
      <ChangePasswordForm />
    </AuthShell>
  );
}
