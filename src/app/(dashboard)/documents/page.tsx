import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { DocumentsList, type DocumentRow } from "./documents-list";

export default async function DocumentsPage() {
  const supabase = await createClient();

  const attachments = await fetchAllRows((from, to) =>
    supabase
      .from("attachments")
      .select(
        "id, file_name, storage_path, size_bytes, created_at, category, expires_at, entity_type, entity_id",
      )
      .order("created_at", { ascending: false })
      .range(from, to),
  );

  const idsByType = { deal: new Set<string>(), contact: new Set<string>(), organization: new Set<string>() };
  for (const a of attachments) {
    idsByType[a.entity_type as keyof typeof idsByType]?.add(a.entity_id);
  }

  const [dealNames, contactNames, organizationNames] = await Promise.all([
    idsByType.deal.size
      ? supabase.from("deals").select("id, title").in("id", [...idsByType.deal])
      : { data: [] as { id: string; title: string }[] },
    idsByType.contact.size
      ? supabase.from("contacts").select("id, name").in("id", [...idsByType.contact])
      : { data: [] as { id: string; name: string }[] },
    idsByType.organization.size
      ? supabase.from("organizations").select("id, name").in("id", [...idsByType.organization])
      : { data: [] as { id: string; name: string }[] },
  ]);

  const nameById = new Map<string, string>();
  for (const d of dealNames.data ?? []) nameById.set(d.id, d.title);
  for (const c of contactNames.data ?? []) nameById.set(c.id, c.name);
  for (const o of organizationNames.data ?? []) nameById.set(o.id, o.name);

  const linkByType: Record<string, string> = {
    deal: "/deals",
    contact: "/contacts/people",
    organization: "/contacts/organizations",
  };

  const documents: DocumentRow[] = attachments.map((a) => ({
    id: a.id,
    file_name: a.file_name,
    storage_path: a.storage_path,
    size_bytes: a.size_bytes,
    created_at: a.created_at,
    category: a.category,
    expires_at: a.expires_at,
    entity_type: a.entity_type,
    entity_name: nameById.get(a.entity_id) ?? "—",
    entity_href: `${linkByType[a.entity_type] ?? "#"}/${a.entity_id}`,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Documentos</h1>
        <p className="text-sm text-muted-foreground">
          Repositório central de arquivos de negócios, contatos e organizações
        </p>
      </div>

      <DocumentsList documents={documents} />
    </div>
  );
}
