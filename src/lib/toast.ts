"use client";

import { useSyncExternalStore } from "react";

// Store mínimo de toasts (sem dependência nova): qualquer componente cliente
// chama toast.success(...)/toast.error(...), e o <Toaster /> do layout raiz
// renderiza a fila usando @radix-ui/react-toast.

export type ToastVariant = "success" | "error" | "info" | "warning";

export interface ToastOptions {
  description?: string;
  /** ms; padrão 5s (erros ficam 8s) */
  duration?: number;
  action?: { label: string; onClick: () => void };
}

export interface ToastItem extends ToastOptions {
  id: number;
  title: string;
  variant: ToastVariant;
  open: boolean;
}

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const EMPTY: ToastItem[] = [];

function emit() {
  for (const listener of listeners) listener();
}

function push(variant: ToastVariant, title: string, options?: ToastOptions) {
  const id = nextId++;
  // No máximo 4 visíveis — os mais antigos saem primeiro
  items = [...items.slice(-3), { id, title, variant, open: true, ...options }];
  emit();
  return id;
}

export const toast = {
  success: (title: string, options?: ToastOptions) => push("success", title, options),
  error: (title: string, options?: ToastOptions) =>
    push("error", title, { duration: 8000, ...options }),
  info: (title: string, options?: ToastOptions) => push("info", title, options),
  warning: (title: string, options?: ToastOptions) => push("warning", title, options),
  dismiss(id: number) {
    items = items.map((t) => (t.id === id ? { ...t, open: false } : t));
    emit();
    // Remove depois da animação de saída
    setTimeout(() => {
      items = items.filter((t) => t.id !== id);
      emit();
    }, 200);
  },
};

export function useToasts() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => items,
    () => EMPTY,
  );
}

// Mensagem amigável para erros do Supabase/rede (nunca mostra SQL cru)
export function friendlyError(error: unknown, fallback = "Tente novamente em instantes.") {
  if (!error) return fallback;
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error);
  if (/row-level security|permission denied|not authorized/i.test(message)) {
    return "Você não tem permissão para fazer isso.";
  }
  if (/failed to fetch|network/i.test(message)) {
    return "Sem conexão com o servidor. Verifique sua internet.";
  }
  if (/duplicate key/i.test(message)) {
    return "Já existe um registro com esses dados.";
  }
  return fallback;
}
