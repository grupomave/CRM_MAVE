"use client";

import { useState, useSyncExternalStore } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

// Confirmação elegante para ações destrutivas ou em massa, no lugar do
// window.confirm do navegador:
//
//   if (!(await confirmDialog({ title: "Excluir etapa?", destructive: true }))) return;

export interface ConfirmOptions {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

let pending: PendingConfirm | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  // Se já houver uma confirmação aberta, a anterior é cancelada
  pending?.resolve(false);
  return new Promise((resolve) => {
    pending = { ...options, resolve };
    emit();
  });
}

function usePending() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => pending,
    () => null,
  );
}

export function ConfirmDialogHost() {
  const current = usePending();
  const [closing, setClosing] = useState(false);

  function settle(value: boolean) {
    if (!current) return;
    current.resolve(value);
    setClosing(true);
    setTimeout(() => {
      pending = null;
      setClosing(false);
      emit();
    }, 150);
  }

  const open = Boolean(current) && !closing;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && settle(false)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          role="alertdialog"
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 text-card-foreground shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          {current && (
            <div className="flex gap-4">
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-full",
                  current.destructive
                    ? "bg-destructive-subtle text-destructive"
                    : "bg-primary-subtle text-primary",
                )}
              >
                <AlertTriangle className="size-5" aria-hidden />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <DialogPrimitive.Title className="text-subtitle text-foreground">
                  {current.title}
                </DialogPrimitive.Title>
                <DialogPrimitive.Description asChild>
                  <div className="text-sm text-muted-foreground">
                    {current.description ?? "Essa ação não pode ser desfeita."}
                  </div>
                </DialogPrimitive.Description>
                <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button variant="secondary" onClick={() => settle(false)}>
                    {current.cancelLabel ?? "Cancelar"}
                  </Button>
                  <Button
                    variant={current.destructive ? "destructive" : "default"}
                    onClick={() => settle(true)}
                    autoFocus
                  >
                    {current.confirmLabel ?? "Confirmar"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
