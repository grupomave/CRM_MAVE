import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPage } from "@/components/status-page";

// Registro inexistente ou sem permissão (a RLS devolve "nada" nesses casos,
// então não dá para distinguir — a mensagem cobre os dois).
export default function DashboardNotFound() {
  return (
    <StatusPage
      code="Erro 404"
      icon={SearchX}
      title="Registro não encontrado"
      description="Ele pode ter sido excluído, ou você não tem permissão para visualizá-lo."
      actions={
        <>
          <Button variant="secondary" asChild>
            <Link href="/pipeline">Ver negócios</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard">Ir para o Dashboard</Link>
          </Button>
        </>
      }
    />
  );
}
