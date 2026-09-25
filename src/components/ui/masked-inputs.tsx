"use client";

import * as React from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  dateBRToIso,
  onlyDigits,
  formatMoneyInput,
  isoToDateBR,
  maskCEP,
  maskCNPJ,
  maskCPF,
  maskCpfCnpj,
  maskDateBR,
  maskMoneyInput,
  maskPhoneBR,
  parseMoneyInput,
} from "@/lib/masks";
import { fieldClasses, Input } from "./input";

const MASKS = {
  cpf: { fn: maskCPF, placeholder: "000.000.000-00", inputMode: "numeric" },
  cnpj: { fn: maskCNPJ, placeholder: "00.000.000/0000-00", inputMode: "numeric" },
  "cpf-cnpj": { fn: maskCpfCnpj, placeholder: "CPF ou CNPJ", inputMode: "numeric" },
  phone: { fn: maskPhoneBR, placeholder: "(00) 00000-0000", inputMode: "tel" },
  cep: { fn: maskCEP, placeholder: "00000-000", inputMode: "numeric" },
} as const;

export type MaskKind = keyof typeof MASKS;

// Input com máscara brasileira. Compatível com react-hook-form via
// `register` (o valor salvo já vem formatado, como o restante do sistema).
export const MaskedInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<"input">, "ref"> & { mask: MaskKind }
>(function MaskedInput({ mask, onChange, placeholder, ...props }, ref) {
  const config = MASKS[mask];
  return (
    <Input
      ref={ref}
      inputMode={config.inputMode}
      placeholder={placeholder ?? config.placeholder}
      autoComplete="off"
      {...props}
      onChange={(e) => {
        e.target.value = config.fn(e.target.value);
        onChange?.(e);
      }}
    />
  );
});

// Valor em R$ com digitação da direita para a esquerda (centavos primeiro).
export function CurrencyInput({
  value,
  onValueChange,
  onCommit,
  className,
  inputClassName,
  id,
  ...props
}: Omit<React.ComponentProps<"input">, "value" | "onChange" | "defaultValue"> & {
  value: number | null;
  onValueChange?: (value: number | null) => void;
  /** Chamado ao sair do campo ou teclar Enter (salvar inline) */
  onCommit?: (value: number | null) => void;
  inputClassName?: string;
}) {
  const [text, setText] = React.useState(formatMoneyInput(value));
  const committed = React.useRef(value);

  React.useEffect(() => {
    if (value !== committed.current) {
      committed.current = value;
      setText(formatMoneyInput(value));
    }
  }, [value]);

  function commit() {
    const parsed = parseMoneyInput(text);
    if (parsed !== committed.current) {
      committed.current = parsed;
      onCommit?.(parsed);
    }
  }

  function applyDigits(digits: string) {
    const masked = maskMoneyInput(digits);
    setText(masked);
    onValueChange?.(parseMoneyInput(masked));
  }

  // O cursor fica sempre no fim: os dígitos entram pela direita (centavos)
  function caretToEnd(input: HTMLInputElement) {
    requestAnimationFrame(() => {
      const end = input.value.length;
      input.setSelectionRange(end, end);
    });
  }

  return (
    <div className={cn("relative", className)}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        R$
      </span>
      <input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        placeholder="0,00"
        {...props}
        value={text}
        // Digitação controlada no teclado: independe da posição do cursor
        // (antes, clicar à esquerda do texto inseria dígitos no meio do
        // valor — "1234567" virava "12.300.045,67").
        onKeyDown={(e) => {
          const input = e.currentTarget;
          const digits = onlyDigits(text);
          const allSelected =
            input.selectionStart === 0 && input.selectionEnd === input.value.length && input.value.length > 0;
          if (/^\d$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            applyDigits(allSelected ? e.key : digits + e.key);
            caretToEnd(input);
          } else if (e.key === "Backspace" || e.key === "Delete") {
            e.preventDefault();
            applyDigits(allSelected ? "" : digits.slice(0, -1));
            caretToEnd(input);
          } else if (e.key === "Enter" && onCommit) {
            e.preventDefault();
            commit();
          }
          props.onKeyDown?.(e);
        }}
        onPaste={(e) => {
          e.preventDefault();
          const pasted = parsePastedMoney(e.clipboardData.getData("text"));
          if (pasted !== null) {
            setText(formatMoneyInput(pasted));
            onValueChange?.(pasted);
          }
          caretToEnd(e.currentTarget);
        }}
        // Reserva para teclados virtuais que não informam a tecla
        onChange={(e) => applyDigits(e.target.value)}
        onFocus={(e) => {
          caretToEnd(e.currentTarget);
          props.onFocus?.(e);
        }}
        onMouseUp={(e) => {
          if (e.currentTarget.selectionStart === e.currentTarget.selectionEnd) caretToEnd(e.currentTarget);
          props.onMouseUp?.(e);
        }}
        onBlur={(e) => {
          commit();
          props.onBlur?.(e);
        }}
        className={cn(fieldClasses, "numeric flex h-9 pl-9 pr-3 text-right", inputClassName)}
      />
    </div>
  );
}

