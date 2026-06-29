import { NextResponse } from 'next/server';
import { checkAuth } from '../_auth';
import { PAGE_KINDS } from '@/lib/canon/page-kinds';

export const dynamic = 'force-dynamic';

// Catalog page_kind chuẩn (lib/canon/page-kinds.ts) cho dropdown ext — chọn từ list, KHÔNG gõ bừa.
// platformOnly = page_kind chỉ hợp 1 platform (vd subreddit-about = reddit) → ext lọc theo platform.
export async function GET(req: Request) {
  const err = await checkAuth(req); if (err) return err;
  return NextResponse.json({
    ok: true,
    pageKinds: PAGE_KINDS.map((p) => ({ key: p.key, label: p.label, mode: p.mode, meaning: p.meaning, platformOnly: p.platformOnly || null })),
  });
}
