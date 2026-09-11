import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OrganizationsToolbar } from "./organizations-toolbar";

export default async function OrganizationsPage() {
  const supabase = await createClient();
  const { data: organizations } = await supabase
    .from("organizations")
    .select("id, name, cnpj, sector")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Organizações</h1>
          <p className="text-sm text-muted-foreground">Empresas clientes e prospects</p>
        </div>
        <OrganizationsToolbar />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Nome</th>
              <th className="p-3">CNPJ</th>
              <th className="p-3">Setor</th>
            </tr>
          </thead>
          <tbody>
            {(organizations ?? []).map((o) => (
              <tr key={o.id} className="border-t border-border">
                <td className="p-3 font-medium">
                  <Link
                    href={`/contacts/organizations/${o.id}`}
                    className="hover:underline"
                  >
                    {o.name}
                  </Link>
                </td>
                <td className="p-3 text-muted-foreground">{o.cnpj ?? "—"}</td>
                <td className="p-3 text-muted-foreground">{o.sector ?? "—"}</td>
              </tr>
            ))}
            {(organizations ?? []).length === 0 && (
              <tr>
                <td colSpan={3} className="p-6 text-center text-muted-foreground">
                  Nenhuma organização cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
