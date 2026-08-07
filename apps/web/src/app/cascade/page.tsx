import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { AppShell } from '@/components/app-shell';
import { CascadeView, type DbTrigger, type FkEdge } from '@/components/cascade-view';
import { getCurrentUser } from '@/lib/auth';
import { getMode, listProjects } from '@/lib/data';
import { dbList } from '@/lib/db-helpers';

export const dynamic = 'force-dynamic';

// /cascade — verify surface for "CRUD an entity → what cascades". Entity relationships come
// from real FK constraints (pg_constraint) + junction tables; data-cascade from pg_trigger;
// UI-refresh from ENTITY_DEPS (the touchEntity map). All live, nothing hand-authored.
export default async function CascadeRoute() {
  const me = await getCurrentUser();
  if (me?.role !== 'admin') redirect('/');

  const [mode, projects, triggers, fks] = await Promise.all([
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
    dbList<FkEdge>(
      sql`SELECT src.relname AS src, a.attname AS col, tgt.relname AS tgt
          FROM pg_constraint con
          JOIN pg_class src ON src.oid = con.conrelid
          JOIN pg_class tgt ON tgt.oid = con.confrelid
          JOIN pg_namespace n ON n.oid = src.relnamespace
          JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
          WHERE con.contype = 'f' AND n.nspname = 'public'`,
      (r) => ({ src: String(r.src), col: String(r.col), tgt: String(r.tgt) }),
    ).catch(() => [] as FkEdge[]),
  ]);

  return (
    <AppShell mode={mode} projects={projects} isPortfolio
      currentUser={me ? { id: me.id, displayName: me.displayName, email: me.email, role: me.role, specialty: me.specialty } : undefined}>
      <CascadeView triggers={triggers} fks={fks} />
    </AppShell>
  );
}
