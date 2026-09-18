"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { formatCurrencyBRL } from "@/lib/utils";

export interface OrganizationRow {
  id: string;
  name: string;
  cnpj: string | null;
  sector: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  ownerName: string | null;
  contactsCount: number;
  openDealsCount: number;
  openDealsValue: number;
  wonDealsValue: number;
}

export function OrganizationsList({ organizations }: { organizations: OrganizationRow[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return organizations;
    return organizations.filter((o) => {
      const haystack = `${o.name} ${o.cnpj ?? ""} ${o.sector ?? ""} ${o.city ?? ""} ${o.state ?? ""} ${o.ownerName ?? ""}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [organizations, search]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Buscar por nome, CNPJ, setor, cidade ou responsável..."
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
              <th className="p-3">Setor</th>
              <th className="p-3">Cidade/UF</th>
              <th className="p-3">Telefone</th>
              <th className="p-3">Responsável</th>
              <th className="p-3">Contatos</th>
              <th className="p-3">Negócios abertos</th>
              <th className="p-3">Ganho (total)</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.id} className="border-t border-border hover:bg-muted/40">
                <td className="p-3">
                  <Link
                    href={`/contacts/organizations/${o.id}`}
                    className="flex items-center gap-2 font-medium hover:underline"
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {o.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="flex flex-col">
                      {o.name}
                      {o.cnpj && (
                        <span className="text-xs font-normal text-muted-foreground">
                          {o.cnpj}
                        </span>
                      )}
                    </span>
                  </Link>
                </td>
                <td className="p-3 text-muted-foreground">{o.sector ?? "—"}</td>
                <td className="p-3 text-muted-foreground">
                  {o.city ? `${o.city}${o.state ? `/${o.state}` : ""}` : "—"}
                </td>
                <td className="p-3 text-muted-foreground">
                  <span className="flex items-center gap-1">
                    {o.phone ?? "—"}
                    {o.phone && <WhatsAppButton phone={o.phone} />}
                  </span>
                </td>
                <td className="p-3 text-muted-foreground">{o.ownerName ?? "—"}</td>
                <td className="p-3 text-muted-foreground">{o.contactsCount}</td>
                <td className="p-3">
                  {o.openDealsCount > 0 ? (
                    <span className="flex items-center gap-1.5">
                      <Badge variant="outline">{o.openDealsCount}</Badge>
                      <span className="text-muted-foreground">
                        {formatCurrencyBRL(o.openDealsValue)}
                      </span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="p-3 text-muted-foreground">
                  {o.wonDealsValue > 0 ? formatCurrencyBRL(o.wonDealsValue) : "—"}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-muted-foreground">
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
