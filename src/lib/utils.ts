import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// O tailwind-merge precisa conhecer os tamanhos de fonte do design system
// (globals.css). Sem isso ele trata "text-caption" como COR e, ao combinar
// com "text-primary-foreground", descarta uma das duas (ex.: botão pequeno
// perdia a cor do texto; badge perdia o tamanho da fonte).
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["micro", "caption", "body", "subtitle", "title", "display"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrencyBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatDate(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export function uniqueSuffix() {
  return Date.now();
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
