import { NextResponse } from 'next/server';
import { checkAuth } from '../_auth';
import { getDb, habitats } from '@mos2/db';
import { and, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// Trans-form data từ MOS2 Crew extension (subreddit detector) thành
// HabitatInput. Format match content.js HABITAT_DETECTORS.reddit_subreddit.
interface ExtHabitatPayload {
  platform: string;
  platform_key: string;
  kind: string;
  name: string;
  url: string;
  icon_url?: string;
  members?: number | null;
  description?: string;
  rules?: Array<{ priority: number; short_name: string; description: string }>;
  hot_titles?: string[];
  source_url?: string;
  captured_at?: string;
}

// GET /api/ext/habitats?platform_key=reddit&name=r%2Fastrology → duplicate check
export async function GET(req: Request) {
  const err = checkAuth(req);
  if (err) return err;

  const db = getDb();
  if (!db) return NextResponse.json({ found: false });

  const { searchParams } = new URL(req.url);
  const platformKey = searchParams.get('platform_key');
  const name = searchParams.get('name');
  const projectId = searchParams.get('projectId');

  if (!platformKey || !name) {
    return NextResponse.json({ error: 'platform_key + name required' }, { status: 400 });
  }

  const [row] = await db
    .select({ id: habitats.id, name: habitats.name, projectId: habitats.projectId })
    .from(habitats)
    .where(and(
      eq(habitats.platformKey, platformKey),
      eq(habitats.name, name),
      ...(projectId ? [eq(habitats.projectId, projectId)] : []),
    ))
    .limit(1);

  return NextResponse.json({ found: !!row, habitat: row ?? null });
}

// POST /api/ext/habitats { projectId, ...ExtHabitatPayload }
//   → upsert habitat (UNIQUE per project + platform_key + name)
//   → trả id + auto-detected fields (topics, posting_rules, members)
export async function POST(req: Request) {
  const err = checkAuth(req);
  if (err) return err;

  const db = getDb();
  if (!db) return NextResponse.json({ error: 'DB not configured' }, { status: 503 });

  const body = (await req.json()) as ExtHabitatPayload & { projectId: string };
  if (!body.projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });
  if (!body.platform_key || !body.name) return NextResponse.json({ error: 'platform_key + name required' }, { status: 400 });

  // Posting rules: convert rule array → markdown bullets sort by priority
  const postingRules = (body.rules ?? [])
    .sort((a, b) => a.priority - b.priority)
    .map((r) => `- **${r.short_name}** — ${(r.description ?? '').replace(/\n+/g, ' ').trim()}`)
    .join('\n');

  // Min age / karma / posts: regex từ rule descriptions
  const rulesText = (body.rules ?? []).map((r) => `${r.short_name}\n${r.description ?? ''}`).join('\n').toLowerCase();
  const ageM = rulesText.match(/(\d+)\s*(?:day|d)\s*(?:old)?\s*account/);
  const karmaM = rulesText.match(/(\d+)\s*(?:combined\s+)?karma/);
  const postsM = rulesText.match(/(\d+)\s*(?:prior\s+|previous\s+)?posts?\s+(?:before|required|min)/);
  const minAccountAgeDays = ageM ? Number(ageM[1]) : 0;
  const minKarma = karmaM ? Number(karmaM[1]) : 0;
  const minPosts = postsM ? Number(postsM[1]) : 0;

  // Dominant topics: frequency từ hot titles, stopword filter, top 8
  const STOP = new Set(['the','a','an','i','is','of','to','and','in','for','on','my','you','what','how','why','when','with','this','that','it','at','as','be','are','was','were','can','do','does','if','or','but','not','so','no','any','all','new','first','last','one','two','three','your','their','our','his','her','from','about','into','out','up','down','over','under','than','then','now','just','also','very','more','most','some','few','many','much','only','too']);
  const freq = new Map<string, number>();
  for (const title of body.hot_titles ?? []) {
    const words = title.toLowerCase().match(/[a-z]{4,}/g) ?? [];
    for (const w of words) {
      if (STOP.has(w)) continue;
      freq.set(w, (freq.get(w) ?? 0) + 1);
    }
  }
  const dominantTopics = [...freq.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([w]) => w);

  // Mod strictness heuristic
  const strictHits = (body.rules ?? []).filter((r) => /(perma)?ban|removed|strictly|not allowed|forbidden/i.test(r.description ?? '')).length;
  const modStrictness = (body.rules?.length ?? 0) >= 8 || strictHits >= 4 ? 'high'
    : (body.rules?.length ?? 0) >= 4 || strictHits >= 2 ? 'medium' : 'low';

  // Community type heuristic từ description
  const desc = (body.description ?? '').toLowerCase();
  let communityType = 'discussion';
  if (desc.includes('question') || desc.includes('ask') || desc.includes('help')) communityType = 'q-a';
  else if (desc.includes('news') || desc.includes('update')) communityType = 'news';
  else if (desc.includes('share') || desc.includes('showcase') || desc.includes('portfolio')) communityType = 'sharing';

  // Posting rules URL canonical (Reddit-specific)
  const postingRulesUrl = body.platform_key === 'reddit'
    ? `${body.url.replace(/\/$/, '')}/about/rules`
    : '';

  // Upsert: check existing by (project_id, platform_key, name)
  const existing = await db
    .select({ id: habitats.id })
    .from(habitats)
    .where(and(
      eq(habitats.projectId, body.projectId),
      eq(habitats.platformKey, body.platform_key),
      eq(habitats.name, body.name),
    ))
    .limit(1);

  const patch = {
    members: body.members ?? 0,
    iconUrl: body.icon_url ?? null,
    postingRules,
    postingRulesUrl,
    minAccountAgeDays,
    minKarma,
    minPosts,
    dominantTopics,
    modStrictness,
    communityType,
    importedFrom: 'mos2-crew-ext',
    lastSyncAt: new Date(),
    updatedAt: new Date(),
  };

  if (existing.length > 0) {
    await db.update(habitats)
      .set(patch)
      .where(eq(habitats.id, existing[0]!.id));
    return NextResponse.json({ ok: true, id: existing[0]!.id, action: 'updated', fields: Object.keys(patch).length });
  }

  const inserted = await db.insert(habitats).values({
    tenantId: 'self',
    projectId: body.projectId,
    kind: body.kind || 'subreddit',
    name: body.name,
    url: body.url,
    platformKey: body.platform_key,
    ...patch,
  }).returning({ id: habitats.id });

  return NextResponse.json({ ok: true, id: inserted[0]?.id, action: 'created', fields: Object.keys(patch).length });
}
