"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, User as UserIcon, Paperclip, Download } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NewActivityDialog } from "@/components/forms/new-activity-dialog";
import { createClient } from "@/lib/supabase/client";
import { formatCurrencyBRL, uniqueSuffix } from "@/lib/utils";

interface Deal {
  id: string;
  title: string;
  value: number;
  currency: string;
  status: string;
  expected_close_date: string | null;
  source: string | null;
  stage_id: string;
  pipeline_id: string;
  organizations: { id: string; name: string } | null;
  contacts: { id: string; name: string } | null;
  profiles: { full_name: string } | null;
}

interface Stage {
  id: string;
  name: string;
  order_index: number;
}

interface Activity {
  id: string;
  type: string;
  subject: string;
  due_date: string | null;
  done: boolean;
}

interface Note {
  id: string;
  content: string;
  created_at: string;
  profiles: { full_name: string } | null;
}

interface Attachment {
  id: string;
  file_name: string;
  storage_path: string;
  size_bytes: number;
  created_at: string;
}

interface HistoryEntry {
  id: string;
  from_stage_name: string;
  to_stage_name: string;
  changed_at: string;
  profiles: { full_name: string } | null;
}

export function DealDetailTabs({
  deal,
  stages,
  activities,
  notes,
  attachments,
  history,
}: {
  deal: Deal;
  stages: Stage[];
  activities: Activity[];
  notes: Note[];
  attachments: Attachment[];
  history: HistoryEntry[];
}) {
  const router = useRouter();
  const supabase = createClient();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{deal.title}</h1>
          <p className="text-lg font-semibold text-primary">
            {formatCurrencyBRL(deal.value)}
          </p>
        </div>
        <Select
          value={deal.stage_id}
          onValueChange={async (value) => {
            await supabase.from("deals").update({ stage_id: value }).eq("id", deal.id);
            router.refresh();
          }}
        >
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {stages.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="activities">Atividades</TabsTrigger>
          <TabsTrigger value="notes">Notas</TabsTrigger>
          <TabsTrigger value="files">Arquivos</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardContent className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
              <Field icon={Building2} label="Organização" value={deal.organizations?.name ?? "—"} />
              <Field icon={UserIcon} label="Contato" value={deal.contacts?.name ?? "—"} />
              <Field label="Responsável" value={deal.profiles?.full_name ?? "—"} />
              <Field label="Origem" value={deal.source ?? "—"} />
              <Field
                label="Previsão de fechamento"
                value={
                  deal.expected_close_date
                    ? new Date(deal.expected_close_date).toLocaleDateString("pt-BR")
                    : "—"
                }
              />
              <Field label="Status" value={deal.status} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activities">
          <div className="flex flex-col gap-3">
            <NewActivityDialog
              trigger={<Button className="self-start">Nova atividade</Button>}
              dealId={deal.id}
              onCreated={() => router.refresh()}
            />
            <div className="flex flex-col gap-2">
              {activities.map((a) => (
                <Card key={a.id}>
                  <CardContent className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{a.type}</Badge>
                      <span className="text-sm">{a.subject}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {a.due_date && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(a.due_date).toLocaleString("pt-BR")}
                        </span>
                      )}
                      {a.done && <Badge variant="success">concluída</Badge>}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {activities.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhuma atividade vinculada a este negócio.
                </p>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="notes">
          <NotesTab dealId={deal.id} notes={notes} />
        </TabsContent>

        <TabsContent value="files">
          <FilesTab dealId={deal.id} attachments={attachments} />
        </TabsContent>

        <TabsContent value="history">
          <div className="flex flex-col gap-2">
            {history.map((h) => (
              <Card key={h.id}>
                <CardContent className="flex items-center justify-between p-3 text-sm">
                  <span>
                    {h.from_stage_name} → <strong>{h.to_stage_name}</strong>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {h.profiles?.full_name ?? "—"} em{" "}
                    {new Date(h.changed_at).toLocaleString("pt-BR")}
                  </span>
                </CardContent>
              </Card>
            ))}
            {history.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhuma mudança de estágio registrada ainda.
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  value,
}: {
  icon?: typeof Building2;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 text-sm font-medium">
        {Icon && <Icon className="size-3.5 text-muted-foreground" />}
        {value}
      </span>
    </div>
  );
}

function NotesTab({ dealId, notes }: { dealId: string; notes: Note[] }) {
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function addNote() {
    if (!content.trim()) return;
    setSubmitting(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("notes").insert({
        content,
        deal_id: dealId,
        author_id: user.id,
      });
      setContent("");
      router.refresh();
    }
    setSubmitting(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Textarea
          placeholder="Escreva uma nota..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <Button className="self-end" disabled={submitting} onClick={addNote}>
          {submitting ? "Salvando..." : "Adicionar nota"}
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        {notes.map((n) => (
          <Card key={n.id}>
            <CardContent className="flex flex-col gap-1 p-3">
              <p className="text-sm">{n.content}</p>
              <span className="text-xs text-muted-foreground">
                {n.profiles?.full_name ?? "—"} em{" "}
                {new Date(n.created_at).toLocaleString("pt-BR")}
              </span>
            </CardContent>
          </Card>
        ))}
        {notes.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma nota ainda.</p>
        )}
      </div>
    </div>
  );
}

function FilesTab({
  dealId,
  attachments,
}: {
  dealId: string;
  attachments: Attachment[];
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
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

    const storagePath = `deal/${dealId}/${uniqueSuffix()}-${file.name}`;
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
      entity_type: "deal",
      entity_id: dealId,
      file_name: file.name,
      storage_path: storagePath,
      size_bytes: file.size,
      uploaded_by: user.id,
    });

    setUploading(false);
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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <input ref={inputRef} type="file" onChange={onFileChange} disabled={uploading} />
      </div>
      {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
      <div className="flex flex-col gap-2">
        {attachments.map((a) => (
          <Card key={a.id}>
            <CardContent className="flex items-center justify-between p-3">
              <span className="flex items-center gap-2 text-sm">
                <Paperclip className="size-4 text-muted-foreground" />
                {a.file_name}
                <span className="text-xs text-muted-foreground">
                  ({Math.round(a.size_bytes / 1024)} KB)
                </span>
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
        ))}
        {attachments.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum arquivo anexado.</p>
        )}
      </div>
    </div>
  );
}
