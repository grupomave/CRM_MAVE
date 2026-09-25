import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { KanbanSquare, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyBRL } from "@/lib/utils";
import { OrganizationDetailForm } from "./organization-detail-form";
import { EntityFilesTab } from "@/components/entity-files-tab";
import { PageHeader } from "@/components/ui/page-header";

import { RelatedList } from "@/components/related-list";
import { DEAL_STATUS_BADGE, DEAL_STATUS_LABEL } from "@/lib/filters/deals";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("organizations").select("name").eq("id", id).maybeSingle();
  return { title: data?.name ?? "Organização" };
}

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

  const contacts = contactsRes.data ?? [];
  const deals = dealsRes.data ?? [];

  return (
    <div className="mx-auto flex w-full max-w-detail flex-col gap-5">
      <PageHeader
        title={organization.name}
        description={[organization.sector, organization.city && `${organization.city}${organization.state ? `/${organization.state}` : ""}`]
          .filter(Boolean)
          .join(" · ") || undefined}
        breadcrumbs={[
          { label: "Organizações", href: "/contacts/organizations" },
          { label: organization.name },
        ]}
      />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <OrganizationDetailForm organization={organization as never} canDelete={canDelete} />

        <div className="flex flex-col gap-5">
          <RelatedList
            title="Pessoas"
            icon={Users}
            emptyText="Nenhuma pessoa vinculada"
            items={contacts.map((c) => ({
              id: c.id,
              href: `/contacts/people/${c.id}`,
              title: c.name,
              subtitle: c.email ?? c.phone,
            }))}
          />
          <RelatedList
            title="Negócios"
            icon={KanbanSquare}
            emptyText="Nenhum negócio vinculado"
            items={deals.map((d) => ({
              id: d.id,
              href: `/deals/${d.id}`,
              title: d.title,
              trailing: (
                <>
                  <span className="numeric text-caption text-muted-foreground">{formatCurrencyBRL(d.value)}</span>
                  <Badge variant={DEAL_STATUS_BADGE[d.status as keyof typeof DEAL_STATUS_BADGE] ?? "neutral"}>
                    {DEAL_STATUS_LABEL[d.status as keyof typeof DEAL_STATUS_LABEL] ?? d.status}
                  </Badge>
                </>
              ),
            }))}
          />
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Documentos</CardTitle>
            </CardHeader>
            <CardContent>
              <EntityFilesTab
                entityType="organization"
                entityId={id}
                entityName={organization.name}
                attachments={attachmentsRes.data ?? []}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
