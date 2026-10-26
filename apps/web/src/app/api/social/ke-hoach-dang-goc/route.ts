import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { moSpy } from '@/lib/ke-hoach-goc';
import { DANG_BAI, LUAT_NEN, NGUON_DANG } from '@/lib/dang-bai';
import { DUONG_DANG, KE_HOACH, NGUYEN_LY, UNG_VIEN } from '@/lib/ke-hoach-dang-goc';

export const dynamic = 'force-dynamic';

// KẾ HOẠCH DẠNG × GÓC × SẢN PHẨM — tab Social › Góc › Kế hoạch: sổ kế hoạch (lib/ke-hoach-dang-goc.ts) + số thật:
// máy studio (mọi máy, kể cả đang tắt) với số góc spy / nền / site đích / dạng dùng được, ứng viên sản phẩm với số góc trên spy, dạng đã dùng 14 ngày qua.
export async function GET() {
  if (!(await getCurrentUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const d = getDb();
  const may = d ? (await d.execute(sql`SELECT m.ma, m.ten, m.du_an, m.chay, coalesce(m.goc_sp, '{}') AS goc_sp, m.site_dich,
      array(SELECT DISTINCT split_part(n->>'nen', ':', 1) FROM jsonb_array_elements(m.dang) n) AS nen,
      (SELECT count(*) FROM xv_may_video v WHERE v.may_id = m.id AND v.da_dang <> '{}'::jsonb) AS da_dang,
      (SELECT coalesce(jsonb_object_agg(f, n), '{}') FROM (SELECT k.format AS f, count(*) AS n FROM ke_hoach_goc k WHERE k.may = m.ma AND k.ngay >= current_date - 14 GROUP BY 1) x) AS dang_14
    FROM xv_may m ORDER BY m.chay DESC, m.ten`)) as unknown as { ma: string; ten: string; du_an: string | null; chay: boolean; goc_sp: number[]; site_dich: string | null; nen: string[]; da_dang: number; dang_14: Record<string, number> }[] : [];
  const sp = [...new Set([...may.flatMap((m) => m.goc_sp.map(Number)), ...UNG_VIEN.flatMap((u) => u.goc_sp)])];
  let nhom: { id: number; ten: string; n: number }[] = [], loiSpy: string | null = null;
  if (sp.length) {
    try { const pg = await moSpy(); try { nhom = (await pg<{ id: number; ten: string; n: number }[]>`select s.id, s.ten, (select count(*) from goc g where g.sp_id = s.id and g.loai like 'ai\\_%' and g.ten is not null and g.ten <> 'Nhóm tạm thời')::int n from goc_sp s where s.id = any(${sp})`).map((x) => ({ id: Number(x.id), ten: x.ten, n: Number(x.n) })); } finally { await pg.end(); } }
    catch (e) { loiSpy = (e as Error).message.slice(0, 120); }
  }
  const gocCua = (ids: number[]) => ids.reduce((a, id) => a + (nhom.find((x) => x.id === id)?.n ?? 0), 0);
  const hoCo = new Set(DUONG_DANG.filter((x) => x.co).map((x) => x.ho));
  return NextResponse.json({
    nguyen_ly: NGUYEN_LY, buoc: KE_HOACH, dang: DANG_BAI, luat_nen: LUAT_NEN, nguon: NGUON_DANG, duong: DUONG_DANG, loi_spy: loiSpy,
    may: may.map((m) => ({ ...m, goc_sp: m.goc_sp.map(Number), da_dang: Number(m.da_dang), goc: gocCua(m.goc_sp.map(Number)),
      nhom: m.goc_sp.map(Number).map((id) => ({ id, ten: nhom.find((x) => x.id === id)?.ten ?? `#${id}`, n: nhom.find((x) => x.id === id)?.n ?? 0 })),
      // dạng dùng được cho máy = dạng có họ nền máy đang đăng; có mẫu = mẫu studio đã dựng; có đường = họ nền đó đã có đường đăng
      dang_dung: DANG_BAI.filter((x) => x.nen.some((h) => m.nen.map((n) => (/^fb_|^facebook/.test(n) ? 'facebook' : /^x(_|$)/.test(n) ? 'x' : n)).includes(h) && hoCo.has(h))).length,
      dang_mau: DANG_BAI.filter((x) => x.mau && x.nen.some((h) => m.nen.map((n) => (/^fb_|^facebook/.test(n) ? 'facebook' : /^x(_|$)/.test(n) ? 'x' : n)).includes(h))).length })),
    ung_vien: UNG_VIEN.map((u) => ({ ...u, goc: gocCua(u.goc_sp), nhom: u.goc_sp.map((id) => ({ id, ten: nhom.find((x) => x.id === id)?.ten ?? `#${id}`, n: nhom.find((x) => x.id === id)?.n ?? 0 })) })),
  });
}
