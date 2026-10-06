"use client";

import { useRef, useState } from "react";
import { SearchCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { fetchCnpjData, type CnpjData } from "@/lib/cnpj";
import { isValidCNPJ, onlyDigits } from "@/lib/masks";
import { toast } from "@/lib/toast";

/**
 * Consulta de CNPJ na web (Receita Federal) para os formulários de organização.
 * `autoLookup` dispara sozinho quando o CNPJ digitado fica completo e válido;
 * `lookup` é o clique manual no botão.
 */
export function useCnpjLookup(onData: (data: CnpjData) => void) {
  const [loading, setLoading] = useState(false);
  const lastDigits = useRef("");

  async function lookup(cnpj: string | null | undefined) {
    const digits = onlyDigits(cnpj);
    if (digits.length !== 14) {
      toast.warning("Digite os 14 dígitos do CNPJ para consultar");
      return;
    }
    if (!isValidCNPJ(digits)) {
      toast.error("CNPJ inválido — confira os dígitos");
      return;
    }
    setLoading(true);
    try {
      const data = await fetchCnpjData(digits);
      lastDigits.current = digits;
      onData(data);
      const inactive = data.status && data.status !== "ATIVA";
      if (inactive) {
        toast.warning("Dados preenchidos, mas o CNPJ não está ativo", {
          description: `Situação cadastral: ${data.status}.`,
        });
      } else {
        toast.success("Dados preenchidos pela Receita Federal", {
          description: "Confira as informações antes de salvar.",
        });
      }
    } catch (err) {
      toast.error("Não foi possível consultar o CNPJ", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }

  function autoLookup(cnpj: string | null | undefined) {
    const digits = onlyDigits(cnpj);
    if (digits.length === 14 && isValidCNPJ(digits) && digits !== lastDigits.current && !loading) {
      void lookup(digits);
    }
  }

  return { lookup, autoLookup, loading };
}

export function CnpjLookupButton({
  onClick,
  loading,
}: {
  onClick: () => void;
  loading: boolean;
}) {
  return (
    <SimpleTooltip content="Consultar CNPJ na Receita Federal">
      <Button
        type="button"
        variant="secondary"
        size="icon"
        loading={loading}
        onClick={onClick}
        aria-label="Consultar CNPJ na Receita Federal"
      >
        <SearchCheck />
      </Button>
    </SimpleTooltip>
  );
}
