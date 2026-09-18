import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyBRL } from "@/lib/utils";
import { OrganizationDetailForm } from "./organization-detail-form";
import { EntityFilesTab } from "@/components/entity-files-tab";

const DEAL_STATUS_LABEL: Record<string, string> = {
  open: "Aberto",
  won: "Ganho",
  lost: "Perdido",
};

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: organization } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", id)
    .single();

  if (!organization) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: myProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id ?? "")
    .single();
  const canDelete = myProfile?.role === "admin" || myProfile?.role === "gestor";

  const [contactsRes, dealsRes, attachmentsRes] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, name, email, phone")
      .eq("organization_id", id)
      .order("name"),
    supabase
      .from("deals")
      .select("id, title, value, status")
      .eq("organization_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("attachments")
      .select("id, file_name, storage_path, size_bytes, created_at, category, expires_at")
      .eq("entity_type", "organization")
      .eq("entity_id", id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{organization.name}</h1>
        <p className="text-sm text-muted-foreground">Organização</p>
      </div>

      <OrganizationDetailForm organization={organization as any} canDelete={canDelete} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-2 p-4">
            <h2 className="text-sm font-semibold text-foreground">Contatos</h2>
            {(contactsRes.data ?? []).map((c) => (
              <Link
                key={c.id}
                href={`/contacts/people/${c.id}`}
                className="flex flex-col rounded-md border border-border p-2 text-sm hover:border-primary"
              >
                <span className="font-medium">{c.name}</span>
                <span className="text-xs text-muted-foreground">
                  {c.email ?? c.phone ?? "—"}
                </span>
              </Link>
            ))}
            {(contactsRes.data ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum contato vinculado.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-2 p-4">
            <h2 className="text-sm font-semibold text-foreground">Negócios</h2>
            {(dealsRes.data ?? []).map((d) => (
              <Link
                key={d.id}
                href={`/deals/${d.id}`}
                className="flex items-center justify-between rounded-md border border-border p-2 text-sm hover:border-primary"
              >
                <span className="font-medium">{d.title}</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {formatCurrencyBRL(d.value)}
                  </span>
                  <Badge
                    variant={
                      d.status === "won"
                        ? "success"
                        : d.status === "lost"
                          ? "destructive"
                          : "outline"
                    }
                  >
                    {DEAL_STATUS_LABEL[d.status] ?? d.status}
                  </Badge>
                </span>
              </Link>
            ))}
            {(dealsRes.data ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum negócio vinculado.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-2 p-4">
          <h2 className="text-sm font-semibold text-foreground">Documentos</h2>
          <EntityFilesTab
            entityType="organization"
            entityId={id}
            attachments={attachmentsRes.data ?? []}
          />
        </CardContent>
      </Card>
    </div>
  );
}
