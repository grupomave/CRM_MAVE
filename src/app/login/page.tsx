import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <AuthShell
      title="Entrar na plataforma"
      subtitle="Use seu e-mail corporativo para continuar."
    >
      <LoginForm />
    </AuthShell>
  );
}
