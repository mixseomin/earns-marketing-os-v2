import { NextResponse } from 'next/server';
import { checkAuth } from '../_auth';
import { getDb, platforms } from '@mos2/db';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// GET /api/ext/viewer-selectors
// Returns map { platform_key: { login: string[], handle?: string[] } } cho mọi
// platform có viewer_selectors set. Ext fetch khi load → cache local →
// loginProbe() chạy theo selector từ DB (không hardcode trong content.js).
//
// Refresh strategy: ext cache 10min trong chrome.storage.local key
// 'viewer_selectors_cache' = { updatedAt, data }. Sidepanel mở force refetch.
export async function GET(req: Request) {
  const err = checkAuth(req);
  if (err) return err;

  const db = getDb();
  if (!db) return NextResponse.json({ selectors: {}, source: 'db-unavailable' });

  const rows = await db
    .select({
      key: platforms.key,
      viewerSelectors: platforms.viewerSelectors,
    })
    .from(platforms);

  const selectors: Record<string, { login?: string[]; handle?: string[] }> = {};
  for (const row of rows) {
    const v = (row.viewerSelectors as { login?: string[]; handle?: string[] }) || {};
    // Chỉ trả về platforms có ít nhất 1 selector (skip empty {}).
    if (Array.isArray(v.login) && v.login.length > 0) {
      selectors[row.key] = {
        login: v.login,
        ...(Array.isArray(v.handle) && v.handle.length > 0 ? { handle: v.handle } : {}),
      };
    }
  }

  return NextResponse.json({ selectors, updatedAt: Date.now() });
}

// PATCH /api/ext/viewer-selectors
// Body: { platform_key: string, type: 'login' | 'handle', selector: string, action: 'add' | 'remove' }
// Append/remove 1 selector vào array. Validate selector (try querySelector
// trên empty doc, reject if throws).
export async function PATCH(req: Request) {
  const err = checkAuth(req);
  if (err) return err;

  const db = getDb();
  if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });

  const body = await req.json() as {
    platform_key: string;
    type: 'login' | 'handle';
    selector: string;
    action: 'add' | 'remove';
  };

  if (!body.platform_key) return NextResponse.json({ error: 'Missing platform_key' }, { status: 400 });
  if (body.type !== 'login' && body.type !== 'handle') return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  if (!body.selector || typeof body.selector !== 'string') return NextResponse.json({ error: 'Missing selector' }, { status: 400 });
  if (body.action !== 'add' && body.action !== 'remove') return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  // Light validate — reject obvious junk (XSS attempt, nesting too deep)
  const sel = body.selector.trim();
  if (sel.length > 500) return NextResponse.json({ error: 'Selector quá dài (>500 chars)' }, { status: 400 });
  if (/<script|javascript:/i.test(sel)) return NextResponse.json({ error: 'Selector chứa script' }, { status: 400 });

  // Read existing → modify array → write
  const [row] = await db
    .select({ viewerSelectors: platforms.viewerSelectors })
    .from(platforms)
    .where(eq(platforms.key, body.platform_key))
    .limit(1);

  if (!row) return NextResponse.json({ error: 'Platform not found' }, { status: 404 });

  const current = (row.viewerSelectors as { login?: string[]; handle?: string[] }) || {};
  const arr = current[body.type] || [];

  let newArr: string[];
  if (body.action === 'add') {
    if (arr.includes(sel)) return NextResponse.json({ ok: true, message: 'Already exists', selectors: current });
    newArr = [...arr, sel];
  } else {
    newArr = arr.filter((s) => s !== sel);
  }

  const updated = { ...current, [body.type]: newArr };
  await db.update(platforms)
    .set({ viewerSelectors: updated, updatedAt: new Date() })
    .where(eq(platforms.key, body.platform_key));

  return NextResponse.json({ ok: true, platform_key: body.platform_key, selectors: updated });
}
