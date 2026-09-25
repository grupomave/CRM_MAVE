import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPage } from "@/components/status-page";

export const metadata = { title: "Página não encontrada" };

export default function NotFound() {
  return (
    <StatusPage
      standalone
      code="Erro 404"
      icon={Compass}
      title="Página não encontrada"
      description="O endereço pode ter sido digitado errado ou a página não existe mais."
      actions={
        <Button asChild>
          <Link href="/dashboard">Ir para o Dashboard</Link>
        </Button>
      }
    />
  );
}
