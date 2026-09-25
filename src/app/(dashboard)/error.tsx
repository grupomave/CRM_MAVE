"use client"; // Error boundaries precisam ser Client Components

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw, ServerCrash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPage } from "@/components/status-page";

export default function DashboardError({
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
      code="Erro 500"
      icon={ServerCrash}
      title="Algo deu errado ao carregar esta tela"
      description={
        <>
          Tente novamente em instantes. Se o problema continuar, avise o suporte
          {error.digest ? (
            <>
              {" "}informando o código <span className="numeric font-medium text-foreground">{error.digest}</span>
            </>
          ) : null}
          .
        </>
      }
      actions={
        <>
          <Button variant="secondary" asChild>
            <Link href="/dashboard">Ir para o Dashboard</Link>
          </Button>
          <Button onClick={() => retry()}>
            <RotateCcw />
            Tentar novamente
          </Button>
        </>
      }
    />
  );
}
