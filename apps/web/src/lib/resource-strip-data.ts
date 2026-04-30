// Server-only helper that builds the Dashboard ResourceStrip from real DB counts.
// Demos / portfolio (no projectId) fall back to mock in the caller.
//
// Vault status:
//   - Accounts (platform_accounts): healthy = status='active'; warmup = creating/todo
//   - Contacts: simple count
//   - Knowledge (knowledge_items): simple count
//   - Media / Infra / Budget: chưa có DB table — placeholder "phase 8"
//
// Pattern khớp `lib/data.ts` tryDb wrapper: log + fallback to mock on DB error.

import { and, eq, sql } from 'drizzle-orm';
import { getDb, platformAccounts, contacts, knowledgeItems } from '@mos2/db';
import { RESOURCE_DATA, type StripItem } from './mock/resources';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

export async function getResourceStripData(projectId: string): Promise<StripItem[]> {
  const db = getDb();
  if (!db) return RESOURCE_DATA.strip;

  try {
    const [accountsRow, contactsRow, knowledgeRow] = await Promise.all([
      db.select({
        total: sql<number>`COUNT(*)::int`,
        healthy: sql<number>`COUNT(*) FILTER (WHERE status = 'active')::int`,
        warmup: sql<number>`COUNT(*) FILTER (WHERE status IN ('todo','creating','warming'))::int`,
        blocked: sql<number>`COUNT(*) FILTER (WHERE status IN ('blocked','banned'))::int`,
      }).from(platformAccounts).where(and(eq(platformAccounts.tenantId, TENANT), eq(platformAccounts.projectId, projectId))).then((r) => r[0]!),

      db.select({ count: sql<number>`COUNT(*)::int` })
        .from(contacts).where(and(eq(contacts.tenantId, TENANT), eq(contacts.projectId, projectId))).then((r) => r[0]!),

      db.select({ count: sql<number>`COUNT(*)::int` })
        .from(knowledgeItems).where(and(eq(knowledgeItems.tenantId, TENANT), eq(knowledgeItems.projectId, projectId))).then((r) => r[0]!),
    ]);

    // Tone logic: blocked > 0 → bad. warmup > 0 → warn. healthy/empty → ok.
    const accountsTone: StripItem['tone'] =
      accountsRow.blocked > 0 ? 'bad'
      : accountsRow.warmup > 0 ? 'warn'
      : 'ok';
    const accountsNote =
      accountsRow.blocked > 0 ? `${accountsRow.blocked} blocked`
      : accountsRow.warmup > 0 ? `${accountsRow.warmup} cần warm-up`
      : accountsRow.total === 0 ? 'thêm trong /squads' : 'ok';

    return [
      {
        icon: '🔐', lbl: 'Accounts',
        val: accountsRow.total > 0 ? `${accountsRow.healthy}/${accountsRow.total} healthy` : 'chưa có',
        note: accountsNote,
        tone: accountsTone,
      },
      { icon: '🎬', lbl: 'Media',     val: 'chưa có vault',                  note: 'phase 8',          tone: 'ok' },
      {
        icon: '📇', lbl: 'Contacts',
        val: contactsRow.count > 0 ? `${contactsRow.count} contacts` : 'chưa có',
        note: contactsRow.count > 0 ? 'KOC/PR/lead' : 'thêm trong /resources',
        tone: 'ok',
      },
      { icon: '🌐', lbl: 'Infra',     val: 'chưa có vault',                  note: 'phase 8',          tone: 'ok' },
      { icon: '💳', lbl: 'Budget',    val: 'chưa có vault',                  note: 'phase 8',          tone: 'ok' },
      {
        icon: '📚', lbl: 'Knowledge',
        val: knowledgeRow.count > 0 ? `${knowledgeRow.count} items` : 'chưa có',
        note: knowledgeRow.count > 0 ? 'playbook/spec/note' : 'thêm trong /resources',
        tone: 'ok',
      },
    ];
  } catch (e) {
    console.warn('[mos2/resource-strip] DB query failed, falling back to mock:', (e as Error).message);
    return RESOURCE_DATA.strip;
  }
}
