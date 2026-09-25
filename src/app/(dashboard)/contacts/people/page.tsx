import { createClient } from "@/lib/supabase/server";
import { canReassignOwner, getCurrentUser, loadOwners, loadPersonRows } from "@/lib/data/lists";
import { PageHeader } from "@/components/ui/page-header";
import { ExportExcelButton } from "@/components/list/export-excel-button";
import { PeopleToolbar } from "./people-toolbar";
import { PeopleList } from "./people-list";

export const metadata = { title: "Pessoas" };

export default async function PeoplePage() {
  const supabase = await createClient();
  const [owners, me] = await Promise.all([loadOwners(supabase), getCurrentUser()]);
  const contacts = await loadPersonRows(supabase, owners);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Pessoas"
        description="Contatos individuais"
        actions={
          <>
            <ExportExcelButton entity="pessoas" />
            <PeopleToolbar />
          </>
        }
      />

      <PeopleList contacts={contacts} owners={owners} canReassign={canReassignOwner(me?.role)} />
    </div>
  );
}
