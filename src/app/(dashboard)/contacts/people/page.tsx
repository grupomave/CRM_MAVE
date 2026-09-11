import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PeopleToolbar } from "./people-toolbar";

export default async function PeoplePage() {
  const supabase = await createClient();
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, name, email, phone, organizations ( name )")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Pessoas</h1>
          <p className="text-sm text-muted-foreground">Contatos individuais</p>
        </div>
        <PeopleToolbar />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Nome</th>
              <th className="p-3">E-mail</th>
              <th className="p-3">Telefone</th>
              <th className="p-3">Organização</th>
            </tr>
          </thead>
          <tbody>
            {(contacts ?? []).map((c: any) => (
              <tr key={c.id} className="border-t border-border">
                <td className="p-3 font-medium">
                  <Link href={`/contacts/people/${c.id}`} className="hover:underline">
                    {c.name}
                  </Link>
                </td>
                <td className="p-3 text-muted-foreground">{c.email ?? "—"}</td>
                <td className="p-3 text-muted-foreground">{c.phone ?? "—"}</td>
                <td className="p-3 text-muted-foreground">
                  {c.organizations?.name ?? "—"}
                </td>
              </tr>
            ))}
            {(contacts ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-muted-foreground">
                  Nenhum contato cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
