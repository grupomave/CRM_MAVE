import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { PeopleToolbar } from "./people-toolbar";
import { PeopleList, type PersonRow } from "./people-list";

export default async function PeoplePage() {
  const supabase = await createClient();
  const contacts = await fetchAllRows<PersonRow>((from, to) =>
    supabase
      .from("contacts")
      .select("id, name, email, phone, whatsapp, organizations ( name )")
      .order("created_at", { ascending: false })
      .range(from, to) as unknown as PromiseLike<{ data: PersonRow[] | null; error: unknown }>,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Pessoas</h1>
          <p className="text-sm text-muted-foreground">Contatos individuais</p>
        </div>
        <PeopleToolbar />
      </div>

      <PeopleList contacts={contacts ?? []} />
    </div>
  );
}
