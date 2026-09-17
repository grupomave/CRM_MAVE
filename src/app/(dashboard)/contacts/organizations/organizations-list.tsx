"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";

export interface OrganizationRow {
  id: string;
  name: string;
  cnpj: string | null;
  sector: string | null;
}

export function OrganizationsList({ organizations }: { organizations: OrganizationRow[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return organizations;
    return organizations.filter((o) => {
      const haystack = `${o.name} ${o.cnpj ?? ""} ${o.sector ?? ""}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [organizations, search]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Buscar por nome, CNPJ ou setor..."
          className="max-w-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="text-xs text-muted-foreground">
          {filtered.length} de {organizations.length}
        </span>
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
            {filtered.map((o) => (
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
            {filtered.length === 0 && (
              <tr>
                <td colSpan={3} className="p-6 text-center text-muted-foreground">
                  {organizations.length === 0
                    ? "Nenhuma organização cadastrada."
                    : "Nenhuma organização encontrada para essa busca."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
