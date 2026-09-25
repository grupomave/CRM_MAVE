import Image from "next/image";
import Link from "next/link";

export function Logo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link
      href="/dashboard"
      className="flex min-w-0 items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="Grupo Mave CRM — ir para o Dashboard"
    >
      <Image
        src="/logo-mark.png"
        alt=""
        width={32}
        height={32}
        className="size-8 shrink-0 rounded-full"
        priority
      />
      {!collapsed && (
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-semibold text-foreground">Grupo Mave</span>
          <span className="truncate text-micro text-muted-foreground">CRM comercial</span>
        </span>
      )}
    </Link>
  );
}
