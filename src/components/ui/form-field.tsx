import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "./label";

// Campo de formulário padrão: label acima, controle, dica ou erro inline.
// O controle recebe aria-invalid/aria-describedby automaticamente quando é
// um único elemento React (Input, Textarea, SelectTrigger...).
function FormField({
  label,
  htmlFor,
  required,
  hint,
  error,
  className,
  children,
}: {
  label?: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  hint?: React.ReactNode;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const messageId = htmlFor ? `${htmlFor}-message` : undefined;
  const control =
    React.isValidElement<Record<string, unknown>>(children) && (error || hint)
      ? React.cloneElement(children, {
          "aria-invalid": error ? true : undefined,
          "aria-describedby": messageId,
        })
      : children;

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      {label && (
        <Label htmlFor={htmlFor} required={required}>
          {label}
        </Label>
      )}
      {control}
      {error ? (
        <p id={messageId} role="alert" className="text-caption text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-caption text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export { FormField };
