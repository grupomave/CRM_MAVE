"use client";

import * as ToastPrimitive from "@radix-ui/react-toast";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast, useToasts, type ToastVariant } from "@/lib/toast";

const ICONS: Record<ToastVariant, typeof Info> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const ICON_CLASSES: Record<ToastVariant, string> = {
  success: "text-success",
  error: "text-destructive",
  info: "text-info",
  warning: "text-warning",
};

export function Toaster() {
  const items = useToasts();

  return (
    <ToastPrimitive.Provider swipeDirection="right" label="Notificação">
      {items.map((item) => {
        const Icon = ICONS[item.variant];
        return (
          <ToastPrimitive.Root
            key={item.id}
            open={item.open}
            duration={item.duration ?? 5000}
            type={item.variant === "error" ? "foreground" : "background"}
            onOpenChange={(open) => {
              if (!open) toast.dismiss(item.id);
            }}
            className={cn(
              "pointer-events-auto relative flex w-full items-start gap-3 rounded-lg border border-border bg-card p-3.5 pr-9 text-card-foreground shadow-lg",
              "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
              "data-[swipe=move]:translate-x-(--radix-toast-swipe-move-x) data-[swipe=cancel]:translate-x-0 data-[swipe=end]:animate-out",
            )}
          >
            <Icon className={cn("mt-0.5 size-4 shrink-0", ICON_CLASSES[item.variant])} aria-hidden />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <ToastPrimitive.Title className="text-sm font-medium text-foreground">
                {item.title}
              </ToastPrimitive.Title>
              {item.description && (
                <ToastPrimitive.Description className="text-caption text-muted-foreground">
                  {item.description}
                </ToastPrimitive.Description>
              )}
              {item.action && (
                <ToastPrimitive.Action
                  altText={item.action.label}
                  onClick={item.action.onClick}
                  className="mt-1.5 self-start rounded-sm text-caption font-medium text-primary hover:underline"
                >
                  {item.action.label}
                </ToastPrimitive.Action>
              )}
            </div>
            <ToastPrimitive.Close
              aria-label="Fechar"
              className="absolute right-2 top-2 rounded-sm p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        );
      })}
      <ToastPrimitive.Viewport className="fixed inset-x-0 bottom-0 z-100 mx-auto flex w-full max-w-sm flex-col gap-2 p-4 outline-none sm:inset-x-auto sm:right-0" />
    </ToastPrimitive.Provider>
  );
}
