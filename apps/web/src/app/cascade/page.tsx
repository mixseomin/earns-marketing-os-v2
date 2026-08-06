import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { AppShell } from '@/components/app-shell';
import { CascadeView, type DbTrigger } from '@/components/cascade-view';
import { getCurrentUser } from '@/lib/auth';
import { getMode, listProjects } from '@/lib/data';
import { dbList } from '@/lib/db-helpers';

export const dynamic = 'force-dynamic';

// /cascade — admin/portfolio surface to verify the entity-change → refresh mechanism:
// live Postgres triggers (data cascade) + the ENTITY_DEPS cache-cascade graph.
export default async function CascadeRoute() {
  const me = await getCurrentUser();
  if (me?.role !== 'admin') redirect('/');

  const [mode, projects, triggers] = await Promise.all([
    getMode('affiliate'),
    listProjects(),
    dbList<DbTrigger>(
      sql`SELECT c.relname AS table_name, t.tgname AS trigger_name, p.proname AS func_name,
                 pg_get_triggerdef(t.oid) AS def
          FROM pg_trigger t
          JOIN pg_class c ON c.oid = t.tgrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
          JOIN pg_proc p ON p.oid = t.tgfoid
          WHERE NOT t.tgisinternal AND n.nspname = 'public'
          ORDER BY c.relname, t.tgname`,
      (r) => ({ table: String(r.table_name), name: String(r.trigger_name), func: String(r.func_name), def: String(r.def) }),
    ).catch(() => [] as DbTrigger[]),
  ]);

  return (
    <AppShell mode={mode} projects={projects} isPortfolio
      currentUser={me ? { id: me.id, displayName: me.displayName, email: me.email, role: me.role, specialty: me.specialty } : undefined}>
      <CascadeView triggers={triggers} />
    </AppShell>
  );
}
