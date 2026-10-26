import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { moSpy } from '@/lib/ke-hoach-goc';
import { DANG_BAI, LUAT_NEN, NGUON_DANG, dangHop } from '@/lib/dang-bai';
import { hoCua } from '@/lib/ho-nen';
import { DUONG_DANG, KE_HOACH, NGACH_MAY, NGUYEN_LY, UNG_VIEN } from '@/lib/ke-hoach-dang-goc';

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
  let nhom: { id: number; ten: string; n: number }[] = [], loaiSp: { sp_id: number; loai: string; n: number }[] = [], loiSpy: string | null = null;
  if (sp.length) {
    try { const pg = await moSpy(); try { loaiSp = (await pg<{ sp_id: number; loai: string; n: number }[]>`select sp_id, loai, count(*)::int n from goc where sp_id = any(${sp}) and loai like 'ai\\_%' and ten is not null and ten <> 'Nhóm tạm thời' group by 1, 2`).map((x) => ({ sp_id: Number(x.sp_id), loai: x.loai, n: Number(x.n) })); nhom = (await pg<{ id: number; ten: string; n: number }[]>`select s.id, s.ten, (select count(*) from goc g where g.sp_id = s.id and g.loai like 'ai\\_%' and g.ten is not null and g.ten <> 'Nhóm tạm thời')::int n from goc_sp s where s.id = any(${sp})`).map((x) => ({ id: Number(x.id), ten: x.ten, n: Number(x.n) })); } finally { await pg.end(); } }
    catch (e) { loiSpy = (e as Error).message.slice(0, 120); }
  }
  const gocCua = (ids: number[]) => ids.reduce((a, id) => a + (nhom.find((x) => x.id === id)?.n ?? 0), 0);
  const loaiCua = (ids: number[]) => loaiSp.filter((x) => ids.includes(x.sp_id)).reduce<Record<string, number>>((m, x) => ({ ...m, [x.loai]: (m[x.loai] ?? 0) + x.n }), {});
  const hoCo = new Set(DUONG_DANG.filter((x) => x.co).map((x) => x.ho));
  return NextResponse.json({
    nguyen_ly: NGUYEN_LY, buoc: KE_HOACH, dang: DANG_BAI, luat_nen: LUAT_NEN, nguon: NGUON_DANG, duong_dang: DUONG_DANG, loi_spy: loiSpy,
    may: may.map((m) => ({ ...m, goc_sp: m.goc_sp.map(Number), da_dang: Number(m.da_dang), goc: gocCua(m.goc_sp.map(Number)), loai: loaiCua(m.goc_sp.map(Number)), ngach: NGACH_MAY[m.ma] ?? [],
      nhom: m.goc_sp.map(Number).map((id) => ({ id, ten: nhom.find((x) => x.id === id)?.ten ?? `#${id}`, n: nhom.find((x) => x.id === id)?.n ?? 0 })),
      // dạng hợp máy (dangHop: ngách + họ nền máy đang đăng — cùng công thức với trang); có đường = họ nền đó đã có đường đăng; có mẫu = mẫu studio đã dựng
      ...(() => { const ho = new Set(m.nen.map(hoCua)), hop = dangHop(DANG_BAI, { ho, ngach: NGACH_MAY[m.ma] ?? [], laMay: true });
        return { dang_dung: hop.filter((x) => x.nen.some((h) => ho.has(h) && hoCo.has(h))).length, dang_mau: hop.filter((x) => x.mau).length }; })() })),
    ung_vien: UNG_VIEN.map((u) => ({ ...u, goc: gocCua(u.goc_sp), loai: loaiCua(u.goc_sp), nhom: u.goc_sp.map((id) => ({ id, ten: nhom.find((x) => x.id === id)?.ten ?? `#${id}`, n: nhom.find((x) => x.id === id)?.n ?? 0 })) })),
  });
}
