"use client";

import { formatOverdue } from "@/lib/deal-alerts";
import { useMemo, useState, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightLeft,
  CalendarPlus,
  CheckCircle2,
  FileText,
  Flag,
  Mail,
  MessageCircle,
  MessageSquareText,
  Paperclip,
  Pencil,
  Phone,
  StickyNote,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { FilterToggle } from "@/components/list/list-toolbar";
import { NewActivityDialog } from "@/components/forms/new-activity-dialog";
import { EntityFilesTab, type EntityAttachment } from "@/components/entity-files-tab";
import { ActivityDoneToggle } from "@/app/(dashboard)/activities/activity-done-toggle";
import { ActivityEditButton } from "@/app/(dashboard)/activities/activity-edit-button";
import { DeleteRecordButton } from "@/components/delete-record-button";
import { createClient } from "@/lib/supabase/client";
import { friendlyError, toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { ProposalsTab } from "./proposals-tab";
import {
  ACTIVITY_TYPE_LABEL,
  type ActivityItem,
  type TimelineItem,
  type TimelineKind,
} from "./types";

const ACTIVITY_ICON: Record<string, LucideIcon> = {
  call: Phone,
  meeting: Users,
  email: Mail,
  whatsapp: MessageCircle,
  task: CheckCircle2,
};

const TIMELINE_ICON: Record<TimelineKind, LucideIcon> = {
  note: StickyNote,
  activity: CheckCircle2,
  stage: ArrowRightLeft,
  status: Flag,
  file: Paperclip,
};

const TIMELINE_FILTERS: { value: "all" | TimelineKind | "changes"; label: string }[] = [
  { value: "all", label: "Tudo" },
  { value: "note", label: "Anotações" },
  { value: "activity", label: "Atividades" },
  { value: "changes", label: "Mudanças" },
  { value: "file", label: "Arquivos" },
];

const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

function formatDue(iso: string) {
  return dateTime.format(new Date(iso));
}

function NoteTimelineBody({
  noteId,
  content,
  onSaved,
  editing,
  onClose,
}: {
  noteId: string;
  content: string;
  onSaved: () => void;
  editing: boolean;
  onClose: () => void;
}) {
  const [value, setValue] = useState(content);
  const [saving, setSaving] = useState(false);
  const changed = value.trim() !== content.trim() && value.trim().length > 0;

  if (!editing) {
    return <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground/90">{content}</p>;
  }

  async function save() {
    if (!changed || saving) return;
    setSaving(true);
    const supabase = createClient();
    // select() devolve as linhas afetadas: o RLS bloqueia sem erro (0 linhas)
    const { data, error } = await supabase
      .from("notes")
      .update({ content: value.trim() })
      .eq("id", noteId)
      .select("id");
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar a anotação", { description: friendlyError(error) });
      return;
    }
    if (!data?.length) {
      toast.error("Você não tem permissão para editar esta anotação");
      return;
    }
    toast.success("Anotação atualizada");
    onClose();
    onSaved();
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      <Textarea
        aria-label="Editar anotação"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) save();
          if (e.key === "Escape") {
            setValue(content);
            onClose();
          }
        }}
        className="min-h-24"
      />
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setValue(content);
            onClose();
          }}
        >
          Descartar
        </Button>
        <Button size="sm" onClick={save} loading={saving} disabled={!changed}>
          Salvar
        </Button>
      </div>
    </div>
  );
}

