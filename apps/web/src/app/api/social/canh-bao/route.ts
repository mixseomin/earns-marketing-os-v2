import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// POST /api/social/canh-bao { id, ghi } → đánh dấu cảnh báo nền tảng ĐÃ XỬ (platform_alerts.xong_luc + xong_ghi; không xoá dòng — cùng luật canh-bao.mjs xong).
// Thành phố (city.on.tc › khu Tài nguyên › kho tài khoản) gọi khi anh bấm "✅ Đã xử" trên một cảnh báo (anh 23/10/2026). Chỉ admin.
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const b = (await req.json().catch(() => null)) as { id?: unknown; ghi?: unknown } | null;
  const id = Number(b?.id), ghi = typeof b?.ghi === 'string' && b.ghi.trim() ? b.ghi.trim().slice(0, 300) : 'đã xử trên thành phố';
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'id không hợp lệ' }, { status: 400 });
  const d = getDb(); if (!d) return NextResponse.json({ error: 'chưa nối DB' }, { status: 503 });
  const r = (await d.execute(sql`UPDATE platform_alerts SET xong_luc = now(), xong_ghi = ${`${ghi} · ${me.email ?? me.id}`} WHERE id = ${id} AND xong_luc IS NULL RETURNING id`)) as unknown as { id: number }[];
  return NextResponse.json({ ok: r.length > 0, id });
}
