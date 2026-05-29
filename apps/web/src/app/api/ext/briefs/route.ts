import { NextResponse } from 'next/server';
import { checkAuth } from '../_auth';
import { getDb, communityBriefs, platformAccounts, habitats } from '@mos2/db';
import { and, eq, sql } from 'drizzle-orm';
import { logExtCall, extractExtMeta } from '@/lib/ext-call-log';
import { getBriefFieldSchema } from '@/lib/brief-field-schema';

export const dynamic = 'force-dynamic';

// /api/ext/briefs — upsert brief metadata khi ext scrape relationship
// (viewer account ↔ habitat) trên 1 page (vd reddit subreddit).
//
// Payload:
//   platform_key, habitat_name (slug), viewer_handle,
//   scraped_meta: { [field_key]: value } theo brief-field-schema.ts
//
// Server logic:
//   1. Lookup account qua (platform_key, viewer_handle)
//   2. Lookup habitat qua (platform_key, name) — projectId scoped nếu pass
//   3. Upsert community_briefs(account, habitat) — merge scraped_meta JSONB
//   4. Mirror join_status từ scraped_meta.join_status sang column joinStatus
//      (giữ backward compat với UI/queries cũ).

interface BriefReq {
  projectId?: string;            // Optional — lookup habitat trong project; nếu thiếu, lookup any
  platform_key: string;
  habitat_name: string;
  viewer_handle: string;
  scraped_meta: Record<string, unknown>;
}

