import { NextResponse } from 'next/server';
import { checkAuth } from '../_auth';
import { PAGE_KINDS, guessPageKind } from '@/lib/canon/page-kinds';
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { canonPlatformKey } from '@/lib/habitat-platform-map';

export const dynamic = 'force-dynamic';

// Catalog page_kind chuẩn (lib/canon/page-kinds.ts) cho dropdown ext — chọn từ list, KHÔNG gõ bừa.
// ?platformKey=X → kèm `saved` = page_kind ĐÃ có selector cho platform đó (kể cả kind tùy chỉnh ngoài catalog).
// ?url=Y → kèm `guessed` = page_kind đoán cho TRANG HIỆN TẠI (để dialog phản ánh đúng trang đang đứng, ko nhầm với kind đã học khác).
export async function GET(req: Request) {
  const err = await checkAuth(req); if (err) return err;
  const sp = new URL(req.url).searchParams;
  const platformKey = sp.get('platformKey');
  const url = sp.get('url');
  const guessed = url ? guessPageKind(url) : null;
  let saved: string[] = [];
  if (platformKey) {
    const db = getDb();
    if (db) {
      const rows = await db.execute(sql`
        SELECT DISTINCT page_kind FROM selector_overrides
        WHERE scope_kind = 'platform' AND scope_key = ${canonPlatformKey(platformKey)}
        ORDER BY page_kind`);
      saved = (rows as unknown as Array<{ page_kind: string }>).map((r) => r.page_kind).filter(Boolean);
    }
  }
  return NextResponse.json({
    ok: true,
    saved,
    guessed,
    pageKinds: PAGE_KINDS.map((p) => ({ key: p.key, label: p.label, mode: p.mode, meaning: p.meaning, platformOnly: p.platformOnly || null })),
  });
}
