// Bridge sync: pull entity data from as.on.tc Directus → MOS2 DB.
// Decision 2026-04-28 v5: READ-ONLY. Never write back to Directus.
//
// What gets synced:
//   - campaigns (title 'Orit:' / 'Astrolas:') → cards in respective project
//
// Idempotent: tag 'imported:directus:<uuid>' on each row, skip if exists.
//
// Run: npm run sync-from-directus
// (requires DATABASE_URL + DIRECTUS_URL + DIRECTUS_TOKEN in env)

import 'dotenv/config';
import { and, eq } from 'drizzle-orm';
import { getDb } from './client';
import { cards, projects } from './schema';

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://as.on.tc';
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN || '';
const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

if (!DIRECTUS_TOKEN) {
  console.error('DIRECTUS_TOKEN not set.');
  process.exit(1);
}

const db = getDb();
if (!db) {
  console.error('DATABASE_URL not set.');
  process.exit(1);
}

interface DirectusCampaign {
  id: string;
  title: string;
  type: string;
  status: string;
  channel: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  content_md: string | null;
  url: string | null;
  cost: string | null;
  revenue: string | null;
  notes: string | null;
  tags: string[] | null;
}

async function fetchDirectus<T>(path: string): Promise<T> {
  const res = await fetch(`${DIRECTUS_URL}${path}`, {
    headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Directus ${res.status}: ${await res.text()}`);
  const json = await res.json() as { data: T };
  return json.data;
}

// ── Map Directus campaign → MOS2 card ────────────────────────
function classifyProject(title: string): string | null {
  if (/^orit:/i.test(title)) return 'orit';
  if (/^astrolas:/i.test(title)) return 'astrolas';
  return null;
}

function statusToCol(status: string): string {
  switch (status.toLowerCase()) {
    case 'planned':   return 'needs';
    case 'draft':     return 'needs';
    case 'scheduled': return 'deciding';
    case 'active':
    case 'live':
    case 'running':   return 'approved';
    case 'completed':
    case 'done':      return 'approved';
    case 'cancelled':
    case 'cancelled': return 'escalated';
    default:          return 'needs';
  }
}

function mkCardRef(uuid: string, channel: string | null): string {
  const prefix = (channel || 'CAM').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || 'CAM';
  return `${prefix}-${uuid.slice(0, 5).toUpperCase()}`;
}

async function syncCampaigns(): Promise<{ imported: number; skipped: number; updated: number }> {
  const campaigns = await fetchDirectus<DirectusCampaign[]>(
    '/items/campaigns?fields=id,title,type,status,channel,scheduled_at,published_at,content_md,url,cost,revenue,notes,tags&limit=200',
  );
  console.log(`[sync] Found ${campaigns.length} campaigns in Directus`);

  let imported = 0, skipped = 0, updated = 0;

  for (const c of campaigns) {
    const projectId = classifyProject(c.title);
    if (!projectId) { skipped += 1; continue; }

    // Verify project exists in MOS2
    const proj = await db!.select({ id: projects.id }).from(projects).where(eq(projects.id, projectId)).limit(1);
    if (proj.length === 0) { skipped += 1; continue; }

    const importedTag = `imported:directus:${c.id}`;
    const cardRef = mkCardRef(c.id, c.channel);
    const cleanTitle = c.title.replace(/^(orit|astrolas):\s*/i, '').trim();

    // Check if already imported (search by tag in jsonb)
    const existing = await db!
      .select({ id: cards.id })
      .from(cards)
      .where(and(
        eq(cards.tenantId, TENANT),
        eq(cards.projectId, projectId),
        eq(cards.cardRef, cardRef),
      ))
      .limit(1);

    const tags = [
      ...(Array.isArray(c.tags) ? c.tags : []),
      c.channel ? `channel:${c.channel}` : '',
      importedTag,
    ].filter(Boolean);

    const cardData = {
      tenantId: TENANT,
      projectId,
      cardRef,
      col: statusToCol(c.status),
      title: cleanTitle,
      squadKey: 'content',                // default squad — user can change
      level: 3 as const,                  // launch campaigns = approve required
      money: c.revenue && Number(c.revenue) > 0 ? `+${c.revenue} (actual)` : null,
      due: c.scheduled_at ? new Date(c.scheduled_at).toISOString().slice(0, 10) : 'open',
      urgent: false,
      tags,
      agentRef: null,
      body: c.content_md ? c.content_md.slice(0, 2000) : c.notes,
    };

    if (existing.length === 0) {
      await db!.insert(cards).values(cardData);
      imported += 1;
      console.log(`[sync] + ${projectId}: ${cardRef} ${cleanTitle.slice(0, 60)}`);
    } else {
      // Update only spec fields (title, body, status, due) — keep user-edited col/level/money.
      await db!
        .update(cards)
        .set({
          title: cardData.title,
          body: cardData.body,
          tags: cardData.tags,
          updatedAt: new Date(),
        })
        .where(eq(cards.id, existing[0]!.id));
      updated += 1;
    }
  }

  return { imported, skipped, updated };
}

// ── Main ─────────────────────────────────────────────────────
console.log(`[sync] Bridge READ-ONLY pull from ${DIRECTUS_URL} → tenant=${TENANT}`);

const r1 = await syncCampaigns();
console.log(`[sync] Campaigns → cards: imported=${r1.imported} updated=${r1.updated} skipped=${r1.skipped}`);

console.log('[sync] Done.');
process.exit(0);
