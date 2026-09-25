"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Campo de busca com debounce: o valor digitado aparece na hora, mas a URL
// (e o filtro) só é atualizada depois de uma pausa na digitação.
export function SearchInput({
  value,
  onChange,
  placeholder = "Buscar...",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  const lastSent = useRef(value);

  // Sincroniza quando o valor muda por fora (ex.: "Limpar filtros")
  useEffect(() => {
    if (value !== lastSent.current) {
      lastSent.current = value;
      setDraft(value);
    }
  }, [value]);

  useEffect(() => {
    if (draft === lastSent.current) return;
    const timeout = setTimeout(() => {
      lastSent.current = draft;
      onChange(draft);
    }, 250);
    return () => clearTimeout(timeout);
  }, [draft, onChange]);

  return (
    <div className={cn("relative w-full sm:w-72", className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="pl-9 pr-8 [&::-webkit-search-cancel-button]:hidden"
      />
      {draft && (
        <button
          type="button"
          aria-label="Limpar busca"
          onClick={() => {
            setDraft("");
            lastSent.current = "";
            onChange("");
          }}
          className="absolute right-2 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export interface FilterOption {
  value: string;
  label: string;
}

// Select de filtro: valor vazio = "todos" (sem parâmetro na URL)
export function FilterSelect({
  value,
  onChange,
  options,
  allLabel,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  allLabel: string;
  label: string;
  className?: string;
}) {
  const ALL = "__all__";
  return (
    <Select value={value || ALL} onValueChange={(v) => onChange(v === ALL ? "" : v)}>
      <SelectTrigger
        aria-label={label}
        className={cn("w-full sm:w-44", value && "border-primary/50 bg-primary-subtle/40", className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Botão-alternador de filtro booleano (ex.: "Só com negócios abertos")
export function FilterToggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-caption font-medium transition-colors [&_svg]:size-3.5",
        active
          ? "border-primary/50 bg-primary-subtle text-primary"
          : "border-input bg-card text-muted-foreground hover:border-border-strong hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

// Barra de filtros padrão: busca à esquerda, filtros, e ações à direita
export function ListToolbar({
  search,
  filters,
  actions,
}: {
  search: React.ReactNode;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {search}
        {filters}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