export function DealWorkspace({
  dealId,
  dealTitle,
  activities,
  attachments,
  proposals,
  timeline,
}: {
  dealId: string;
  dealTitle: string;
  activities: ActivityItem[];
  attachments: EntityAttachment[];
  proposals: ComponentProps<typeof ProposalsTab>["proposals"];
  timeline: TimelineItem[];
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [timelineFilter, setTimelineFilter] = useState<(typeof TIMELINE_FILTERS)[number]["value"]>("all");

  const pending = activities.filter((a) => !a.done);
  const visibleTimeline = useMemo(
    () =>
      timeline.filter((item) =>
        timelineFilter === "all"
          ? true
          : timelineFilter === "changes"
            ? item.kind === "stage" || item.kind === "status"
            : item.kind === timelineFilter,
      ),
    [timeline, timelineFilter],
  );

  async function addNote() {
    const content = note.trim();
    if (!content || savingNote) return;
    setSavingNote(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSavingNote(false);
      toast.error("Sua sessão expirou", { description: "Entre novamente para continuar." });
      return;
    }
    const { error } = await supabase.from("notes").insert({ content, deal_id: dealId, author_id: user.id });
    setSavingNote(false);
    if (error) {
      toast.error("Não foi possível salvar a anotação", { description: friendlyError(error) });
      return;
    }
    setNote("");
    toast.success("Anotação salva");
    router.refresh();
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Card className="px-4 pb-4">
        <Tabs defaultValue="note">
          <TabsList variant="underline">
            <TabsTrigger value="note">
              <MessageSquareText />
              Anotação
            </TabsTrigger>
            <TabsTrigger value="activity">
              <CalendarPlus />
              Atividade
            </TabsTrigger>
            <TabsTrigger value="proposals">
              <FileText />
              Propostas
              {proposals.length > 0 && <Badge variant="neutral">{proposals.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="files">
              <Paperclip />
              Arquivos
              {attachments.length > 0 && <Badge variant="neutral">{attachments.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="note" className="flex flex-col gap-2">
            <Textarea
              aria-label="Nova anotação"
              placeholder="Escreva uma anotação sobre o negócio..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) addNote();
              }}
              className="min-h-24"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="hidden text-caption text-muted-foreground sm:inline">Ctrl + Enter para salvar</span>
              <Button className="ml-auto" onClick={addNote} loading={savingNote} disabled={!note.trim()}>
                Salvar anotação
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="activity">
            <div className="flex flex-col items-start gap-3 rounded-md border border-dashed border-border p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Agende a próxima ligação, reunião ou tarefa para manter o negócio andando.
              </p>
              <NewActivityDialog
                trigger={
                  <Button>
                    <CalendarPlus />
                    Agendar atividade
                  </Button>
                }
                dealId={dealId}
                onCreated={() => {
                  toast.success("Atividade agendada");
                  router.refresh();
                }}
              />
            </div>
          </TabsContent>

          <TabsContent value="proposals">
            <ProposalsTab dealId={dealId} proposals={proposals} />
          </TabsContent>

          <TabsContent value="files">
            <EntityFilesTab entityType="deal" entityId={dealId} entityName={dealTitle} attachments={attachments} />
          </TabsContent>
        </Tabs>
      </Card>

      <section aria-labelledby="deal-focus" className="flex flex-col gap-3">
        <h2 id="deal-focus" className="text-subtitle text-foreground">
          Foco
          {pending.length > 0 && (
            <span className="numeric ml-2 text-sm font-normal text-muted-foreground">{pending.length}</span>
          )}
        </h2>
        {pending.length === 0 ? (
          <Card>
            <EmptyState
              compact
              icon={CalendarPlus}
              title="Nenhuma atividade pendente"
              description="Negócios sem próxima atividade tendem a esfriar — agende o próximo passo."
            />
          </Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {pending.map((a) => {
              const Icon = ACTIVITY_ICON[a.type] ?? CheckCircle2;
              const overdue = a.overdue;
              return (
                <li key={a.id}>
                  <Card className="flex items-start gap-3 p-3">
                    <div className="pt-0.5">
                      <ActivityDoneToggle activityId={a.id} done={a.done} label={a.subject} />
                    </div>
                    <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-sm font-medium text-foreground">{a.subject}</span>
                      <span className="flex flex-wrap items-center gap-1.5 text-caption text-muted-foreground">
                        {overdue && (
                          <Badge variant="destructive">
                            Vencida {a.due_date ? formatOverdue(a.due_date)?.label : ""}
                          </Badge>
                        )}
                        <span>{ACTIVITY_TYPE_LABEL[a.type] ?? a.type}</span>
                        {a.due_date && (
                          <>
                            <span aria-hidden>·</span>
                            <span className={cn("numeric", overdue && "text-destructive")}>{formatDue(a.due_date)}</span>
                          </>
                        )}
                      </span>
                    </div>
                    <ActivityEditButton activity={a} />
                    <DeleteRecordButton
                      table="activities"
                      id={a.id}
                      label={`Excluir atividade "${a.subject}"`}
                      title="Excluir atividade?"
                      successMessage="Atividade excluída"
                    />
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="deal-history" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="deal-history" className="text-subtitle text-foreground">
            Histórico
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {TIMELINE_FILTERS.map((f) => (
              <FilterToggle
                key={f.value}
                active={timelineFilter === f.value}
                onClick={() => setTimelineFilter(f.value)}
              >
                {f.label}
              </FilterToggle>
            ))}
          </div>
        </div>
        {visibleTimeline.length === 0 ? (
          <Card>
            <EmptyState compact icon={Flag} title="Nada registrado ainda" />
          </Card>
        ) : (
          <ol className="relative flex flex-col gap-3 before:absolute before:bottom-2 before:left-4 before:top-2 before:w-px before:bg-border">
            {visibleTimeline.map((item) => {
              const Icon = TIMELINE_ICON[item.kind];
              return (
                <li key={item.id} className="relative flex gap-3">
                  <span className="z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <Card className={cn("min-w-0 flex-1 p-3", item.kind === "note" && "border-warning/30 bg-warning-subtle/40")}>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                      <span className="text-sm font-medium text-foreground">{item.title}</span>
                      <span className="flex items-center gap-1.5">
                        <span className="numeric text-caption text-muted-foreground">
                          {formatDue(item.at)}
                          {item.actor ? ` · ${item.actor}` : ""}
                        </span>
                        {item.noteId && editingNoteId !== item.noteId && (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label="Editar anotação"
                            onClick={() => setEditingNoteId(item.noteId!)}
                          >
                            <Pencil />
                          </Button>
                        )}
                        {item.activity && <ActivityEditButton activity={item.activity} />}
                        {item.noteId && editingNoteId !== item.noteId && (
                          <DeleteRecordButton
                            table="notes"
                            id={item.noteId}
                            label="Excluir anotação"
                            title="Excluir anotação?"
                            successMessage="Anotação excluída"
                          />
                        )}
                        {item.activity && (
                          <DeleteRecordButton
                            table="activities"
                            id={item.activity.id}
                            label={`Excluir atividade "${item.activity.subject}"`}
                            title="Excluir atividade?"
                            successMessage="Atividade excluída"
                          />
                        )}
                      </span>
                    </div>
                    {item.noteId ? (
                      <NoteTimelineBody
                        // remonta quando o texto muda (após salvar) para reiniciar o rascunho
                        key={`${item.noteId}-${item.body}`}
                        noteId={item.noteId}
                        content={item.body ?? ""}
                        editing={editingNoteId === item.noteId}
                        onClose={() => setEditingNoteId(null)}
                        onSaved={() => router.refresh()}
                      />
                    ) : (
                      item.body && (
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground/90">{item.body}</p>
                      )
                    )}
                  </Card>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
