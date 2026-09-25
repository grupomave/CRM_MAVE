import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { PeopleToolbar } from "./people-toolbar";
import { PeopleList, type PersonRow } from "./people-list";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Pessoas" };

export default async function PeoplePage() {
  const supabase = await createClient();
  const contacts = await fetchAllRows<PersonRow>((from, to) =>
    supabase
      .from("contacts")
      .select("id, name, email, phone, whatsapp, organizations ( id, name )")
      .order("created_at", { ascending: false })
      .range(from, to) as unknown as PromiseLike<{ data: PersonRow[] | null; error: unknown }>,
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Pessoas"
        description="Contatos individuais"
        actions={<PeopleToolbar />}
      />

      <PeopleList contacts={contacts ?? []} />
    </div>
  );
}
