"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { KeyRound, MoreHorizontal, Pencil, Plus, Power, Trash2, Users as UsersIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { maskPhoneBR } from "@/lib/masks";
import { friendlyError, toast } from "@/lib/toast";
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
      <TabsList variant="underline">
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

const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Administrador",
  gestor: "Gestor",
  vendedor: "Vendedor",
};

function UsersTab({ profiles, teams }: { profiles: Profile[]; teams: Team[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [resetting, setResetting] = useState<Profile | null>(null);
  const teamName = new Map(teams.map((t) => [t.id, t.name]));

  const sorted = [...profiles].sort((a, b) => {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
    return a.full_name.localeCompare(b.full_name, "pt-BR");
  });

  async function onChangeRole(profile: Profile, role: UserRole) {
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({ role }).eq("id", profile.id);
    if (error) {
      toast.error("Não foi possível alterar o papel", { description: friendlyError(error) });
      return;
    }
    toast.success(`${profile.full_name} agora é ${ROLE_LABEL[role].toLowerCase()}`);
    router.refresh();
  }

  async function onToggleActive(profile: Profile) {
    if (profile.is_active) {
      const ok = await confirmDialog({
        title: `Desativar ${profile.full_name}?`,
        description: "O usuário perde o acesso ao CRM, mas os registros dele são mantidos. É possível reativar depois.",
        confirmLabel: "Desativar",
        destructive: true,
      });
      if (!ok) return;
    }
    setBusyId(profile.id);
    try {
      await setUserActive(profile.id, !profile.is_active);
      toast.success(profile.is_active ? "Usuário desativado" : "Usuário reativado");
      router.refresh();
    } catch (err) {
      toast.error("Não foi possível alterar o usuário", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
    setBusyId(null);
  }

  async function onDelete(profile: Profile) {
    const ok = await confirmDialog({
      title: `Excluir o usuário ${profile.full_name}?`,
      description: "Essa ação não pode ser desfeita. Prefira desativar se ele tiver registros no CRM.",
      confirmLabel: "Excluir usuário",
      destructive: true,
    });
    if (!ok) return;

    setBusyId(profile.id);
    try {
      await deleteUser(profile.id);
      toast.success("Usuário excluído");
      router.refresh();
    } catch (err) {
      toast.error("Não foi possível excluir o usuário", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
    setBusyId(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {profiles.filter((p) => p.is_active).length} ativos de {profiles.length} usuários
        </p>
        <CreateUserDialog teams={teams} onCreated={() => router.refresh()} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Usuário</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead>Equipe</TableHead>
            <TableHead>Papel</TableHead>
            <TableHead className="w-12">
              <span className="sr-only">Ações</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((p) => (
            <TableRow key={p.id} className={p.is_active ? undefined : "opacity-60"}>
              <TableCell>
                <span className="flex items-center gap-3">
                  <UserAvatar name={p.full_name} showTooltip={false} />
                  <span className="flex min-w-0 flex-col">
                    <span className="flex items-center gap-2 font-medium">
                      {p.full_name}
                      {!p.is_active && <Badge variant="neutral">Inativo</Badge>}
                    </span>
                    <span className="truncate text-caption text-muted-foreground">{p.email ?? "—"}</span>
                  </span>
                </span>
              </TableCell>
              <TableCell className="numeric whitespace-nowrap text-muted-foreground">{p.phone ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">{p.team_id ? (teamName.get(p.team_id) ?? "—") : "—"}</TableCell>
              <TableCell>
                <Select value={p.role} onValueChange={(v) => onChangeRole(p, v as UserRole)}>
                  <SelectTrigger size="sm" className="w-36" aria-label={`Papel de ${p.full_name}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ROLE_LABEL) as UserRole[]).map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      disabled={busyId === p.id}
                      aria-label={`Ações de ${p.full_name}`}
                    >
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setEditing(p)}>
                      <Pencil />
                      Editar dados
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setResetting(p)}>
                      <KeyRound />
                      Redefinir senha
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onToggleActive(p)}>
                      <Power />
                      {p.is_active ? "Desativar" : "Reativar"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => onDelete(p)}>
                      <Trash2 />
                      Excluir usuário
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
          {profiles.length === 0 && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={5}>
                <EmptyState icon={UsersIcon} title="Nenhum usuário encontrado" />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {editing && (
        <EditUserDialog
          key={editing.id}
          profile={editing}
          onClose={() => setEditing(null)}
          onSaved={() => router.refresh()}
        />
      )}
      {resetting && (
        <ResetPasswordDialog key={resetting.id} profile={resetting} onClose={() => setResetting(null)} />
      )}
    </div>
  );
}

function EditUserDialog({
  profile,
  onClose,
  onSaved,
}: {
  profile: Profile;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [fullName, setFullName] = useState(profile.full_name);
  const [email, setEmail] = useState(profile.email ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const errors = {
    fullName: touched && !fullName.trim() ? "Informe o nome" : undefined,
    email: touched && !email.trim() ? "Informe o e-mail" : undefined,
  };

  async function onSubmit() {
    setTouched(true);
    if (!fullName.trim() || !email.trim()) return;

    setSubmitting(true);
    try {
      await updateUserProfile({
        profileId: profile.id,
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
      });
      toast.success("Usuário atualizado");
      onClose();
      onSaved?.();
    } catch (err) {
      toast.error("Não foi possível salvar", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
    setSubmitting(false);
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar usuário</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <FormField label="Nome completo" htmlFor="editFullName" required error={errors.fullName}>
            <Input id="editFullName" value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus />
          </FormField>
          <FormField label="E-mail" htmlFor="editEmail" required error={errors.email}>
            <Input id="editEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </FormField>
          <FormField label="Telefone" htmlFor="editPhone">
            <Input
              id="editPhone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(maskPhoneBR(e.target.value))}
              placeholder="(00) 00000-0000"
            />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} loading={submitting}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const errors = {
    password: touched && password.length < 8 ? "A senha precisa ter pelo menos 8 caracteres" : undefined,
    confirm: touched && password !== confirmPassword ? "As senhas não coincidem" : undefined,
  };

  async function onSubmit() {
    setTouched(true);
    if (password.length < 8 || password !== confirmPassword) return;

    setSubmitting(true);
    try {
      await resetUserPassword(profile.id, password);
      toast.success("Senha redefinida", { description: "O usuário troca a senha no próximo login." });
      onClose();
    } catch (err) {
      toast.error("Não foi possível redefinir a senha", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
    setSubmitting(false);
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Redefinir senha</DialogTitle>
          <DialogDescription>
            Nova senha temporária para {profile.full_name}. Ele precisará trocá-la no próximo login.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <FormField label="Nova senha" htmlFor="resetPassword" required error={errors.password}>
            <Input id="resetPassword" type="text" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
          </FormField>
          <FormField label="Confirme a senha" htmlFor="resetPasswordConfirm" required error={errors.confirm}>
            <Input
              id="resetPasswordConfirm"
              type="text"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} loading={submitting}>
            Redefinir senha
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
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const errors = {
    fullName: touched && !fullName.trim() ? "Informe o nome" : undefined,
    email: touched && !email.trim() ? "Informe o e-mail" : undefined,
    tempPassword:
      touched && tempPassword.length < 8 ? "A senha temporária precisa ter pelo menos 8 caracteres" : undefined,
  };

  async function onSubmit() {
    setTouched(true);
    if (!fullName.trim() || !email.trim() || tempPassword.length < 8) return;

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
      toast.success("Usuário criado", { description: `${fullName.trim()} já pode entrar com a senha temporária.` });
      setFullName("");
      setEmail("");
      setPhone("");
      setTempPassword("");
      setRole("vendedor");
      setTeamId("");
      setTouched(false);
      setOpen(false);
      onCreated?.();
    } catch (err) {
      toast.error("Não foi possível criar o usuário", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
    setSubmitting(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          Criar usuário
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar usuário</DialogTitle>
          <DialogDescription>O usuário troca a senha temporária no primeiro acesso.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <FormField label="Nome completo" htmlFor="userFullName" required error={errors.fullName}>
            <Input id="userFullName" value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus />
          </FormField>
          <FormField label="E-mail" htmlFor="userEmail" required error={errors.email}>
            <Input
              id="userEmail"
              type="email"
              placeholder="nome@grupomave.com.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FormField>
          <FormField label="Telefone" htmlFor="userPhone">
            <Input
              id="userPhone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(maskPhoneBR(e.target.value))}
              placeholder="(00) 00000-0000"
            />
          </FormField>
          <FormField label="Senha temporária" htmlFor="userTempPassword" required error={errors.tempPassword}>
            <Input
              id="userTempPassword"
              type="text"
              value={tempPassword}
              onChange={(e) => setTempPassword(e.target.value)}
              placeholder="Mínimo de 8 caracteres"
            />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Papel" htmlFor="userRole">
              <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                <SelectTrigger id="userRole">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_LABEL) as UserRole[]).map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Equipe" htmlFor="userTeam">
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger id="userTeam">
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
            </FormField>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} loading={submitting}>
            Criar usuário
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
                      <span className="text-micro text-muted-foreground">
                        Estagna em
                      </span>
                      <Input
                        type="number"
                        min={0}
                        defaultValue={s.rotting_days ?? ""}
                        placeholder="—"
                        title="Dias sem atividade até marcar como estagnado (vazio = sem alerta)"
                        className="h-6 w-14 px-1 text-micro"
                        onBlur={(e) => updateRottingDays(s.id, e.target.value)}
                      />
                      <span className="text-micro text-muted-foreground">dias</span>
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
