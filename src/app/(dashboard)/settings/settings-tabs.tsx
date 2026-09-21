"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import {
  createUserWithPassword,
  updateUserProfile,
  resetUserPassword,
  setUserActive,
  deleteUser,
} from "@/lib/actions/users";
import { maskPhoneBR } from "@/lib/utils";
import type { UserRole, CustomFieldType, EntityType } from "@/lib/supabase/types";

interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  team_id: string | null;
  is_active: boolean;
}

interface Team {
  id: string;
  name: string;
}

interface Pipeline {
  id: string;
  name: string;
  is_default: boolean;
}

interface Stage {
  id: string;
  name: string;
  order_index: number;
  pipeline_id: string;
  rotting_days: number | null;
}

interface CustomField {
  id: string;
  entity_type: EntityType;
  label: string;
  field_type: CustomFieldType;
  required: boolean;
  order_index: number;
}

export function SettingsTabs({
  profiles,
  pipelines,
  stages,
  customFields,
  teams,
}: {
  profiles: Profile[];
  pipelines: Pipeline[];
  stages: Stage[];
  customFields: CustomField[];
  teams: Team[];
}) {
  return (
    <Tabs defaultValue="users">
      <TabsList>
        <TabsTrigger value="users">Usuários e permissões</TabsTrigger>
        <TabsTrigger value="pipelines">Pipelines e estágios</TabsTrigger>
        <TabsTrigger value="fields">Campos customizados</TabsTrigger>
      </TabsList>

      <TabsContent value="users">
        <UsersTab profiles={profiles} teams={teams} />
      </TabsContent>
      <TabsContent value="pipelines">
        <PipelinesTab pipelines={pipelines} stages={stages} />
      </TabsContent>
      <TabsContent value="fields">
        <CustomFieldsTab customFields={customFields} />
      </TabsContent>
    </Tabs>
  );
}

