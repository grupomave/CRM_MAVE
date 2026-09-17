"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LeadStatus } from "@/lib/supabase/types";

const STATUS_LABEL: Record<string, string> = {
  new: "Novo",
  contacted: "Contatado",
  qualified: "Qualificado",
  disqualified: "Desqualificado",
  converted: "Convertido",
};

export interface LeadRow {
  id: string;
  name: string;
  contact_info: string | null;
  source: string | null;
  status: LeadStatus;
  created_at: string;
}

export function LeadsList({ leads }: { leads: LeadRow[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (status !== "all" && l.status !== status) return false;
      if (!term) return true;
      const haystack = `${l.name} ${l.contact_info ?? ""} ${l.source ?? ""}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [leads, search, status]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar por nome, contato ou origem..."
          className="max-w-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          {filtered.length} de {leads.length}
        </span>
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
            {filtered.map((lead) => (
              <tr key={lead.id} className="border-t border-border">
                <td className="p-3 font-medium">
                  <Link href={`/leads/${lead.id}`} className="hover:underline">
                    {lead.name}
                  </Link>
                </td>
                <td className="p-3 text-muted-foreground">
                  {lead.contact_info ?? "—"}
                </td>
                <td className="p-3 text-muted-foreground">{lead.source ?? "—"}</td>
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
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  {leads.length === 0
                    ? "Nenhum lead na caixa de entrada."
                    : "Nenhum lead encontrado para esse filtro."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
