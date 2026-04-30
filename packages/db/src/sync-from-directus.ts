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
import { and, eq, sql } from 'drizzle-orm';
import { getDb } from './client';
import { cards, projects, tribes, habitats, knowledgeItems, contacts } from './schema';

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

// ── communities → tribes + habitats ──────────────────────────
interface DirectusCommunity {
  id: string;
  name: string;
  slug: string | null;
  kind: string | null;
  url: string | null;
  member_count: number | null;
  notes: string | null;
  tags: string[] | null;
  entity_id: string | null;
}

const ENTITY_PROJECT_MAP: Record<string, string> = {
  // Directus entity uuid → MOS2 project slug
  'bef7d860-dd61-484f-adfc-203f53aef5e5': 'orit',
  'e8e21f83-f17b-47fd-930a-9108cbfdd94c': 'astrolas',
};

function classifyByEntity(entityId: string | null, fallbackText?: string): string | null {
  if (entityId && ENTITY_PROJECT_MAP[entityId]) return ENTITY_PROJECT_MAP[entityId];
  if (fallbackText) {
    if (/orit/i.test(fallbackText)) return 'orit';
    if (/astrolas/i.test(fallbackText)) return 'astrolas';
  }
  return null;
}

async function syncCommunities() {
  const list = await fetchDirectus<DirectusCommunity[]>(
    '/items/communities?fields=id,name,slug,kind,url,member_count,notes,tags,entity_id&limit=200',
  );
  console.log(`[sync] Found ${list.length} communities in Directus`);
  let imported = 0, skipped = 0, updated = 0;

  for (const c of list) {
    const projectId = classifyByEntity(c.entity_id, [c.name, c.notes ?? '', (c.tags ?? []).join(' ')].join(' '));
    if (!projectId) { skipped += 1; continue; }

    const proj = await db!.select({ id: projects.id }).from(projects).where(eq(projects.id, projectId)).limit(1);
    if (proj.length === 0) { skipped += 1; continue; }

    const slug = c.slug || c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
    const importedFrom = `directus:${c.id}`;

    // Each Directus community = one habitat under a "default" tribe per project.
    // Phase 9 will add proper tribe-creation UX; for now group all habitats under
    // a single 'general' tribe per project.
    let tribe = await db!.select({ id: tribes.id }).from(tribes)
      .where(and(eq(tribes.projectId, projectId), eq(tribes.slug, 'general'))).limit(1);
    if (tribe.length === 0) {
      const inserted = await db!.insert(tribes).values({
        tenantId: TENANT, projectId, slug: 'general', name: 'General audience',
        descText: 'Default tribe for imported communities. Refine later.',
      }).returning({ id: tribes.id });
      tribe = inserted;
    }

    const existing = await db!.select({ id: habitats.id }).from(habitats)
      .where(and(eq(habitats.projectId, projectId), eq(habitats.importedFrom, importedFrom))).limit(1);

    const habitatRow = {
      tenantId: TENANT, projectId,
      tribeId: tribe[0]!.id,
      kind: c.kind || 'forum',
      name: c.name,
      url: c.url,
      members: c.member_count ?? 0,
      activity: '',
      scrapeFrequency: 'manual',
      health: 'ok',
      importedFrom,
    };

    if (existing.length === 0) {
      await db!.insert(habitats).values(habitatRow);
      imported += 1;
    } else {
      await db!.update(habitats).set({ ...habitatRow, updatedAt: new Date() })
        .where(eq(habitats.id, existing[0]!.id));
      updated += 1;
    }
  }
  return { imported, skipped, updated };
}

// ── knowledge → knowledge_items ──────────────────────────────
interface DirectusKnowledge {
  id: string;
  title: string;
  content: string | null;
  kind: string | null;
  tags: string[] | null;
  entity_id: string | null;
}

