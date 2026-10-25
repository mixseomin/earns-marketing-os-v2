import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { moSpy, thuHai } from '@/lib/ke-hoach-goc';

export const dynamic = 'force-dynamic';

// GÓC THEO TÀI SẢN (anh 25/10/2026: "cần thêm 1 tab/page quản lý danh sách góc của từng social assets") — tab Social › Góc › Theo tài sản.
// GET → mỗi máy (thương hiệu) đang chạy: nơi đăng, nhóm góc spy (xv_may.goc_sp), từng góc: loại, tên, lượt nhắc, đã đăng bao nhiêu bài từ góc đó,
//        bao nhiêu ô kế hoạch từ tuần này, đang tắt hay không. Kèm danh sách nhóm spy để thêm nhóm.
// POST { may, goc_id, tat } → tắt / bật một góc cho máy · { may, goc_sp: number[] } → đổi nhóm góc của máy. Đổi xong, các tuần CHƯA sinh dùng cấu hình mới.
export async function GET() {
  if (!(await getCurrentUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const d = getDb(); if (!d) return NextResponse.json({ may: [], nhom: [] });
  const hom = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const may = (await d.execute(sql`SELECT m.ma, m.ten, coalesce(m.goc_sp, '{}') AS goc_sp,
      array(SELECT DISTINCT split_part(n->>'nen', ':', 1) FROM jsonb_array_elements(m.dang) n) AS nen,
      (SELECT coalesce(jsonb_object_agg(id, n), '{}') FROM (SELECT v.dang->'goc'->>'id' AS id, count(*) AS n FROM xv_may_video v WHERE v.may_id = m.id AND v.dang ? 'goc' AND v.da_dang <> '{}'::jsonb GROUP BY 1) x) AS da,
      (SELECT coalesce(jsonb_object_agg(id, n), '{}') FROM (SELECT k.goc->>'id' AS id, count(*) AS n FROM ke_hoach_goc k WHERE k.may = m.ma AND k.ngay >= ${thuHai(hom)}::date GROUP BY 1) x) AS kh,
      array(SELECT goc_id FROM goc_tat t WHERE t.may = m.ma) AS tat, m.site_dich,
      (SELECT coalesce(jsonb_object_agg(goc_id, jsonb_build_object('tt', trang_thai, 'url', url, 'han', can_truoc, 'ly_do', ly_do)), '{}') FROM bai_site_goc b WHERE b.may = m.ma) AS site
    FROM xv_may m WHERE m.chay ORDER BY m.ten`)) as unknown as { ma: string; ten: string; goc_sp: number[]; nen: string[]; da: Record<string, number>; kh: Record<string, number>; tat: number[]; site_dich: string | null; site: Record<string, { tt: string; url: string | null; han: string | null; ly_do: string | null }> }[];
  const sp = [...new Set(may.flatMap((m) => m.goc_sp.map(Number)))];
  const pg = await moSpy();
  try {
    const [goc, nhom] = await Promise.all([
      sp.length ? pg<{ id: number; sp_id: number; loai: string; ten: string; mo_ta: string | null; n: number }[]>`select id, sp_id, loai, ten, mo_ta, coalesce(so_nhac, 0) n from goc
        where sp_id = any(${sp}) and loai like 'ai\\_%' and ten is not null and ten <> 'Nhóm tạm thời' and coalesce(mo_ta, '') <> 'placeholder' order by n desc` : Promise.resolve([]),
      pg<{ id: number; ten: string; n: number }[]>`select s.id, s.ten, (select count(*) from goc g where g.sp_id = s.id and g.loai like 'ai\\_%')::int n from goc_sp s order by n desc`,
    ]);
    return NextResponse.json({
      may: may.map((m) => ({ ...m, goc_sp: m.goc_sp.map(Number), tat: m.tat.map(Number),
        goc: goc.filter((g) => m.goc_sp.map(Number).includes(Number(g.sp_id))).map((g) => ({ id: Number(g.id), sp: Number(g.sp_id), loai: g.loai, ten: g.ten, mo_ta: g.mo_ta, nhac: Number(g.n), da: Number(m.da[String(g.id)] ?? 0), kh: Number(m.kh[String(g.id)] ?? 0), site: m.site[String(g.id)] ?? null })) })),
      nhom: nhom.filter((x) => x.n > 0).map((x) => ({ id: Number(x.id), ten: x.ten, n: x.n })),
    });
  } finally { await pg.end(); }
}

export async function POST(req: Request) {
  const me = await getCurrentUser(); if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (me.role !== 'admin') return NextResponse.json({ error: 'chỉ admin đổi cấu hình góc' }, { status: 403 });
  const d = getDb(); if (!d) return NextResponse.json({ error: 'không có DB' }, { status: 500 });
  const b = (await req.json()) as { may?: string; goc_id?: number; tat?: boolean; goc_sp?: number[] };
  if (!b.may) return NextResponse.json({ error: 'thiếu máy' }, { status: 400 });
  if (Array.isArray(b.goc_sp)) {
    const ds = [...new Set(b.goc_sp.map(Number).filter((x) => Number.isInteger(x) && x > 0))];
    await d.execute(sql`UPDATE xv_may SET goc_sp = ${sql.raw(`'{${ds.join(',')}}'::integer[]`)} WHERE ma = ${b.may}`);
    return NextResponse.json({ ok: true });
  }
  const id = Number(b.goc_id); if (!Number.isInteger(id)) return NextResponse.json({ error: 'thiếu góc' }, { status: 400 });
  if (b.tat) await d.execute(sql`INSERT INTO goc_tat (may, goc_id) VALUES (${b.may}, ${id}) ON CONFLICT DO NOTHING`);
  else await d.execute(sql`DELETE FROM goc_tat WHERE may = ${b.may} AND goc_id = ${id}`);
  return NextResponse.json({ ok: true });
}
