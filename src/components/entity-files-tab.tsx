"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileArchive, Paperclip, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { DateInput } from "@/components/ui/masked-inputs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ZipProgressDialog } from "@/components/zip-progress-dialog";
import { createClient } from "@/lib/supabase/client";
import { friendlyError, toast } from "@/lib/toast";
import { formatDate, uniqueSuffix } from "@/lib/utils";
import {
  downloadAttachment,
  formatBytes,
  useZipDownload,
  zipFileName,
} from "@/lib/attachments-download";
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

const NONE = "__none__";

function startOfTodayMs() {
  return Date.parse(new Date().toISOString().slice(0, 10));
}

export function EntityFilesTab({
  entityType,
  entityId,
  entityName,
  attachments,
}: {
  entityType: EntityType;
  entityId: string;
  /** Usado no nome do .zip: anexos_<nome>_AAAA-MM-DD.zip */
  entityName?: string;
  attachments: EntityAttachment[];
}) {
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState<string>(NONE);
  const [expiresAt, setExpiresAt] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const zip = useZipDownload();

  // Seleção só com anexos que ainda existem (após refresh/exclusão)
  const selectedFiles = useMemo(() => attachments.filter((a) => selected.has(a.id)), [attachments, selected]);
  const allChecked: boolean | "indeterminate" =
    selectedFiles.length === 0 ? false : selectedFiles.length === attachments.length ? true : "indeterminate";
  const selectedBytes = selectedFiles.reduce((s, a) => s + a.size_bytes, 0);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast.error("Sua sessão expirou", { description: "Entre novamente para continuar." });
      setUploading(false);
      return;
    }

    const storagePath = `${entityType}/${entityId}/${uniqueSuffix()}-${file.name}`;
    const { error: uploadErr } = await supabase.storage.from("attachments").upload(storagePath, file);

    if (uploadErr) {
      toast.error("Falha no envio do arquivo", { description: friendlyError(uploadErr) });
      setUploading(false);
      return;
    }

    const { error: insertErr } = await supabase.from("attachments").insert({
      entity_type: entityType,
      entity_id: entityId,
      file_name: file.name,
      storage_path: storagePath,
      size_bytes: file.size,
      uploaded_by: user.id,
      category: category === NONE ? null : category,
      expires_at: expiresAt || null,
    });

    setUploading(false);
    if (insertErr) {
      toast.error("O arquivo foi enviado, mas não foi registrado", { description: friendlyError(insertErr) });
      return;
    }
    toast.success("Arquivo anexado", { description: file.name });
    setCategory(NONE);
    setExpiresAt("");
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const zipName = zipFileName("anexos", entityName);
  const now = startOfTodayMs();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-border p-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`file-category-${entityId}`} className="text-caption font-medium text-muted-foreground">
            Categoria
          </label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger id={`file-category-${entityId}`} className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Sem categoria</SelectItem>
              {DOCUMENT_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`file-expires-${entityId}`} className="text-caption font-medium text-muted-foreground">
            Validade (opcional)
          </label>
          <DateInput id={`file-expires-${entityId}`} className="w-40" value={expiresAt} onValueChange={setExpiresAt} />
        </div>
        <input ref={inputRef} type="file" onChange={onFileChange} disabled={uploading} className="hidden" />
        <Button type="button" variant="secondary" loading={uploading} onClick={() => inputRef.current?.click()}>
          {!uploading && <Upload />}
          {uploading ? "Enviando..." : "Anexar arquivo"}
        </Button>
      </div>

      {attachments.length === 0 ? (
        <EmptyState
          compact
          icon={Paperclip}
          title="Nenhum arquivo anexado"
          description="Contratos, propostas e documentos enviados aqui ficam disponíveis também em Documentos."
        />
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox
                checked={allChecked}
                onCheckedChange={(checked) =>
                  setSelected(checked === true ? new Set(attachments.map((a) => a.id)) : new Set())
                }
                aria-label="Selecionar todos os arquivos"
              />
              {selectedFiles.length > 0
                ? `${selectedFiles.length} de ${attachments.length} · ${formatBytes(selectedBytes)}`
                : "Selecionar todos"}
            </label>
            <div className="ml-auto flex flex-wrap gap-2">
              {selectedFiles.length > 0 && (
                <Button
                  size="sm"
                  disabled={zip.busy}
                  onClick={() => zip.start(selectedFiles, zipName)}
                >
                  <FileArchive />
                  Baixar selecionados
                </Button>
              )}
              <Button
                size="sm"
                variant="secondary"
                disabled={zip.busy}
                onClick={() => zip.start(attachments, zipName)}
              >
                <Download />
                Baixar todos (.zip)
              </Button>
            </div>
          </div>

          <ul className="divide-y divide-border rounded-md border border-border">
            {attachments.map((a) => {
              const expiresMs = a.expires_at ? Date.parse(a.expires_at) : null;
              const expired = expiresMs !== null && expiresMs < now;
              const expiringSoon = expiresMs !== null && !expired && expiresMs - now < 30 * 86400000;
              const checked = selected.has(a.id);
              return (
                <li
                  key={a.id}
                  className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/50 data-[checked=true]:bg-primary-subtle/60"
                  data-checked={checked}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => toggle(a.id, v === true)}
                    aria-label={`Selecionar ${a.file_name}`}
                  />
                  <Paperclip className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium text-foreground" title={a.file_name}>
                      {a.file_name}
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5 text-caption text-muted-foreground">
                      <span className="numeric">{formatBytes(a.size_bytes)}</span>
                      <span aria-hidden>·</span>
                      <span className="numeric">{formatDate(a.created_at)}</span>
                      {a.category && <Badge variant="neutral">{a.category}</Badge>}
                      {a.expires_at && (
                        <Badge variant={expired ? "destructive" : expiringSoon ? "warning" : "neutral"}>
                          {expired ? "Venceu em" : "Válido até"} {formatDate(`${a.expires_at}T12:00:00`)}
                        </Badge>
                      )}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Baixar ${a.file_name}`}
                    onClick={() => downloadAttachment(a)}
                  >
                    <Download />
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <ZipProgressDialog progress={zip.progress} onCancel={zip.cancel} />
    </div>
  );
}
