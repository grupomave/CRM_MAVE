"use client"; // Error boundaries precisam ser Client Components

import { useEffect } from "react";
import { RotateCcw, ServerCrash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPage } from "@/components/status-page";

// Erros fora do app logado (login, recuperação de senha)
export default function RootError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusPage
      standalone
      code="Erro 500"
      icon={ServerCrash}
      title="Algo deu errado"
      description="Não foi possível carregar esta página. Tente novamente em instantes."
      actions={
        <Button onClick={() => retry()}>
          <RotateCcw />
          Tentar novamente
        </Button>
      }
    />
  );
}
