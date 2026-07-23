import { and, eq, ilike, or, sql } from 'drizzle-orm';
import { habitats, platforms, platformTechnologies } from '@mos2/db';

// Assemble a per-host "site guide" từ dữ liệu MOS2 đã có (platform signup + habitat posting rules +
// các page_kind đã capture DOM). READ-ONLY — không ghi. Route quyết định cache/promote.
// Model: platform-info/route.ts (resolve platform+habitat theo host) mở rộng thêm posting + pages.
// Lazy v1: fields signup = platform.signupFields, fallback technology.signupFields (bỏ merge phức tạp).
type Db = NonNullable<ReturnType<typeof import('@mos2/db').getDb>>;

export interface SiteGuideSections {
  signup: Record<string, unknown> | null;
  posting: Record<string, unknown> | null;
  pages: Array<{ pageKind: string; samples: number; lastAt: string | null }>;
  notes: string;
  grounded: { samples: number; at: string | null };
}

export interface AssembledGuide {
  sections: SiteGuideSections;
  resolved: { platformKey: string | null; technologyKey: string | null; habitatId: number | null; projectId: string | null };
}

const hostSlug = (host: string) => host.replace(/^www\./, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase();

export async function assembleSiteGuide(db: Db, opts: { host: string; projectId?: string | null }): Promise<AssembledGuide> {
  const host = opts.host.trim();
  const projectId = (opts.projectId || '').trim() || null;

  // ── platform (signup section) ──
  const [platform] = await db
    .select({
      key: platforms.key, label: platforms.label, signupUrl: platforms.signupUrl,
      signupVerify: platforms.signupVerify, notes: platforms.notes,
      technologyKey: platforms.technologyKey, signupFields: platforms.signupFields,
      techLabel: platformTechnologies.label, techFields: platformTechnologies.signupFields,
    })
    .from(platforms)
    .leftJoin(platformTechnologies, eq(platforms.technologyKey, platformTechnologies.key))
    .where(or(ilike(platforms.signupUrl, `%${host}%`), eq(platforms.key, hostSlug(host))))
    .limit(1);

  const signup = platform ? {
    platformKey: platform.key, label: platform.label, signupUrl: platform.signupUrl,
    signupVerify: platform.signupVerify || '', notes: platform.notes || '',
    technologyKey: platform.technologyKey || null, techLabel: platform.techLabel || null,
    fields: Array.isArray(platform.signupFields) && platform.signupFields.length
      ? platform.signupFields
      : (Array.isArray(platform.techFields) ? platform.techFields : []),
  } : null;

  // ── habitat (posting section) — project-scoped nếu có projectId ──
  const habWhere = projectId
    ? and(ilike(habitats.url, `%${host}%`), eq(habitats.projectId, projectId))
    : ilike(habitats.url, `%${host}%`);
  const [hab] = await db
    .select({
      id: habitats.id, name: habitats.name, technologyKey: habitats.technologyKey,
      postingRules: habitats.postingRules, postingRulesUrl: habitats.postingRulesUrl,
      joinChecklist: habitats.joinChecklist, dominantTopics: habitats.dominantTopics,
      forbiddenTopics: habitats.forbiddenTopics, minKarma: habitats.minKarma,
      minAccountAgeDays: habitats.minAccountAgeDays, minPosts: habitats.minPosts,
      linksAllowedAfter: habitats.linksAllowedAfter, modStrictness: habitats.modStrictness,
      communityType: habitats.communityType, voiceProfile: habitats.voiceProfile,
      language: habitats.language, projectId: habitats.projectId,
    })
    .from(habitats)
    .where(habWhere)
    .limit(1);

  const posting = hab ? {
    habitatId: hab.id, name: hab.name, postingRules: hab.postingRules || '',
    postingRulesUrl: hab.postingRulesUrl || '', joinChecklist: hab.joinChecklist || [],
    dominantTopics: hab.dominantTopics || [], forbiddenTopics: hab.forbiddenTopics || [],
    minKarma: hab.minKarma || 0, minAccountAgeDays: hab.minAccountAgeDays || 0, minPosts: hab.minPosts || 0,
    linksAllowedAfter: hab.linksAllowedAfter || '', modStrictness: hab.modStrictness || '',
    communityType: hab.communityType || '', voiceProfile: hab.voiceProfile || '', language: hab.language || '',
  } : null;

  // ── pages đã học (dom_samples theo page_kind) + grounding ──
  const rows = (await db.execute(sql`
    SELECT page_kind, count(*)::int AS samples, max(captured_at) AS last_at
    FROM dom_samples WHERE hostname = ${host}
    GROUP BY page_kind ORDER BY samples DESC`)) as Array<{ page_kind: string; samples: number; last_at: string | null }>;
  const pages = rows.map((r) => ({ pageKind: String(r.page_kind), samples: Number(r.samples), lastAt: r.last_at ? String(r.last_at) : null }));
  const totalSamples = pages.reduce((a, p) => a + p.samples, 0);
  const groundedAt = pages.reduce<string | null>((a, p) => (p.lastAt && (!a || p.lastAt > a) ? p.lastAt : a), null);

  return {
    sections: { signup, posting, pages, notes: '', grounded: { samples: totalSamples, at: groundedAt } },
    resolved: {
      platformKey: platform?.key || null,
      technologyKey: platform?.technologyKey || hab?.technologyKey || null,
      habitatId: hab?.id ?? null,
      projectId: hab?.projectId || projectId,
    },
  };
}
