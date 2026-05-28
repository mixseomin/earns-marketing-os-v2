import { NextResponse } from 'next/server';
import { checkAuth } from '../_auth';
import { getDb, habitats, platformAccounts, communityBriefs } from '@mos2/db';
import { and, eq, sql } from 'drizzle-orm';
import { logExtCall, extractExtMeta } from '@/lib/ext-call-log';
import { detectLang } from '@/lib/lang-detect';

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
  title?: string;  // display title — khác name (slug primary identifier)
  rules?: Array<{ priority: number; short_name: string; description: string }>;
  hot_titles?: string[];
  source_url?: string;
  captured_at?: string;
  // v1.4.9 (migration 0059): Reddit sidebar metadata
  weekly_visitors?: number;
  weekly_contributions?: number;
  privacy?: 'public' | 'restricted' | 'private' | '';
  created_at_source?: string | null;  // ISO timestamp
  // v1.4.9: viewer membership state (auto-update community_briefs.joinStatus
  // cho account đang login trên Reddit ↔ habitat này).
  viewer_handle?: string | null;       // 'Lithervard' (no u/ prefix)
  viewer_joined?: boolean | null;      // true | false | null (chưa detect)
  // migration 0066: generic kv cho mọi custom field user thêm qua ext
  // ("+ New custom field" → field_name → value extract qua selector).
  // Server merge với existing scraped_meta, không replace toàn bộ.
  scraped_meta?: Record<string, unknown>;
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

  // Reddit URL path đôi khi lowercase đôi khi capital — DB có thể lưu
  // 'r/Astrologia' nhưng ext gửi 'r/astrologia'. Lookup case-insensitive
  // để không tạo duplicate habitat record.
  const [row] = await db
    .select({ id: habitats.id, name: habitats.name, projectId: habitats.projectId })
    .from(habitats)
    .where(and(
      eq(habitats.platformKey, platformKey),
      sql`LOWER(${habitats.name}) = LOWER(${name})`,
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

  const startedAt = Date.now();
  const extMeta = extractExtMeta(req);

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

  // Upsert match priority:
  //   1. Discord: scraped_meta.discord_guild_id (1 guild = 1 habitat, dù channel
  //      detector ext gửi name khác nhau cho từng channel page → KHÔNG tạo
  //      duplicate habitat per channel).
  //   2. (project_id, platform_key, LOWER(name)) — case-insensitive cho Reddit
  //      'r/Astrologia' === 'r/astrologia'.
  const guildId = body.platform_key === 'discord'
    ? (body.scraped_meta as Record<string, unknown> | undefined)?.discord_guild_id
    : null;
  let existing: Array<{ id: number }> = [];
  if (typeof guildId === 'string' && guildId) {
    existing = await db
      .select({ id: habitats.id })
      .from(habitats)
      .where(and(
        eq(habitats.projectId, body.projectId),
        eq(habitats.platformKey, body.platform_key),
        sql`${habitats.scrapedMeta}->>'discord_guild_id' = ${guildId}`,
      ))
      .limit(1);
  }
  if (existing.length === 0) existing = await db
    .select({ id: habitats.id })
    .from(habitats)
    .where(and(
      eq(habitats.projectId, body.projectId),
      eq(habitats.platformKey, body.platform_key),
      sql`LOWER(${habitats.name}) = LOWER(${body.name})`,
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
    // v1.4.9 (mig 0059)
    weeklyVisitors: body.weekly_visitors ?? 0,
    weeklyContributions: body.weekly_contributions ?? 0,
    // Normalize privacy: LLM scrape có thể trả 'Public' / 'PUBLIC' /
    // 'Private community' nhưng constraint chỉ accept lowercase enum.
    // Bất kỳ value lạ → '' (skip) để không break check constraint 23514.
    privacy: (() => {
      const raw = (body.privacy ?? '').toLowerCase().trim();
      if (raw.includes('private')) return 'private';
      if (raw.includes('restricted')) return 'restricted';
      if (raw.includes('public')) return 'public';
      return '';
    })(),
    createdAtSource: body.created_at_source ? new Date(body.created_at_source) : null,
    description: body.description ?? '',
    title: body.title ?? '',
    importedFrom: 'mos2-crew-ext',
    // scrapedMeta merge xử lý SAU khi load existing row — không set ở đây
    lastSyncAt: new Date(),
    updatedAt: new Date(),
  };

  let habitatId: number;
  let action: 'created' | 'updated' | 'cloned';
  if (existing.length > 0) {
    habitatId = existing[0]!.id;
    action = 'updated';
    // Merge scraped_meta với row hiện tại (KHÔNG replace — giữ field
    // user đã scrape lần trước, chỉ thêm/update keys mới từ payload).
    const finalPatch: Record<string, unknown> = { ...patch };
    if (body.scraped_meta && typeof body.scraped_meta === 'object') {
      const cur = await db
        .select({ scrapedMeta: habitats.scrapedMeta, language: habitats.language })
        .from(habitats)
        .where(eq(habitats.id, habitatId))
        .limit(1);
      const curMeta = (cur[0]?.scrapedMeta as Record<string, unknown>) || {};
      finalPatch.scrapedMeta = { ...curMeta, ...body.scraped_meta };
      // Auto-detect language nếu habitats.language còn rỗng — chỉ chạy khi
      // có description hoặc rules đủ dài. KHÔNG override nếu user đã set.
      const curLang = (cur[0]?.language ?? '').trim();
      if (!curLang) {
        const corpus = [
          (body.title ?? '') as string,
          (body.description ?? '') as string,
          postingRules,
        ].filter(Boolean).join('\n');
        const detected = detectLang(corpus);
        if (detected !== 'unknown') {
          finalPatch.language = detected;
        }
      }
    }
    await db.update(habitats).set(finalPatch).where(eq(habitats.id, habitatId));
  } else {
    // Habitat chưa có trong project hiện tại — check xem cùng platform+name
    // có tồn tại ở project KHÁC không. Nếu có, clone data fields project-agnostic
    // (members/description/rules/privacy/weekly stats/topics/links/min-gates...)
    // để project mới không phải re-scrape từ đầu. Project-specific fields
    // (tribeId/status/voiceProfile/voiceNotes/fewShotExamples/visualStyleDescriptor)
    // giữ default — user customize trong project mới.
    const sibling = await db
      .select()
      .from(habitats)
      .where(and(
        eq(habitats.tenantId, 'self'),
        eq(habitats.platformKey, body.platform_key),
        sql`LOWER(${habitats.name}) = LOWER(${body.name})`,
      ))
      .orderBy(sql`${habitats.lastSyncAt} DESC NULLS LAST`)
      .limit(1);

    if (sibling.length > 0) {
      // Clone fields project-agnostic từ sibling (data từ platform, không
      // phụ thuộc project). patch (từ body) sẽ ghi đè nếu ext gửi value
      // mới — sibling chỉ là fallback cho field ext miss.
      const sib = sibling[0]!;
      const inheritedFromSibling = {
        members: patch.members || sib.members,
        iconUrl: patch.iconUrl || sib.iconUrl,
        postingRules: patch.postingRules || sib.postingRules,
        postingRulesUrl: patch.postingRulesUrl || sib.postingRulesUrl,
        minAccountAgeDays: patch.minAccountAgeDays || sib.minAccountAgeDays,
        minKarma: patch.minKarma || sib.minKarma,
        minPosts: patch.minPosts || sib.minPosts,
        weeklyVisitors: patch.weeklyVisitors || sib.weeklyVisitors,
        weeklyContributions: patch.weeklyContributions || sib.weeklyContributions,
        privacy: patch.privacy || sib.privacy,
        createdAtSource: patch.createdAtSource || sib.createdAtSource,
        description: patch.description || sib.description,
        title: patch.title || sib.title,
        modStrictness: patch.modStrictness || sib.modStrictness,
        communityType: patch.communityType || sib.communityType,
        dominantTopics: (Array.isArray(patch.dominantTopics) && patch.dominantTopics.length > 0) ? patch.dominantTopics : sib.dominantTopics,
        // Project-agnostic Reddit metadata
        language: sib.language,
        linksAllowedAfter: sib.linksAllowedAfter,
        forbiddenTopics: sib.forbiddenTopics,
        bestPostTimes: sib.bestPostTimes,
        technologyKey: sib.technologyKey,
        allowedFormatsOverride: sib.allowedFormatsOverride,
      };
      const inserted = await db.insert(habitats).values({
        tenantId: 'self',
        projectId: body.projectId,
        kind: sib.kind,                    // giữ nguyên kind đã từng detect
        name: body.name,
        url: body.url ?? sib.url,
        platformKey: body.platform_key,
        ...patch,
        ...inheritedFromSibling,
        importedFrom: `mos2-crew-ext:cloned-from-habitat:${sib.id}`,
      }).returning({ id: habitats.id });
      habitatId = inserted[0]!.id;
      action = 'cloned';
    } else {
      // Auto-detect language khi habitat hoàn toàn mới (lần đầu seed). Sibling
      // branch đã inherit sib.language, branch sibling-không-tồn-tại cần tự detect.
      const corpus = [
        (body.title ?? '') as string,
        (body.description ?? '') as string,
        postingRules,
      ].filter(Boolean).join('\n');
      const detected = detectLang(corpus);
      const inserted = await db.insert(habitats).values({
        tenantId: 'self',
        projectId: body.projectId,
        kind: body.kind || 'subreddit',
        name: body.name,
        url: body.url,
        platformKey: body.platform_key,
        ...patch,
        scrapedMeta: body.scraped_meta || {},
        ...(detected !== 'unknown' ? { language: detected } : {}),
      }).returning({ id: habitats.id });
      habitatId = inserted[0]!.id;
      action = 'created';
    }
  }

  // ── v1.4.9: viewer membership upsert ──────────────────────────
  // Nếu ext detect được logged-in handle + join state → tìm
  // platform_accounts (same platform_key + handle) → upsert
  // community_briefs.join_status. KHÔNG fail toàn endpoint nếu lookup
  // miss (account chưa được tạo trong MOS2 = bình thường).
  let viewerUpdate: { handle: string; joined: boolean; briefAction: string } | null = null;
  if (body.viewer_handle && typeof body.viewer_joined === 'boolean') {
    try {
      const cleanHandle = body.viewer_handle.replace(/^u\//i, '').replace(/^@/, '');
      const acct = await db.select({ id: platformAccounts.id })
        .from(platformAccounts)
        .where(and(
          eq(platformAccounts.tenantId, 'self'),
          eq(platformAccounts.platformKey, body.platform_key),
          eq(platformAccounts.handle, cleanHandle),
        ))
        .limit(1);

      // CHỈ /api/ext/briefs được update joinStatus — endpoint dedicated
      // dùng scraped_meta.join_status (text-pattern match chính xác Join/
      // Joined/Leave). /api/ext/habitats KHÔNG ghi đè brief joinStatus
      // — vì body.viewer_joined đến từ heuristic attr 'joined' trên
      // <shreddit-join-button> có thể delay khi Reddit re-render → race.
      //
      // /api/ext/habitats chỉ AUTO-CREATE brief minimal nếu chưa có
      // (relationship account↔habitat lần đầu) — KHÔNG update existing.
      if (acct.length > 0) {
        const accountId = acct[0]!.id;
        const existingBrief = await db.select({ id: communityBriefs.id })
          .from(communityBriefs)
          .where(and(
            eq(communityBriefs.accountId, accountId),
            eq(communityBriefs.habitatId, habitatId),
          ))
          .limit(1);

        if (existingBrief.length > 0) {
          viewerUpdate = { handle: cleanHandle, joined: body.viewer_joined, briefAction: 'exists-keep' };
        } else {
          // Auto-create brief minimal (chưa có brief cho cặp account-habitat
          // này). joinStatus default từ heuristic (sẽ được /api/ext/briefs
          // sync chính xác sau khi ext scrape join_status authoritative).
          const newJoinStatus = body.viewer_joined ? 'joined' : 'not_joined';
          await db.insert(communityBriefs).values({
            tenantId: 'self',
            projectId: body.projectId,
            accountId,
            habitatId,
            joinStatus: newJoinStatus,
            joinedAt: body.viewer_joined ? new Date() : null,
          });
          viewerUpdate = { handle: cleanHandle, joined: body.viewer_joined, briefAction: 'created' };
        }
      } else {
        viewerUpdate = { handle: cleanHandle, joined: body.viewer_joined, briefAction: 'account-not-found' };
      }
    } catch (e) {
      console.warn('[ext/habitats] viewer upsert failed:', e);
    }
  }

  const response = {
    ok: true,
    id: habitatId,
    action,
    fields: Object.keys(patch).length,
    viewer: viewerUpdate,
  };

  // Log mọi POST → /ext-debug audit. Lưu giá trị các field key để biết
  // ext đang gửi data đúng hay vẫn 0.
  await logExtCall({
    endpoint: 'habitats', method: 'POST',
    extVersion: extMeta.extVersion, pageUrl: extMeta.pageUrl,
    payloadMeta: {
      projectId: body.projectId, name: body.name,
      platform_key: body.platform_key, kind: body.kind,
      members: body.members, weekly_visitors: body.weekly_visitors,
      weekly_contributions: body.weekly_contributions,
      privacy: body.privacy, created_at_source: body.created_at_source,
      has_description: !!body.description, has_icon: !!body.icon_url,
      rules_count: body.rules?.length ?? 0,
      hot_titles_count: body.hot_titles?.length ?? 0,
      viewer_handle: body.viewer_handle, viewer_joined: body.viewer_joined,
      scraped_meta_keys: body.scraped_meta ? Object.keys(body.scraped_meta) : [],
      scraped_meta: body.scraped_meta || null,
    },
    responseMeta: response,
    status: 200, durationMs: Date.now() - startedAt,
  });

  return NextResponse.json(response);
}
