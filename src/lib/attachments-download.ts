"use client";

import { useCallback, useRef, useState } from "react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { createClient } from "@/lib/supabase/client";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { friendlyError, toast } from "@/lib/toast";

// Downloads de anexos. O bucket "attachments" é privado: todo download passa
// por uma URL assinada, que a policy do Storage só emite se o usuário tiver
// acesso ao registro dono do arquivo (can_access_attachment, migration 0018).

export interface DownloadableFile {
  storage_path: string;
  file_name: string;
  size_bytes: number;
}

const BUCKET = "attachments";
const SIGNED_URL_SECONDS = 300;
const WARN_FILES = 100;
const WARN_BYTES = 200 * 1024 * 1024;
const MAX_BYTES = 1024 * 1024 * 1024;
const CONCURRENCY = 3;

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2).replace(".", ",")} GB`;
}

// "contrato.pdf" repetido vira "contrato (2).pdf", "contrato (3).pdf"...
export function uniqueFileName(name: string, used: Set<string>) {
  const clean = name.replace(/[\\/:*?"<>|]/g, "_").trim() || "arquivo";
  let candidate = clean;
  const dot = clean.lastIndexOf(".");
  const base = dot > 0 ? clean.slice(0, dot) : clean;
  const ext = dot > 0 ? clean.slice(dot) : "";
  let n = 2;
  while (used.has(candidate.toLowerCase())) {
    candidate = `${base} (${n})${ext}`;
    n += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

export function slugify(text: string) {
  return (
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "registro"
  );
}

function todayIso() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function zipFileName(prefix: string, name?: string) {
  return `${prefix}${name ? `_${slugify(name)}` : ""}_${todayIso()}.zip`;
}

// Download individual mantendo nome original e extensão (o parâmetro
// `download` faz o Storage responder com Content-Disposition: attachment).
export async function downloadAttachment(file: Pick<DownloadableFile, "storage_path" | "file_name">) {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(file.storage_path, 60, { download: file.file_name });
  if (error || !data?.signedUrl) {
    toast.error("Não foi possível baixar o arquivo", {
      description: error ? friendlyError(error, "Você não tem acesso a este arquivo ou ele não existe mais.") : undefined,
    });
    return;
  }
  const a = document.createElement("a");
  a.href = data.signedUrl;
  a.download = file.file_name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export type ZipPhase = "idle" | "downloading" | "compressing";

export interface ZipProgress {
  phase: ZipPhase;
  done: number;
  total: number;
  percent: number;
  zipName: string;
}

const IDLE: ZipProgress = { phase: "idle", done: 0, total: 0, percent: 0, zipName: "" };

export function useZipDownload() {
  const [progress, setProgress] = useState<ZipProgress>(IDLE);
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const start = useCallback(async (files: DownloadableFile[], zipName: string) => {
    if (files.length === 0) return;
    const totalBytes = files.reduce((s, f) => s + (f.size_bytes || 0), 0);

    if (totalBytes > MAX_BYTES) {
      toast.error("Seleção grande demais para um único .zip", {
        description: `São ${formatBytes(totalBytes)}. Selecione até 1 GB por vez.`,
      });
      return;
    }
    if (files.length > WARN_FILES || totalBytes > WARN_BYTES) {
      const ok = await confirmDialog({
        title: "Gerar um .zip grande?",
        description: `Serão ${files.length} arquivos (${formatBytes(totalBytes)}). O download pode demorar e usar bastante memória do navegador.`,
        confirmLabel: "Gerar .zip",
      });
      if (!ok) return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setProgress({ phase: "downloading", done: 0, total: files.length, percent: 0, zipName });

    const supabase = createClient();
    const { data: signed, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(
        files.map((f) => f.storage_path),
        SIGNED_URL_SECONDS,
      );
    if (error || !signed) {
      setProgress(IDLE);
      toast.error("Não foi possível preparar o download", { description: friendlyError(error) });
      return;
    }

    const zip = new JSZip();
    const used = new Set<string>();
    const failed: string[] = [];
    let done = 0;
    let loadedBytes = 0;

    // Nomes reservados na ordem da lista, para a numeração ser previsível
    const names = files.map((f) => uniqueFileName(f.file_name, used));

    const queue = files.map((file, index) => ({ file, index }));
    async function worker() {
      while (queue.length > 0 && !controller.signal.aborted) {
        const { file, index } = queue.shift()!;
        const url = signed?.[index]?.signedUrl;
        try {
          if (!url) throw new Error("sem acesso");
          const response = await fetch(url, { signal: controller.signal });
          if (!response.ok) throw new Error(String(response.status));
          const blob = await response.blob();
          zip.file(names[index], blob);
          loadedBytes += blob.size;
        } catch (err) {
          if (controller.signal.aborted) return;
          failed.push(file.file_name);
          void err;
        }
        done += 1;
        const byBytes = totalBytes > 0 ? loadedBytes / totalBytes : done / files.length;
        setProgress((p) => ({ ...p, done, percent: Math.min(100, Math.round(byBytes * 100)) }));
      }
    }

    try {
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, worker));
      if (controller.signal.aborted) {
        toast.info("Download cancelado");
        return;
      }
      if (failed.length === files.length) {
        toast.error("Nenhum arquivo pôde ser baixado", {
          description: "Verifique sua conexão ou se você tem acesso a esses arquivos.",
        });
        return;
      }

      setProgress((p) => ({ ...p, phase: "compressing", percent: 0 }));
      const blob = await zip.generateAsync(
        { type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } },
        (meta) => setProgress((p) => ({ ...p, percent: Math.round(meta.percent) })),
      );
      if (controller.signal.aborted) {
        toast.info("Download cancelado");
        return;
      }
      saveAs(blob, zipName);

      const ok = files.length - failed.length;
      if (failed.length > 0) {
        toast.warning(`${ok} de ${files.length} arquivos compactados`, {
          description: `Não foi possível baixar: ${failed.slice(0, 3).join(", ")}${failed.length > 3 ? "..." : ""}`,
        });
      } else {
        toast.success(`${ok} ${ok === 1 ? "arquivo compactado" : "arquivos compactados"}`, {
          description: zipName,
        });
      }
    } finally {
      abortRef.current = null;
      setProgress(IDLE);
    }
  }, []);

  return { progress, start, cancel, busy: progress.phase !== "idle" };
}
