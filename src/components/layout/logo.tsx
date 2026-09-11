import Image from "next/image";
import Link from "next/link";

export function Logo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link
      href="/dashboard"
      className="flex items-center gap-2 px-1 py-1"
      aria-label="Ir para o Dashboard"
    >
      <Image
        src="/logo-mark.png"
        alt="Grupo Mave"
        width={32}
        height={32}
        className="shrink-0 rounded-full"
        priority
      />
      {!collapsed && (
        <span className="text-sm font-bold tracking-tight text-sidebar-foreground">
          Grupo Mave <span className="font-normal text-muted-foreground">CRM</span>
        </span>
      )}
    </Link>
  );
}
