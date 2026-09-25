"use client";

import * as React from "react";
import { Command } from "cmdk";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { normalize } from "@/lib/filters/params";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { fieldClasses } from "./input";

export interface ComboboxOption {
  value: string;
  label: string;
  description?: string | null;
}

const MAX_VISIBLE = 80;

// Select com busca — para listas longas (organizações, pessoas). Renderiza
// no máximo 80 opções por vez para continuar leve com milhares de itens.
export function Combobox({
  id,
  value,
  onChange,
  options,
  placeholder = "Selecione...",
  searchPlaceholder = "Buscar...",
  emptyText = "Nada encontrado.",
  allowClear = true,
  disabled,
  className,
  "aria-invalid": ariaInvalid,
}: {
  id?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  allowClear?: boolean;
  disabled?: boolean;
  className?: string;
  "aria-invalid"?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const listId = React.useId();
  const selected = options.find((o) => o.value === value) ?? null;

  const visible = React.useMemo(() => {
    const needle = normalize(query.trim());
    const matches = needle
      ? options.filter((o) => normalize(`${o.label} ${o.description ?? ""}`).includes(needle))
      : options;
    return matches.slice(0, MAX_VISIBLE);
  }, [options, query]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <div className={cn("relative", className)}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-invalid={ariaInvalid}
            disabled={disabled}
            className={cn(
              fieldClasses,
              "flex h-9 items-center justify-between gap-2 px-3 text-left",
              allowClear && selected && "pr-14",
            )}
          >
            <span className={cn("truncate", !selected && "text-muted-foreground")}>
              {selected?.label ?? placeholder}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        {allowClear && selected && !disabled && (
          <button
            type="button"
            aria-label="Limpar seleção"
            onClick={() => onChange(null)}
            className="absolute right-8 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-64 p-0">
        <Command shouldFilter={false}>
          <Command.Input
            value={query}
            onValueChange={setQuery}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-10 w-full border-b border-border bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
          />
          <Command.List id={listId} className="scrollbar-thin max-h-64 overflow-y-auto p-1">
            <Command.Empty className="px-2 py-6 text-center text-sm text-muted-foreground">
              {emptyText}
            </Command.Empty>
            {visible.map((o) => (
              <Command.Item
                key={o.value}
                value={o.value}
                onSelect={() => {
                  onChange(o.value);
                  setOpen(false);
                  setQuery("");
                }}
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm data-[selected=true]:bg-muted"
              >
                <Check
                  className={cn("size-4 shrink-0 text-primary", o.value === value ? "opacity-100" : "opacity-0")}
                />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{o.label}</span>
                  {o.description && (
                    <span className="truncate text-caption text-muted-foreground">{o.description}</span>
                  )}
                </span>
              </Command.Item>
            ))}
            {!query && options.length > MAX_VISIBLE && (
              <p className="px-2 py-2 text-caption text-muted-foreground">
                Digite para buscar entre {options.length.toLocaleString("pt-BR")} opções.
              </p>
            )}
          </Command.List>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
