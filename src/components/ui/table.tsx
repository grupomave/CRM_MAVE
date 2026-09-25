import * as React from "react";
import { cn } from "@/lib/utils";

// Tabela padrão das listagens. Com `stickyHeader`, a tabela rola dentro do
// próprio container (altura limitada à viewport) e o cabeçalho fica fixo.
function Table({
  className,
  containerClassName,
  stickyHeader = false,
  ...props
}: React.ComponentProps<"table"> & { containerClassName?: string; stickyHeader?: boolean }) {
  return (
    <div
      className={cn(
        "scrollbar-thin relative w-full overflow-auto rounded-lg border border-border bg-card shadow-xs",
        stickyHeader && "max-h-[calc(100dvh-15rem)] min-h-48",
        containerClassName,
      )}
    >
      <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      className={cn(
        "sticky top-0 z-10 bg-muted [&_tr]:border-b [&_tr]:border-border [&_tr:hover]:bg-transparent",
        className,
      )}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      className={cn(
        "group/row border-b border-border transition-colors hover:bg-muted/60 data-[state=selected]:bg-primary-subtle",
        className,
      )}
      {...props}
    />
  );
}

type Align = "left" | "right" | "center";

const ALIGN_CLASSES: Record<Align, string> = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

function TableHead({
  className,
  align = "left",
  ...props
}: Omit<React.ComponentProps<"th">, "align"> & { align?: Align }) {
  return (
    <th
      className={cn(
        "h-10 whitespace-nowrap px-3 align-middle text-caption font-medium text-muted-foreground",
        ALIGN_CLASSES[align],
        className,
      )}
      {...props}
    />
  );
}

function TableCell({
  className,
  align = "left",
  numeric = false,
  ...props
}: Omit<React.ComponentProps<"td">, "align"> & { align?: Align; numeric?: boolean }) {
  return (
    <td
      className={cn(
        "h-12 px-3 py-2 align-middle",
        ALIGN_CLASSES[numeric ? "right" : align],
        numeric && "numeric whitespace-nowrap",
        className,
      )}
      {...props}
    />
  );
}

// Coluna de ações da linha: fica discreta e aparece no hover/foco (sempre
// visível em telas de toque, onde não existe hover).
function TableRowActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-1 transition-opacity md:opacity-0 md:group-hover/row:opacity-100 md:group-focus-within/row:opacity-100",
        className,
      )}
      {...props}
    />
  );
}

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableRowActions };
