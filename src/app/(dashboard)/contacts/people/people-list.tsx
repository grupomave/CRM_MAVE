"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { WhatsAppButton } from "@/components/whatsapp-button";

export interface PersonRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  organizations: { name: string } | null;
}

export function PeopleList({ contacts }: { contacts: PersonRow[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return contacts;
    return contacts.filter((c) => {
      const haystack = `${c.name} ${c.email ?? ""} ${c.phone ?? ""} ${c.organizations?.name ?? ""}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [contacts, search]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Buscar por nome, e-mail, telefone ou organização..."
          className="max-w-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="text-xs text-muted-foreground">
          {filtered.length} de {contacts.length}
        </span>
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
            {filtered.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="p-3 font-medium">
                  <Link href={`/contacts/people/${c.id}`} className="hover:underline">
                    {c.name}
                  </Link>
                </td>
                <td className="p-3 text-muted-foreground">{c.email ?? "—"}</td>
                <td className="p-3 text-muted-foreground">
                  <span className="flex items-center gap-1">
                    {c.phone ?? c.whatsapp ?? "—"}
                    <WhatsAppButton phone={c.whatsapp ?? c.phone} contactId={c.id} />
                  </span>
                </td>
                <td className="p-3 text-muted-foreground">
                  {c.organizations?.name ?? "—"}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-muted-foreground">
                  {contacts.length === 0
                    ? "Nenhum contato cadastrado."
                    : "Nenhum contato encontrado para essa busca."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