// Colar "1.234,56", "1234,56", "1234.56" ou "1500" (reais inteiros)
function parsePastedMoney(raw: string): number | null {
  const clean = raw.replace(/[^\d.,]/g, "");
  if (!clean) return null;
  const lastSep = Math.max(clean.lastIndexOf(","), clean.lastIndexOf("."));
  const decimals = lastSep >= 0 ? clean.length - lastSep - 1 : 0;
  if (lastSep >= 0 && decimals > 0 && decimals <= 2) {
    const int = onlyDigits(clean.slice(0, lastSep));
    const dec = clean.slice(lastSep + 1).padEnd(2, "0");
    return Number(`${int || "0"}.${dec}`);
  }
  const n = Number(onlyDigits(clean));
  return Number.isFinite(n) ? n : null;
}

// Data dd/mm/aaaa digitável + botão que abre o calendário nativo.
// Recebe e devolve ISO (aaaa-mm-dd) ou "" quando vazio.
export function DateInput({
  value,
  onValueChange,
  className,
  id,
  disabled,
  "aria-invalid": ariaInvalid,
  ...props
}: Omit<React.ComponentProps<"input">, "value" | "onChange" | "defaultValue"> & {
  value: string | null;
  onValueChange: (iso: string) => void;
}) {
  const [text, setText] = React.useState(isoToDateBR(value));
  const [invalid, setInvalid] = React.useState(false);
  const lastIso = React.useRef(value ?? "");
  const pickerRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if ((value ?? "") !== lastIso.current) {
      lastIso.current = value ?? "";
      setText(isoToDateBR(value));
      setInvalid(false);
    }
  }, [value]);

  function emit(iso: string) {
    lastIso.current = iso;
    onValueChange(iso);
  }

  return (
    <div className={cn("relative", className)}>
      <input
        id={id}
        inputMode="numeric"
        placeholder="dd/mm/aaaa"
        autoComplete="off"
        disabled={disabled}
        aria-invalid={ariaInvalid ?? (invalid || undefined)}
        {...props}
        value={text}
        onChange={(e) => {
          const masked = maskDateBR(e.target.value);
          setText(masked);
          const iso = dateBRToIso(masked);
          if (iso !== null) {
            setInvalid(false);
            if (iso !== lastIso.current) emit(iso);
          }
        }}
        onBlur={(e) => {
          setInvalid(dateBRToIso(text) === null);
          props.onBlur?.(e);
        }}
        className={cn(fieldClasses, "numeric flex h-9 pl-3 pr-9")}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        aria-label="Abrir calendário"
        onClick={() => pickerRef.current?.showPicker?.()}
        className="absolute right-1 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <CalendarDays className="size-4" />
      </button>
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-0 size-0 opacity-0"
        value={value ?? ""}
        onChange={(e) => {
          setText(isoToDateBR(e.target.value));
          setInvalid(false);
          emit(e.target.value);
        }}
      />
      {invalid && (
        <p className="mt-1 text-caption text-destructive" role="alert">
          Data inválida. Use dd/mm/aaaa.
        </p>
      )}
    </div>
  );
}
