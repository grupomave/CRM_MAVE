"use client";

import { useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { DOCUMENT_CATEGORIES } from "@/components/entity-files-tab";

export interface DocumentRow {
  id: string;
  file_name: string;
  storage_path: string;
  size_bytes: number;
  created_at: string;
  category: string | null;
  expires_at: string | null;
  entity_type: string;
  entity_name: string;
  entity_href: string;
}

const ENTITY_LABEL: Record<string, string> = {
  deal: "Negócio",
  contact: "Contato",
  organization: "Organização",
};

export function DocumentsList({ documents }: { documents: DocumentRow[] }) {
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("all");
  const [category, setCategory] = useState("all");
  const [onlyExpiring, setOnlyExpiring] = useState(false);
  const supabase = createClient();

  const now = new Date();
  const term = search.trim().toLowerCase();
  const filtered = documents.filter((d) => {
    if (term && !`${d.file_name} ${d.entity_name}`.toLowerCase().includes(term)) return false;
    if (entityType !== "all" && d.entity_type !== entityType) return false;
    if (category !== "all" && d.category !== category) return false;
    if (onlyExpiring) {
      if (!d.expires_at) return false;
      const daysLeft = (new Date(d.expires_at).getTime() - now.getTime()) / 86400000;
      if (daysLeft > 30) return false;
    }
    return true;
  });

  async function download(path: string, name: string) {
    const { data } = await supabase.storage.from("attachments").createSignedUrl(path, 60);
    if (data?.signedUrl) {
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = name;
      a.click();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar por nome do arquivo ou registro..."
          className="w-64"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={entityType} onValueChange={setEntityType}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="deal">Negócios</SelectItem>
            <SelectItem value="contact">Contatos</SelectItem>
            <SelectItem value="organization">Organizações</SelectItem>
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {DOCUMENT_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button type="button" onClick={() => setOnlyExpiring((v) => !v)}>
          <Badge variant={onlyExpiring ? "warning" : "outline"} className="cursor-pointer">
            Vencendo em 30 dias
          </Badge>
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Arquivo</th>
              <th className="p-3">Categoria</th>
              <th className="p-3">Vinculado a</th>
              <th className="p-3">Validade</th>
              <th className="p-3">Enviado em</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => {
              const expired = d.expires_at && new Date(d.expires_at) < now;
              const expiringSoon =
                d.expires_at &&
                !expired &&
                new Date(d.expires_at).getTime() - now.getTime() < 30 * 86400000;
              return (
                <tr key={d.id} className="border-t border-border">
                  <td className="p-3 font-medium">{d.file_name}</td>
                  <td className="p-3 text-muted-foreground">{d.category ?? "—"}</td>
                  <td className="p-3">
                    <Link href={d.entity_href} className="text-primary hover:underline">
                      {ENTITY_LABEL[d.entity_type] ?? d.entity_type}: {d.entity_name}
                    </Link>
                  </td>
                  <td className="p-3">
                    {d.expires_at ? (
                      <Badge variant={expired ? "destructive" : expiringSoon ? "warning" : "outline"}>
                        {new Date(d.expires_at).toLocaleDateString("pt-BR")}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {new Date(d.created_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="p-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => download(d.storage_path, d.file_name)}
                    >
                      <Download className="size-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  Nenhum documento encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
