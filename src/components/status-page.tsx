import Image from "next/image";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Base visual das páginas de erro (404/500), dentro ou fora do layout.
export function StatusPage({
  code,
  icon: Icon,
  title,
  description,
  actions,
  standalone = false,
}: {
  code?: string;
  icon?: LucideIcon;
  title: string;
  description: React.ReactNode;
  actions?: React.ReactNode;
  /** Fora do layout do app (sem sidebar): centraliza na tela e mostra o logo */
  standalone?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-4 text-center",
        standalone ? "min-h-dvh bg-background" : "min-h-[60vh] py-12",
      )}
    >
      {standalone && (
        <Image src="/logo-mark.png" alt="Grupo Mave" width={48} height={48} className="mb-8 rounded-full" />
      )}
      {Icon && (
        <div className="mb-5 flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-6" aria-hidden />
        </div>
      )}
      {code && <p className="numeric mb-1 text-caption font-semibold uppercase tracking-widest text-primary">{code}</p>}
      <h1 className="text-title text-foreground">{title}</h1>
      <div className="mt-2 max-w-md text-sm text-muted-foreground">{description}</div>
      {actions && <div className="mt-6 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
    </div>
  );
}