export async function POST(req: Request) {
  const err = checkAuth(req);
  if (err) return err;

  const startedAt = Date.now();
  const extMeta = extractExtMeta(req);
  const body = (await req.json()) as BriefReq;

  if (!body.platform_key || !body.habitat_name || !body.viewer_handle) {
    return NextResponse.json({
      ok: false,
      error: 'platform_key + habitat_name + viewer_handle required',
    }, { status: 400 });
  }

  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, error: 'db unavailable' }, { status: 503 });

  const cleanHandle = body.viewer_handle.replace(/^u\//i, '').replace(/^@/, '');

  // 1. Lookup account
  const acct = await db.select({ id: platformAccounts.id })
    .from(platformAccounts)
    .where(and(
      eq(platformAccounts.tenantId, 'self'),
      eq(platformAccounts.platformKey, body.platform_key),
      eq(platformAccounts.handle, cleanHandle),
    ))
    .limit(1);

  if (acct.length === 0) {
    await logExtCall({
      endpoint: 'briefs', method: 'POST',
      extVersion: extMeta.extVersion, pageUrl: extMeta.pageUrl,
      payloadMeta: { platform_key: body.platform_key, habitat_name: body.habitat_name, handle: cleanHandle },
      responseMeta: { ok: false, reason: 'account_not_found' },
      status: 200, durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({
      ok: false,
      reason: 'account_not_found',
      hint: `Account @${cleanHandle} (${body.platform_key}) chưa tồn tại trong MOS2. Tạo account trước.`,
    });
  }
  const accountId = acct[0]!.id;

  // 2. Lookup habitat (tìm bất kỳ habitat trong tenant; ưu tiên project nếu có).
  // Case-insensitive match — Reddit lưu 'r/Astrologia' nhưng ext gửi
  // 'r/astrologia' (URL path lowercase) → bypass match nếu eq strict.
  const habitatQuery = db.select({ id: habitats.id, projectId: habitats.projectId })
    .from(habitats)
    .where(and(
      eq(habitats.tenantId, 'self'),
      eq(habitats.platformKey, body.platform_key),
      sql`LOWER(${habitats.name}) = LOWER(${body.habitat_name})`,
    ))
    .limit(5);
  const habs = await habitatQuery;
  if (habs.length === 0) {
    return NextResponse.json({
      ok: false,
      reason: 'habitat_not_found',
      hint: `Habitat ${body.habitat_name} (${body.platform_key}) chưa được tạo. F5 page để autoSave habitat trước.`,
    });
  }
  // Ưu tiên habitat trong projectId nếu pass; không thì habitat đầu tiên
  const targetHabitat = body.projectId
    ? habs.find((h) => h.projectId === body.projectId) || habs[0]!
    : habs[0]!;
  const habitatId = targetHabitat.id;

  // 3. Filter scraped_meta theo schema — chỉ accept keys khai báo (avoid
  //    rác từ ext bug). Custom field ngoài schema → drop với log warning.
  const schema = getBriefFieldSchema('subreddit-about'); // TODO: derive per platform_key
  const allowedKeys = new Set(schema.map((s) => s.key));
  const cleanMeta: Record<string, unknown> = {};
  const droppedKeys: string[] = [];
  for (const [k, v] of Object.entries(body.scraped_meta || {})) {
    if (allowedKeys.has(k) && v != null && v !== '') {
      cleanMeta[k] = v;
    } else if (v != null && v !== '') {
      droppedKeys.push(k);
    }
  }

  // 4. Upsert brief — merge scraped_meta + mirror join_status sang column
  const existingBrief = await db.select({
    id: communityBriefs.id,
    joinStatus: communityBriefs.joinStatus,
    scrapedMeta: communityBriefs.scrapedMeta,
  })
    .from(communityBriefs)
    .where(and(
      eq(communityBriefs.accountId, accountId),
      eq(communityBriefs.habitatId, habitatId),
    ))
    .limit(1);

  const newJoinStatus = (cleanMeta.join_status as string | undefined) || null;
  const mergedMeta = {
    ...(existingBrief[0]?.scrapedMeta as Record<string, unknown> ?? {}),
    ...cleanMeta,
  };

  let briefId: number;
  let action: 'created' | 'updated';
  if (existingBrief.length > 0) {
    briefId = existingBrief[0]!.id;
    action = 'updated';
    const patch: Record<string, unknown> = {
      scrapedMeta: mergedMeta,
      updatedAt: new Date(),
    };
    if (newJoinStatus && ['joined', 'not_joined', 'unknown'].includes(newJoinStatus)) {
      patch.joinStatus = newJoinStatus;
      if (newJoinStatus === 'joined') {
        patch.joinedAt = new Date();
      }
    }
    await db.update(communityBriefs)
      .set(patch)
      .where(eq(communityBriefs.id, briefId));
  } else {
    const inserted = await db.insert(communityBriefs)
      .values({
        tenantId: 'self',
        projectId: targetHabitat.projectId,
        accountId,
        habitatId,
        joinStatus: (newJoinStatus && ['joined', 'not_joined', 'unknown'].includes(newJoinStatus)) ? newJoinStatus : 'not_joined',
        joinedAt: newJoinStatus === 'joined' ? new Date() : null,
        scrapedMeta: mergedMeta,
      })
      .returning({ id: communityBriefs.id });
    briefId = inserted[0]!.id;
    action = 'created';

    // Auto-create default seeding schedule cho brief mới — bằng không
    // brief sẽ KHÔNG xuất hiện trong seeding queue page (queue join
    // seeding_schedules). Default: lane='mix', frequency=7d, all phases.
    // ON CONFLICT (brief_id, content_type, language) → safe idempotent.
    try {
      await db.execute(sql`
        INSERT INTO seeding_schedules
          (tenant_id, project_id, brief_id, content_type, language, frequency_days, active_phases, paused, auto_draft)
        VALUES ('self', ${targetHabitat.projectId}, ${briefId}, 'mix', '', 7,
                '["warm-up","value","bridge","seed","direct"]'::jsonb, false, false)
        ON CONFLICT (brief_id, content_type, language) DO NOTHING
      `);
    } catch (e) {
      // KHÔNG fail toàn bộ brief create chỉ vì schedule lỗi — log + continue
      console.error('[ext briefs POST] auto-schedule fail:', e);
    }
  }

  await logExtCall({
    endpoint: 'briefs', method: 'POST',
    extVersion: extMeta.extVersion, pageUrl: extMeta.pageUrl,
    payloadMeta: {
      platform_key: body.platform_key, habitat_name: body.habitat_name,
      handle: cleanHandle, fields: Object.keys(cleanMeta), droppedKeys,
    },
    responseMeta: { ok: true, briefId, action, joinStatus: newJoinStatus },
    status: 200, durationMs: Date.now() - startedAt,
  });

  return NextResponse.json({
    ok: true,
    briefId,
    action,
    accountId,
    habitatId,
    fields: Object.keys(cleanMeta).length,
    droppedKeys,
  });
}
