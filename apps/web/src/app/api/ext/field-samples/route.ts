import { NextResponse } from 'next/server';
import { checkAuth } from '../_auth';
import { errorResponse } from '@/lib/ext-route';
import { getDb, habitats } from '@mos2/db';
import { and, eq, sql, isNotNull, ne } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// Sample values per field từ habitats hiện có — giúp user quyết định
// chip field nào nên dùng lại (vd "title" đang có values "Astrology Memes",
// "Cosmic Talk", ... → đúng cái user muốn cho key "name").
//
// GET /api/ext/field-samples?page_kind=subreddit-about&fields=title,members,description
// → { ok, samples: { title: ["Astrology Memes", "Cosmic Talk", ...], ... } }

// Map field_name (schema key trong selector_overrides) → habitats column.
// Builtin only; custom fields chưa lưu vào columns riêng.
const FIELD_COLUMN_MAP: Record<string, keyof typeof habitats.$inferSelect> = {
  title: 'title',
  members: 'members',
  weekly_visitors: 'weeklyVisitors',
  weekly_contributions: 'weeklyContributions',
  privacy: 'privacy',
  created_at: 'createdAtSource',
  description: 'description',
  icon_url: 'iconUrl',
  // platform meta phổ biến khác (không scrape qua selector nhưng vẫn hữu ích)
  url: 'url',
  name: 'name',
  language: 'language',
  status: 'status',
  community_type: 'communityType',
};

const PAGE_KIND_PLATFORM: Record<string, string[]> = {
  'subreddit-about': ['reddit'],
};

export async function GET(req: Request) {
  const err = checkAuth(req);
  if (err) return err;

  const url = new URL(req.url);
  const pageKind = url.searchParams.get('page_kind') || '';
  const fieldsParam = url.searchParams.get('fields') || '';
  const fields = fieldsParam.split(',').map((s) => s.trim()).filter(Boolean);

  if (!fields.length) {
    return errorResponse('fields query param required', 400);
  }

  const db = getDb();
  if (!db) return errorResponse('db unavailable', 503);

  // Filter habitats theo platforms phù hợp page_kind (nếu có)
  const platformKeys = PAGE_KIND_PLATFORM[pageKind] || [];

  const samples: Record<string, Array<{ value: string; habitat: string }>> = {};

  for (const field of fields) {
    const col = FIELD_COLUMN_MAP[field];
    if (!col) { samples[field] = []; continue; }

    try {
      const rows = await db
        .select({
          value: habitats[col] as never,
          habitatName: habitats.name,
        })
        .from(habitats)
        .where(and(
          eq(habitats.tenantId, 'self'),
          platformKeys.length === 1
            ? eq(habitats.platformKey, platformKeys[0]!)
            : sql`1=1`,
          isNotNull(habitats[col] as never),
          ne(habitats[col] as never, ''),
        ))
        .orderBy(sql`${habitats.lastSyncAt} DESC NULLS LAST`)
        .limit(8);

      // Dedup theo value (nhiều habitat có thể privacy='public' giống nhau)
      const seen = new Set<string>();
      const uniq: Array<{ value: string; habitat: string }> = [];
      for (const r of rows) {
        const v = r.value;
        if (v == null) continue;
        const sv = String(v).trim();
        if (!sv || sv === '0' || seen.has(sv)) continue;
        seen.add(sv);
        uniq.push({ value: sv, habitat: r.habitatName });
        if (uniq.length >= 4) break;
      }
      samples[field] = uniq;
    } catch (e) {
      console.warn('[field-samples]', field, (e as Error).message);
      samples[field] = [];
    }
  }

  return NextResponse.json({ ok: true, page_kind: pageKind, samples });
}
