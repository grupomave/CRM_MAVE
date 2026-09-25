import * as React from "react";
import { cn } from "@/lib/utils";

// Estilo compartilhado por Input, Textarea e SelectTrigger — mantém altura,
// borda, foco e estado de erro (aria-invalid) idênticos entre os campos.
export const fieldClasses =
  "w-full rounded-md border border-input bg-card text-sm text-foreground shadow-xs outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/25";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        fieldClasses,
        "flex h-9 px-3 py-1 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
