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

import { and, eq, isNull, or, sql } from 'drizzle-orm';
import { getDb, platformAccounts, contacts, knowledgeItems, mediaAssets, infraResources, budgetEntries } from '@mos2/db';
import { RESOURCE_DATA, type StripItem } from './mock/resources';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

export async function getResourceStripData(projectId: string): Promise<StripItem[]> {
  const db = getDb();
  if (!db) return RESOURCE_DATA.strip;

  try {
    const [accountsRow, contactsRow, knowledgeRow, mediaRow, infraRow, budgetRow] = await Promise.all([
      db.select({
        total: sql<number>`COUNT(*)::int`,
        healthy: sql<number>`COUNT(*) FILTER (WHERE status = 'active')::int`,
        warmup: sql<number>`COUNT(*) FILTER (WHERE status IN ('todo','creating','warming'))::int`,
        blocked: sql<number>`COUNT(*) FILTER (WHERE status IN ('blocked','banned'))::int`,
      }).from(platformAccounts).where(and(eq(platformAccounts.tenantId, TENANT), eq(platformAccounts.projectId, projectId))).then((r) => r[0]!),

      // Contacts/Knowledge: include portfolio-wide (project_id IS NULL).
      db.select({ count: sql<number>`COUNT(*)::int` })
        .from(contacts).where(and(
          eq(contacts.tenantId, TENANT),
          or(eq(contacts.projectId, projectId), isNull(contacts.projectId)),
        )).then((r) => r[0]!),

      db.select({ count: sql<number>`COUNT(*)::int` })
        .from(knowledgeItems).where(and(
          eq(knowledgeItems.tenantId, TENANT),
          or(eq(knowledgeItems.projectId, projectId), isNull(knowledgeItems.projectId)),
        )).then((r) => r[0]!),

      db.select({
        total: sql<number>`COUNT(*)::int`,
        hot: sql<number>`COUNT(*) FILTER (WHERE hot = true)::int`,
        bytes: sql<number>`COALESCE(SUM(size_bytes), 0)::bigint`,
      }).from(mediaAssets).where(and(
        eq(mediaAssets.tenantId, TENANT),
        or(eq(mediaAssets.projectId, projectId), isNull(mediaAssets.projectId)),
      )).then((r) => r[0]!),

      db.select({
        total: sql<number>`COUNT(*)::int`,
        active: sql<number>`COUNT(*) FILTER (WHERE status = 'active')::int`,
        broken: sql<number>`COUNT(*) FILTER (WHERE status IN ('expired','broken'))::int`,
      }).from(infraResources).where(and(
        eq(infraResources.tenantId, TENANT),
        or(eq(infraResources.projectId, projectId), isNull(infraResources.projectId)),
      )).then((r) => r[0]!),

      // Budget: net 30d (income - expense). amountCents stored as integer.
      db.select({
        income30d: sql<number>`COALESCE(SUM(amount_cents) FILTER (WHERE kind = 'income' AND occurred_at > NOW() - INTERVAL '30 days'), 0)::bigint`,
        expense30d: sql<number>`COALESCE(SUM(amount_cents) FILTER (WHERE kind != 'income' AND occurred_at > NOW() - INTERVAL '30 days'), 0)::bigint`,
        total: sql<number>`COUNT(*)::int`,
      }).from(budgetEntries).where(and(
        eq(budgetEntries.tenantId, TENANT),
        or(eq(budgetEntries.projectId, projectId), isNull(budgetEntries.projectId)),
      )).then((r) => r[0]!),
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

    // Format size: bytes (bigint) → MB/GB
    const fmtSize = (b: number) => {
      if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
      if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
      return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    };
    const net = Number(budgetRow.income30d) - Number(budgetRow.expense30d);
    const fmtVnd = (cents: number) => `${(cents / 1000).toLocaleString('vi-VN')}k`;

    const infraTone: StripItem['tone'] = infraRow.broken > 0 ? 'warn' : 'ok';

    return [
      {
        icon: '🔐', lbl: 'Accounts',
        val: accountsRow.total > 0 ? `${accountsRow.healthy}/${accountsRow.total} healthy` : 'chưa có',
        note: accountsNote, tone: accountsTone,
      },
      {
        icon: '🎬', lbl: 'Media',
        val: mediaRow.total > 0 ? `${fmtSize(Number(mediaRow.bytes))} · ${mediaRow.total} files` : 'chưa có',
        note: mediaRow.hot > 0 ? `🔥 ${mediaRow.hot} hot` : (mediaRow.total > 0 ? 'no hot' : 'add asset'),
        tone: 'ok',
      },
      {
        icon: '📇', lbl: 'Contacts',
        val: contactsRow.count > 0 ? `${contactsRow.count} contacts` : 'chưa có',
        note: contactsRow.count > 0 ? 'KOC/PR/lead' : 'thêm trong /resources', tone: 'ok',
      },
      {
        icon: '🌐', lbl: 'Infra',
        val: infraRow.total > 0 ? `${infraRow.active}/${infraRow.total} active` : 'chưa có',
        note: infraRow.broken > 0 ? `${infraRow.broken} broken` : (infraRow.total > 0 ? 'ok' : 'add resource'),
        tone: infraTone,
      },
      {
        icon: '💳', lbl: 'Budget',
        val: budgetRow.total > 0 ? `Net 30d: ${fmtVnd(net)}` : 'chưa có',
        note: budgetRow.total > 0 ? `${budgetRow.total} entries` : 'add entry',
        tone: net < 0 ? 'warn' : 'ok',
      },
      {
        icon: '📚', lbl: 'Knowledge',
        val: knowledgeRow.count > 0 ? `${knowledgeRow.count} items` : 'chưa có',
        note: knowledgeRow.count > 0 ? 'playbook/spec/note' : 'thêm trong /resources', tone: 'ok',
      },
    ];
  } catch (e) {
    console.warn('[mos2/resource-strip] DB query failed, falling back to mock:', (e as Error).message);
    return RESOURCE_DATA.strip;
  }
}
