import Image from "next/image";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-neutral-bg px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-3">
          <Image
            src="/logo-mark.png"
            alt="Grupo Mave"
            width={64}
            height={64}
            className="rounded-full"
            priority
          />
          <div className="text-center">
            <h1 className="text-lg font-bold text-foreground">Grupo Mave CRM</h1>
            <p className="text-sm text-muted-foreground">
              Entre com sua conta corporativa
            </p>
          </div>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
