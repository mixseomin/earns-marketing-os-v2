import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { canonPlatformKey } from '@/lib/habitat-platform-map';

export const dynamic = 'force-dynamic';

// POST /api/ext/accounts/stats
// Body: { handle, platformKey, stats: { karma?, created?, followers?, … } }
// Merge profile metrics scraped (trained account-profile selectors) vào
// platform_accounts.account_stats (jsonb, latest snapshot). Generic mọi platform —
// stat keys tuỳ platform. Idempotent: ghi đè key cũ, giữ key khác.
interface Body { handle?: string; platformKey?: string; stats?: Record<string, unknown> }

export async function POST(req: Request) {
  const err = checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 });
  const body = (await req.json().catch(() => ({}))) as Body;
  const handle = String(body.handle ?? '').replace(/^@/, '').replace(/^u\//i, '').trim();
  const platformKey = canonPlatformKey(body.platformKey);
  const raw = (body.stats && typeof body.stats === 'object') ? body.stats : null;
  if (!handle || !platformKey || !raw) {
    return NextResponse.json({ ok: false, error: 'handle, platformKey, stats required' }, { status: 400 });
  }
  // Sanitize: chỉ giữ scalar (number/bool/string ngắn), bỏ key dài/giá trị rỗng.
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!k || k.length > 40) continue;
    if (typeof v === 'number' && Number.isFinite(v)) clean[k] = v;
    else if (typeof v === 'boolean') clean[k] = v;
    else if (typeof v === 'string' && v.trim()) clean[k] = v.trim().slice(0, 200);
  }
  if (!Object.keys(clean).length) return NextResponse.json({ ok: false, error: 'no valid stat fields' }, { status: 400 });
  clean.fetched_at = new Date().toISOString();

  const rows = await db.execute(sql`
    UPDATE platform_accounts
    SET account_stats = COALESCE(account_stats, '{}'::jsonb) || ${JSON.stringify(clean)}::jsonb, updated_at = NOW()
    WHERE platform_key = ${platformKey} AND LOWER(handle) = LOWER(${handle})
    RETURNING id, account_stats`);
  const r = (rows as unknown as Array<Record<string, unknown>>)[0];
  if (!r) return NextResponse.json({ ok: false, reason: 'account_not_found', error: `@${handle} chưa map trên ${platformKey}` }, { status: 200 });
  return NextResponse.json({ ok: true, accountId: Number(r.id), accountStats: r.account_stats });
}