function UsersTab({ profiles, teams }: { profiles: Profile[]; teams: Team[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const sorted = [...profiles].sort((a, b) => {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
    return a.full_name.localeCompare(b.full_name);
  });

  async function onToggleActive(profile: Profile) {
    setTogglingId(profile.id);
    try {
      await setUserActive(profile.id, !profile.is_active);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Não foi possível alterar o usuário.");
    }
    setTogglingId(null);
  }

  async function onDelete(profile: Profile) {
    if (
      !window.confirm(
        `Excluir o usuário "${profile.full_name}"? Essa ação não pode ser desfeita.`,
      )
    )
      return;

    setDeletingId(profile.id);
    try {
      await deleteUser(profile.id);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Não foi possível excluir o usuário.");
    }
    setDeletingId(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <CreateUserDialog teams={teams} onCreated={() => router.refresh()} />

      <div className="flex flex-col gap-2">
        {sorted.map((p) => (
          <Card key={p.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="flex flex-col gap-0.5">
                <span className="flex items-center gap-2 text-sm font-medium">
                  {p.full_name}
                  {!p.is_active && (
                    <Badge variant="outline" className="text-muted-foreground">
                      inativo
                    </Badge>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  {p.email ?? "—"}
                  {p.phone && ` · ${p.phone}`}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={p.role}
                  onValueChange={async (value) => {
                    await supabase
                      .from("profiles")
                      .update({ role: value as UserRole })
                      .eq("id", p.id);
                    router.refresh();
                  }}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="gestor">Gestor</SelectItem>
                    <SelectItem value="vendedor">Vendedor</SelectItem>
                  </SelectContent>
                </Select>
                <EditUserDialog profile={p} onSaved={() => router.refresh()} />
                <ResetPasswordDialog profile={p} />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={togglingId === p.id}
                  onClick={() => onToggleActive(p)}
                >
                  {p.is_active ? "Desativar" : "Ativar"}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deletingId === p.id}
                  onClick={() => onDelete(p)}
                >
                  Excluir
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {profiles.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum usuário encontrado.
          </p>
        )}
      </div>
    </div>
  );
}

function EditUserDialog({
  profile,
  onSaved,
}: {
  profile: Profile;
  onSaved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState(profile.full_name);
  const [email, setEmail] = useState(profile.email ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function onOpenChange(next: boolean) {
    if (next) {
      setFullName(profile.full_name);
      setEmail(profile.email ?? "");
      setPhone(profile.phone ?? "");
      setError(null);
    }
    setOpen(next);
  }

  async function onSubmit() {
    setError(null);
    if (!fullName.trim() || !email.trim()) {
      setError("Preencha nome e e-mail.");
      return;
    }

    setSubmitting(true);
    try {
      await updateUserProfile({
        profileId: profile.id,
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
      });
      setOpen(false);
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    }
    setSubmitting(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar usuário</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`editFullName-${profile.id}`}>Nome completo</Label>
            <Input
              id={`editFullName-${profile.id}`}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`editEmail-${profile.id}`}>E-mail</Label>
            <Input
              id={`editEmail-${profile.id}`}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`editPhone-${profile.id}`}>Telefone</Label>
            <Input
              id={`editPhone-${profile.id}`}
              type="tel"
              value={phone}
              onChange={(e) => setPhone(maskPhoneBR(e.target.value))}
              placeholder="(00) 00000-0000"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button onClick={onSubmit} disabled={submitting}>
            {submitting ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function onOpenChange(next: boolean) {
    if (next) {
      setPassword("");
      setConfirmPassword("");
      setError(null);
    }
    setOpen(next);
  }

  async function onSubmit() {
    setError(null);
    if (password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setSubmitting(true);
    try {
      await resetUserPassword(profile.id, password);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível redefinir a senha.");
    }
    setSubmitting(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Redefinir senha
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Redefinir senha de {profile.full_name}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            O usuário precisará trocar essa senha no próximo login.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`resetPassword-${profile.id}`}>Nova senha</Label>
            <Input
              id={`resetPassword-${profile.id}`}
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`resetPasswordConfirm-${profile.id}`}>Confirme a senha</Label>
            <Input
              id={`resetPasswordConfirm-${profile.id}`}
              type="text"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button onClick={onSubmit} disabled={submitting}>
            {submitting ? "Salvando..." : "Redefinir senha"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateUserDialog({
  teams,
  onCreated,
}: {
  teams: Team[];
  onCreated?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole>("vendedor");
  const [teamId, setTeamId] = useState<string>("");
  const [tempPassword, setTempPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setError(null);
    if (!fullName.trim() || !email.trim()) {
      setError("Preencha nome e e-mail.");
      return;
    }
    if (tempPassword.length < 8) {
      setError("A senha temporária precisa ter pelo menos 8 caracteres.");
      return;
    }

    setSubmitting(true);
    try {
      await createUserWithPassword({
        email: email.trim(),
        fullName: fullName.trim(),
        phone: phone.trim() || null,
        role,
        teamId: teamId || null,
        tempPassword,
      });
      setFullName("");
      setEmail("");
      setPhone("");
      setTempPassword("");
      setRole("vendedor");
      setTeamId("");
      setOpen(false);
      onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar o usuário.");
    }
    setSubmitting(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="self-start">Criar usuário</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar usuário</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="userFullName">Nome completo</Label>
            <Input
              id="userFullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="userEmail">E-mail</Label>
            <Input
              id="userEmail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="userPhone">Telefone</Label>
            <Input
              id="userPhone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(maskPhoneBR(e.target.value))}
              placeholder="(00) 00000-0000"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="userTempPassword">Senha temporária</Label>
            <Input
              id="userTempPassword"
              type="text"
              value={tempPassword}
              onChange={(e) => setTempPassword(e.target.value)}
              placeholder="Informe a senha inicial (o usuário troca no 1º login)"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Papel</Label>
              <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="gestor">Gestor</SelectItem>
                  <SelectItem value="vendedor">Vendedor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Equipe</Label>
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button onClick={onSubmit} disabled={submitting}>
            {submitting ? "Criando..." : "Criar usuário"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PipelinesTab({
  pipelines,
  stages,
}: {
  pipelines: Pipeline[];
  stages: Stage[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [newStageName, setNewStageName] = useState<Record<string, string>>({});
  const [newPipelineName, setNewPipelineName] = useState("");
  const [creatingPipeline, setCreatingPipeline] = useState(false);
  const [editingPipelineId, setEditingPipelineId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editingStageName, setEditingStageName] = useState("");

  async function createPipeline() {
    if (!newPipelineName.trim()) return;
    setCreatingPipeline(true);
    await supabase.from("pipelines").insert({
      name: newPipelineName.trim(),
      is_default: pipelines.length === 0,
    });
    setNewPipelineName("");
    setCreatingPipeline(false);
    router.refresh();
  }

  async function renamePipeline(id: string) {
    if (!editingName.trim()) return;
    await supabase.from("pipelines").update({ name: editingName.trim() }).eq("id", id);
    setEditingPipelineId(null);
    router.refresh();
  }

  async function makeDefault(id: string) {
    await supabase.from("pipelines").update({ is_default: false }).neq("id", id);
    await supabase.from("pipelines").update({ is_default: true }).eq("id", id);
    router.refresh();
  }

  async function renameStage(id: string) {
    if (!editingStageName.trim()) return;
    await supabase.from("pipeline_stages").update({ name: editingStageName.trim() }).eq("id", id);
    setEditingStageId(null);
    router.refresh();
  }

  async function updateRottingDays(id: string, rawValue: string) {
    const trimmed = rawValue.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    if (parsed !== null && (Number.isNaN(parsed) || parsed < 0)) return;
    await supabase.from("pipeline_stages").update({ rotting_days: parsed }).eq("id", id);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex items-end gap-2 p-4">
          <div className="flex flex-1 flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Novo funil</label>
            <Input
              placeholder="ex.: Funil Segurança, Funil Serviços..."
              value={newPipelineName}
              onChange={(e) => setNewPipelineName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createPipeline()}
            />
          </div>
          <Button onClick={createPipeline} disabled={creatingPipeline}>
            {creatingPipeline ? "Criando..." : "Criar funil"}
          </Button>
        </CardContent>
      </Card>

      {pipelines.map((pipeline) => {
        const pipelineStages = stages.filter((s) => s.pipeline_id === pipeline.id);
        const isEditing = editingPipelineId === pipeline.id;
        return (
          <Card key={pipeline.id}>
            <CardContent className="flex flex-col gap-3 p-4">
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <Input
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && renamePipeline(pipeline.id)}
                    onBlur={() => renamePipeline(pipeline.id)}
                    className="h-8 max-w-64"
                  />
                ) : (
                  <button
                    className="text-sm font-semibold hover:underline"
                    onClick={() => {
                      setEditingPipelineId(pipeline.id);
                      setEditingName(pipeline.name);
                    }}
                    title="Clique para renomear"
                  >
                    {pipeline.name}
                  </button>
                )}
                {pipeline.is_default ? (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    padrão
                  </span>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => makeDefault(pipeline.id)}
                  >
                    Tornar padrão
                  </Button>
                )}
              </div>
              <ol className="flex flex-wrap gap-3">
                {pipelineStages.map((s) => (
                  <li key={s.id} className="flex flex-col items-start gap-1">
                    {editingStageId === s.id ? (
                      <Input
                        autoFocus
                        value={editingStageName}
                        onChange={(e) => setEditingStageName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && renameStage(s.id)}
                        onBlur={() => renameStage(s.id)}
                        className="h-7 w-40 text-xs"
                      />
                    ) : (
                      <button
                        className="rounded-md border border-border px-2 py-1 text-xs hover:border-primary hover:text-primary"
                        onClick={() => {
                          setEditingStageId(s.id);
                          setEditingStageName(s.name);
                        }}
                        title="Clique para renomear"
                      >
                        {s.order_index + 1}. {s.name}
                      </button>
                    )}
                    <div className="flex items-center gap-1 pl-1">
                      <span className="text-[10px] text-muted-foreground">
                        Estagna em
                      </span>
                      <Input
                        type="number"
                        min={0}
                        defaultValue={s.rotting_days ?? ""}
                        placeholder="—"
                        title="Dias sem atividade até marcar como estagnado (vazio = sem alerta)"
                        className="h-6 w-14 px-1 text-[10px]"
                        onBlur={(e) => updateRottingDays(s.id, e.target.value)}
                      />
                      <span className="text-[10px] text-muted-foreground">dias</span>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="flex gap-2">
                <Input
                  placeholder="Nome do novo estágio"
                  value={newStageName[pipeline.id] ?? ""}
                  onChange={(e) =>
                    setNewStageName((prev) => ({
                      ...prev,
                      [pipeline.id]: e.target.value,
                    }))
                  }
                  className="max-w-64"
                />
                <Button
                  variant="outline"
                  onClick={async () => {
                    const name = newStageName[pipeline.id];
                    if (!name) return;
                    await supabase.from("pipeline_stages").insert({
                      pipeline_id: pipeline.id,
                      name,
                      order_index: pipelineStages.length,
                    });
                    setNewStageName((prev) => ({ ...prev, [pipeline.id]: "" }));
                    router.refresh();
                  }}
                >
                  Adicionar estágio
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

const ENTITY_LABEL: Record<EntityType, string> = {
  deal: "Negócio",
  contact: "Contato",
  organization: "Organização",
};

const FIELD_TYPE_LABEL: Record<CustomFieldType, string> = {
  text: "Texto",
  number: "Número",
  date: "Data",
  select: "Lista de opções",
  checkbox: "Sim/Não",
};

function CustomFieldsTab({ customFields }: { customFields: CustomField[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [label, setLabel] = useState("");
  const [entityType, setEntityType] = useState<EntityType>("deal");
  const [fieldType, setFieldType] = useState<CustomFieldType>("text");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {customFields.map((f) => (
          <Card key={f.id}>
            <CardContent className="flex items-center justify-between p-4">
              <span className="text-sm font-medium">{f.label}</span>
              <div className="flex gap-2 text-xs text-muted-foreground">
                <span className="rounded-full bg-muted px-2 py-0.5">
                  {ENTITY_LABEL[f.entity_type]}
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5">
                  {FIELD_TYPE_LABEL[f.field_type]}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
        {customFields.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum campo customizado criado ainda.
          </p>
        )}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Aplica-se a</label>
            <Select value={entityType} onValueChange={(v) => setEntityType(v as EntityType)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ENTITY_LABEL).map(([value, l]) => (
                  <SelectItem key={value} value={value}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Tipo</label>
            <Select value={fieldType} onValueChange={(v) => setFieldType(v as CustomFieldType)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FIELD_TYPE_LABEL).map(([value, l]) => (
                  <SelectItem key={value} value={value}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Nome do campo</label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-48"
            />
          </div>
          <Button
            onClick={async () => {
              if (!label) return;
              await supabase.from("custom_fields").insert({
                entity_type: entityType,
                field_type: fieldType,
                label,
                required: false,
                order_index: customFields.length,
              });
              setLabel("");
              router.refresh();
            }}
          >
            Adicionar campo
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
