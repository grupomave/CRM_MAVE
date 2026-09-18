import Image from "next/image";
import type { ReactNode } from "react";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      {/* Faixa compacta em telas pequenas */}
      <div className="flex items-center gap-3 border-b-[3px] border-brand-secondary bg-brand-primary px-6 py-5 lg:hidden">
        <Image
          src="/logo-mark.png"
          alt="Grupo Mave"
          width={40}
          height={40}
          className="rounded-full"
          priority
        />
        <div>
          <p className="text-sm leading-tight font-semibold text-white">
            Grupo Mave
          </p>
          <p className="text-xs leading-tight text-white/70">
            Segurança e Serviços
          </p>
        </div>
      </div>

      {/* Painel de marca em telas grandes, com o corte diagonal da logo */}
      <div className="relative hidden shrink-0 overflow-hidden lg:block lg:w-[44%]">
        <div
          className="absolute inset-0 bg-brand-secondary"
          style={{
            clipPath: "polygon(0 0, 100% 0, calc(100% - 64px) 100%, 0 100%)",
          }}
        />
        <div
          className="absolute inset-0 bg-gradient-to-br from-brand-primary to-brand-primary-hover"
          style={{
            clipPath:
              "polygon(0 0, calc(100% - 8px) 0, calc(100% - 72px) 100%, 0 100%)",
          }}
        />
        <div className="absolute top-1/3 -left-24 h-72 w-72 rounded-full bg-brand-accent/25 blur-3xl" />

        <div className="relative z-10 flex h-full flex-col justify-between px-12 py-14 xl:px-16">
          <div className="flex items-center gap-3">
            <Image
              src="/logo-mark.png"
              alt="Grupo Mave"
              width={56}
              height={56}
              className="rounded-full"
              priority
            />
            <div>
              <p className="text-lg font-semibold tracking-tight text-white">
                Grupo Mave
              </p>
              <p className="text-sm text-white/70">Segurança e Serviços</p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="max-w-xs text-sm leading-relaxed text-white/70">
              Plataforma interna de gestão comercial da Mave.
            </p>
            <p className="text-xs text-white/50">
              Acesso restrito a colaboradores autorizados.
            </p>
          </div>
        </div>
      </div>

      {/* Painel do formulário */}
      <div className="flex min-w-0 flex-1 items-center justify-center px-6 py-12 lg:px-20">
        <div className="w-full min-w-0 max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-foreground">
              {title}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
