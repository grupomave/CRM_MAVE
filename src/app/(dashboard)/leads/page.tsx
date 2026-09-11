import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { LeadsToolbar } from "./leads-toolbar";

const STATUS_LABEL: Record<string, string> = {
  new: "Novo",
  contacted: "Contatado",
  qualified: "Qualificado",
  disqualified: "Desqualificado",
  converted: "Convertido",
};

export default async function LeadsPage() {
  const supabase = await createClient();
  const { data: leads } = await supabase
    .from("leads")
    .select("id, name, contact_info, source, status, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Leads</h1>
          <p className="text-sm text-muted-foreground">
            Caixa de entrada de leads não qualificados
          </p>
        </div>
        <LeadsToolbar />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Nome</th>
              <th className="p-3">Contato</th>
              <th className="p-3">Origem</th>
              <th className="p-3">Status</th>
              <th className="p-3">Criado em</th>
            </tr>
          </thead>
          <tbody>
            {(leads ?? []).map((lead) => (
              <tr key={lead.id} className="border-t border-border">
                <td className="p-3 font-medium">{lead.name}</td>
                <td className="p-3 text-muted-foreground">
                  {lead.contact_info ?? "—"}
                </td>
                <td className="p-3 text-muted-foreground">
                  {lead.source ?? "—"}
                </td>
                <td className="p-3">
                  <Badge variant={lead.status === "converted" ? "success" : "default"}>
                    {STATUS_LABEL[lead.status] ?? lead.status}
                  </Badge>
                </td>
                <td className="p-3 text-muted-foreground">
                  {new Date(lead.created_at).toLocaleDateString("pt-BR")}
                </td>
              </tr>
            ))}
            {(leads ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  Nenhum lead na caixa de entrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
