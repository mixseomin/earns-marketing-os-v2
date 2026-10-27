import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// ⚡ MÁY ĐĂNG THỜI GIAN THỰC — Social › Lịch đăng (anh 27/10/2026: "sửa lại page này để kiểm soát việc triển khai thời gian thực").
// GET: trạng thái từng máy × nền sau lượt 10 phút gần nhất (may_dang_trang_thai, dang-lien-tuc ghi), lịch sử lượt, bài đã lên / hỏng 24h (xv_may_nhat_ky),
//      ô kế hoạch hôm nay + đã đăng chưa, video dựng / chấm 24h. POST (admin): { ma, chay } bật tắt máy · { ma, nen, nghi_den } nghỉ nền tới hết ngày (null = bỏ nghỉ).
export async function GET() {
  if (!(await getCurrentUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const d = getDb(); if (!d) return NextResponse.json({ error: 'không có DB' }, { status: 500 });
  const hom = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const [tt, luot, suKien, kh, video, may] = await Promise.all([
    d.execute(sql`SELECT t.ma, m.ten AS may_ten, m.chay, t.nen, t.luc, t.may_mac, t.quyet, t.ly_do, t.slug, t.url,
        (SELECT e->>'nghi_den' FROM jsonb_array_elements(m.dang) e WHERE e->>'nen' = t.nen LIMIT 1) AS nghi_den,
        (SELECT e->>'may' FROM jsonb_array_elements(m.dang) e WHERE e->>'nen' = t.nen LIMIT 1) AS may_cua_nen,
        (SELECT count(*) FROM xv_may_video v, jsonb_each(v.da_dang) x WHERE v.may_id = m.id AND x.key = t.nen AND x.value->>'ngay' = ${hom}) AS da_hom
      FROM may_dang_trang_thai t JOIN xv_may m ON m.ma = t.ma ORDER BY m.ten, t.nen`),
    d.execute(sql`SELECT luc, may_mac, giay, so_dang, so_hong, so_bo, ghi FROM may_dang_luot ORDER BY luc DESC LIMIT 30`),
    d.execute(sql`SELECT n.luc, m.ma, m.ten AS may_ten, n.nen, n.ok, n.slug, n.url, left(n.noi_dung, 160) AS noi_dung FROM xv_may_nhat_ky n JOIN xv_may m ON m.id = n.may_id
      WHERE n.buoc = 'dang' AND n.luc > now() - interval '24 hours' AND (n.ok = false OR n.noi_dung LIKE 'Đã đăng%') ORDER BY n.luc DESC LIMIT 60`),
    d.execute(sql`SELECT k.may, k.ho, k.nen, k.format, k.dang, k.goc->>'ten' AS goc_ten, k.goc->>'id' AS goc_id, k.dich, k.can_dung FROM ke_hoach_goc k WHERE k.ngay = ${hom}::date ORDER BY k.may, k.ho`),
    d.execute(sql`SELECT v.slug, m.ma, m.ten AS may_ten, coalesce(v.mau, m.mau) AS mau, v.xuat_luc, v.cham->>'ket' AS cham, v.cham->>'diem' AS diem, v.cham->'chan_cung' AS chan, v.video_url, v.anh->>0 AS anh1, v.dang->>'title' AS title
      FROM xv_may_video v JOIN xv_may m ON m.id = v.may_id WHERE v.xuat_luc > now() - interval '24 hours' ORDER BY v.xuat_luc DESC LIMIT 40`),
    d.execute(sql`SELECT ma, ten, chay FROM xv_may ORDER BY ten`),
  ]) as unknown as [Record<string, unknown>[], Record<string, unknown>[], Record<string, unknown>[], Record<string, unknown>[], Record<string, unknown>[], Record<string, unknown>[]];
  return NextResponse.json({ hom, tt, luot, su_kien: suKien, kh, video, may, luc: new Date().toISOString() });
}

export async function POST(req: Request) {
  const me = await getCurrentUser(); if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (me.role !== 'admin') return NextResponse.json({ error: 'chỉ admin điều khiển máy đăng' }, { status: 403 });
  const d = getDb(); if (!d) return NextResponse.json({ error: 'không có DB' }, { status: 500 });
  const b = (await req.json()) as { ma?: string; chay?: boolean; nen?: string; nghi_den?: string | null };
  if (!b.ma) return NextResponse.json({ error: 'thiếu máy' }, { status: 400 });
  if (typeof b.chay === 'boolean') { await d.execute(sql`UPDATE xv_may SET chay = ${b.chay}, updated_at = now() WHERE ma = ${b.ma}`); return NextResponse.json({ ok: true }); }
  if (b.nen) {
    if (b.nghi_den != null && !/^\d{4}-\d{2}-\d{2}$/.test(b.nghi_den)) return NextResponse.json({ error: 'nghi_den phải là YYYY-MM-DD' }, { status: 400 });
    // nghỉ nền tới hết ngày: cờ nghi_den trong xv_may.dang[] (puzzle-books dang-may › dangNghi đọc); null = gỡ cờ
    await d.execute(sql`UPDATE xv_may SET dang = (SELECT jsonb_agg(CASE WHEN e->>'nen' = ${b.nen} THEN (CASE WHEN ${b.nghi_den ?? null}::text IS NULL THEN e - 'nghi_den' ELSE jsonb_set(e, '{nghi_den}', to_jsonb(${b.nghi_den ?? null}::text)) END) ELSE e END ORDER BY i)
      FROM jsonb_array_elements(dang) WITH ORDINALITY t(e, i)), updated_at = now() WHERE ma = ${b.ma}`);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'không có gì để đổi' }, { status: 400 });
}