async function syncKnowledge() {
  const list = await fetchDirectus<DirectusKnowledge[]>(
    '/items/knowledge?fields=id,title,content,kind,tags,entity_id&limit=500',
  );
  console.log(`[sync] Found ${list.length} knowledge items in Directus`);
  let imported = 0, skipped = 0, updated = 0;

  for (const k of list) {
    if (!k.title || !k.title.trim()) { skipped += 1; continue; }
    // Knowledge can be portfolio-wide (projectId=null) or project-scoped.
    const projectId = classifyByEntity(k.entity_id, [k.title, (k.tags ?? []).join(' ')].join(' '));
    const importedFrom = `directus:${k.id}`;

    const existing = await db!.select({ id: knowledgeItems.id }).from(knowledgeItems)
      .where(eq(knowledgeItems.importedFrom, importedFrom)).limit(1);

    const row = {
      tenantId: TENANT,
      projectId: projectId ?? null,
      kind: k.kind || 'playbook',
      title: k.title.slice(0, 500),
      content: k.content?.slice(0, 10000) ?? '',
      tags: Array.isArray(k.tags) ? k.tags : [],
      importedFrom,
    };

    if (existing.length === 0) {
      await db!.insert(knowledgeItems).values(row);
      imported += 1;
    } else {
      await db!.update(knowledgeItems).set({ ...row, updatedAt: new Date() })
        .where(eq(knowledgeItems.id, existing[0]!.id));
      updated += 1;
    }
  }
  return { imported, skipped, updated };
}

// ── contacts → contacts ──────────────────────────────────────
interface DirectusContact {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  company: string | null;
  notes: string | null;
  tags: string[] | null;
  entity_id: string | null;
}

async function syncContacts() {
  const list = await fetchDirectus<DirectusContact[]>(
    '/items/contacts?fields=id,name,email,role,company,notes,tags,entity_id&limit=500',
  );
  console.log(`[sync] Found ${list.length} contacts in Directus`);
  let imported = 0, skipped = 0, updated = 0;

  for (const c of list) {
    if (!c.name || !c.name.trim()) { skipped += 1; continue; }
    const projectId = classifyByEntity(c.entity_id, [c.name, c.notes ?? '', (c.tags ?? []).join(' ')].join(' '));
    const importedFrom = `directus:${c.id}`;

    const existing = await db!.select({ id: contacts.id }).from(contacts)
      .where(eq(contacts.importedFrom, importedFrom)).limit(1);

    const row = {
      tenantId: TENANT,
      projectId: projectId ?? null,
      name: c.name.slice(0, 200),
      email: c.email,
      role: c.role || '',
      company: c.company,
      socialHandles: {},
      notes: c.notes,
      tags: Array.isArray(c.tags) ? c.tags : [],
      importedFrom,
    };

    if (existing.length === 0) {
      await db!.insert(contacts).values(row);
      imported += 1;
    } else {
      await db!.update(contacts).set({ ...row, updatedAt: new Date() })
        .where(eq(contacts.id, existing[0]!.id));
      updated += 1;
    }
  }
  return { imported, skipped, updated };
}

// ── Main ─────────────────────────────────────────────────────
console.log(`[sync] Bridge READ-ONLY pull from ${DIRECTUS_URL} → tenant=${TENANT}`);

const r1 = await syncCampaigns();
console.log(`[sync] Campaigns → cards: imported=${r1.imported} updated=${r1.updated} skipped=${r1.skipped}`);

const r2 = await syncCommunities();
console.log(`[sync] Communities → tribes/habitats: imported=${r2.imported} updated=${r2.updated} skipped=${r2.skipped}`);

const r3 = await syncKnowledge();
console.log(`[sync] Knowledge → knowledge_items: imported=${r3.imported} updated=${r3.updated} skipped=${r3.skipped}`);

const r4 = await syncContacts();
console.log(`[sync] Contacts → contacts: imported=${r4.imported} updated=${r4.updated} skipped=${r4.skipped}`);

console.log('[sync] Done.');
process.exit(0);
