import { notFound } from "next/navigation";
import { KanbanSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { EntityFilesTab } from "@/components/entity-files-tab";
import { RelatedList } from "@/components/related-list";
import { formatCurrencyBRL } from "@/lib/utils";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { getCurrentUser } from "@/lib/data/lists";
import { DEAL_STATUS_BADGE, DEAL_STATUS_LABEL } from "@/lib/filters/deals";
import { ContactDetailForm } from "./contact-detail-form";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("contacts").select("name").eq("id", id).maybeSingle();
  return { title: data?.name ?? "Pessoa" };
}

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: contact } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", id)
    .single();

  if (!contact) notFound();

  const me = await getCurrentUser();
  const canDelete = me?.role === "admin" || me?.role === "gestor";

  const [organizations, dealsRes, attachmentsRes] = await Promise.all([
    fetchAllRows<{ id: string; name: string }>((from, to) =>
      supabase.from("organizations").select("id, name").order("name").range(from, to),
    ),
    supabase
      .from("deals")
      .select("id, title, value, status")
      .eq("contact_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("attachments")
      .select("id, file_name, storage_path, size_bytes, created_at, category, expires_at")
      .eq("entity_type", "contact")
      .eq("entity_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const organizationName = organizations.find((o) => o.id === contact.organization_id)?.name;

  return (
    <div className="mx-auto flex w-full max-w-detail flex-col gap-5">
      <PageHeader
        title={contact.name}
        description={[contact.job_title, organizationName].filter(Boolean).join(" · ") || undefined}
        breadcrumbs={[{ label: "Pessoas", href: "/contacts/people" }, { label: contact.name }]}
      />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <ContactDetailForm contact={contact as never} organizations={organizations} canDelete={canDelete} />

        <div className="flex flex-col gap-5">
          <RelatedList
            title="Negócios"
            icon={KanbanSquare}
            emptyText="Nenhum negócio vinculado"
            items={(dealsRes.data ?? []).map((d) => ({
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
                entityType="contact"
                entityId={id}
                entityName={contact.name}
                attachments={attachmentsRes.data ?? []}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
