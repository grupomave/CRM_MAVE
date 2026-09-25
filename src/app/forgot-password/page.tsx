import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata = { title: "Esqueci minha senha" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Esqueci minha senha"
      subtitle="Informe seu e-mail corporativo para receber um link de redefinição."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
