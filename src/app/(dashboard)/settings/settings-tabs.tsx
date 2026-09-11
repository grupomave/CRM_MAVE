"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
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
import type { UserRole, CustomFieldType, EntityType } from "@/lib/supabase/types";

interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  team_id: string | null;
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
}: {
  profiles: Profile[];
  pipelines: Pipeline[];
  stages: Stage[];
  customFields: CustomField[];
}) {
  return (
    <Tabs defaultValue="users">
      <TabsList>
        <TabsTrigger value="users">Usuários e permissões</TabsTrigger>
        <TabsTrigger value="pipelines">Pipelines e estágios</TabsTrigger>
        <TabsTrigger value="fields">Campos customizados</TabsTrigger>
      </TabsList>

      <TabsContent value="users">
        <UsersTab profiles={profiles} />
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

function UsersTab({ profiles }: { profiles: Profile[] }) {
  const router = useRouter();
  const supabase = createClient();

  return (
    <div className="flex flex-col gap-2">
      {profiles.map((p) => (
        <Card key={p.id}>
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <span className="text-sm font-medium">{p.full_name}</span>
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
          </CardContent>
        </Card>
      ))}
      {profiles.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhum usuário encontrado. Convide usuários pelo painel do Supabase Auth.
        </p>
      )}
    </div>
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
              <ol className="flex flex-wrap gap-2">
                {pipelineStages.map((s) =>
                  editingStageId === s.id ? (
                    <li key={s.id}>
                      <Input
                        autoFocus
                        value={editingStageName}
                        onChange={(e) => setEditingStageName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && renameStage(s.id)}
                        onBlur={() => renameStage(s.id)}
                        className="h-7 w-40 text-xs"
                      />
                    </li>
                  ) : (
                    <li key={s.id}>
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
                    </li>
                  ),
                )}
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
