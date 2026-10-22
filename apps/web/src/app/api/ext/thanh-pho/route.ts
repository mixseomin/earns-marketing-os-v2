import { NextResponse } from 'next/server';
import { checkAuth } from '../_auth';
import { getSocialLive } from '@/lib/social-traffic';
import { tinhThanhPho } from '@/lib/social-thanh-pho';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// GET /api/ext/thanh-pho → { ok, luc, mh } — mô hình thành phố Social (cùng số tab Social › 🏙 Thành phố) cho bản artifact
// (scripts/thanh-pho/dung-artifact.mjs dựng trang một tệp rồi đăng lên artifact anh đang mở — anh 22/10/2026 "thay thế cho màn artifact đang mở").
export async function GET(req: Request) {
  const err = await checkAuth(req); if (err) return err;
  const live = await getSocialLive();
  return NextResponse.json({ ok: true, luc: live.luc, mh: tinhThanhPho(live) });
}
