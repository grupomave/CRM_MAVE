"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Download, Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
import { uniqueSuffix } from "@/lib/utils";
import type { EntityType } from "@/lib/supabase/types";

export const DOCUMENT_CATEGORIES = [
  "Contrato",
  "Apólice",
  "Proposta",
  "Nota Fiscal",
  "Documentação Legal",
  "Outro",
];

export interface EntityAttachment {
  id: string;
  file_name: string;
  storage_path: string;
  size_bytes: number;
  created_at: string;
  category: string | null;
  expires_at: string | null;
}

export function EntityFilesTab({
  entityType,
  entityId,
  attachments,
}: {
  entityType: EntityType;
  entityId: string;
  attachments: EntityAttachment[];
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>("none");
  const [expiresAt, setExpiresAt] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setUploadError("Sessão expirada.");
      setUploading(false);
      return;
    }

    const storagePath = `${entityType}/${entityId}/${uniqueSuffix()}-${file.name}`;
    const { error: uploadErr } = await supabase.storage
      .from("attachments")
      .upload(storagePath, file);

    if (uploadErr) {
      setUploadError(
        "Falha no upload. Verifique se o bucket 'attachments' existe no Supabase Storage.",
      );
      setUploading(false);
      return;
    }

    await supabase.from("attachments").insert({
      entity_type: entityType,
      entity_id: entityId,
      file_name: file.name,
      storage_path: storagePath,
      size_bytes: file.size,
      uploaded_by: user.id,
      category: category === "none" ? null : category,
      expires_at: expiresAt || null,
    });

    setUploading(false);
    setCategory("none");
    setExpiresAt("");
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  async function download(path: string, name: string) {
    const { data } = await supabase.storage.from("attachments").createSignedUrl(path, 60);
    if (data?.signedUrl) {
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = name;
      a.click();
    }
  }

  const now = new Date();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">Categoria</label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem categoria</SelectItem>
              {DOCUMENT_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">Validade (opcional)</label>
          <Input
            type="date"
            className="w-40"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </div>
        <input
          ref={inputRef}
          type="file"
          onChange={onFileChange}
          disabled={uploading}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="size-4" />
          {uploading ? "Enviando..." : "Anexar arquivo"}
        </Button>
      </div>
      {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
      <div className="flex flex-col gap-2">
        {attachments.map((a) => {
          const expired = a.expires_at && new Date(a.expires_at) < now;
          const expiringSoon =
            a.expires_at && !expired && new Date(a.expires_at).getTime() - now.getTime() < 30 * 86400000;
          return (
            <Card key={a.id}>
              <CardContent className="flex items-center justify-between p-3">
                <span className="flex flex-wrap items-center gap-2 text-sm">
                  <Paperclip className="size-4 text-muted-foreground" />
                  {a.file_name}
                  <span className="text-xs text-muted-foreground">
                    ({Math.round(a.size_bytes / 1024)} KB)
                  </span>
                  {a.category && <Badge variant="outline">{a.category}</Badge>}
                  {a.expires_at && (
                    <Badge variant={expired ? "destructive" : expiringSoon ? "warning" : "outline"}>
                      Válido até {new Date(a.expires_at).toLocaleDateString("pt-BR")}
                    </Badge>
                  )}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => download(a.storage_path, a.file_name)}
                >
                  <Download className="size-4" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
        {attachments.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum arquivo anexado.</p>
        )}
      </div>
    </div>
  );
}
