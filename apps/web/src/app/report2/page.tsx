// /report2 — bảng xoay chi × phiên × đơn × lãi cho các dự án KHÔNG thuộc adfond (mellowstep + mảng adult),
// anh chốt 01/10/2026: một trang chung, bộ lọc dự án. Trạng thái nằm trọn trong URL:
//   ?p=mellowstep,chatwhenbored &tu=YYYY-MM-DD &den=YYYY-MM-DD &gop=ngay,camp &cs=chi,lai,roas &l_nguon=exoclick
// Engine: lib/bao-cao2.ts (đọc phu_chi · phu_su_kien · phu_ga4_ngay).
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { BaoCao2View } from '@/components/bao-cao2-view';
import { CHIEU, CHI_SO, CHI_SO_MAC_DINH, dungTruyVan } from '@/lib/bao-cao2';

export const dynamic = 'force-dynamic';

const ds = (v: string | string[] | undefined) => String(Array.isArray(v) ? v[0] : v ?? '').split(',').map((x) => x.trim()).filter(Boolean);
const ngayTruoc = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

export default async function Report2Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const db = getDb();
  // postgres-js gốc (getDb() vừa khởi tạo) — SQL của engine dùng tham số $n, drizzle `sql` không nhận chuỗi động.
  const pg = (globalThis as unknown as { __mos2_pg?: { unsafe: (q: string, p: unknown[]) => Promise<unknown> } }).__mos2_pg;
  if (!db || !pg) return <div style={{ padding: 24 }}>Chưa nối DB.</div>;

  const coSo = (await db.execute(sql`
    SELECT project_id FROM (SELECT DISTINCT project_id FROM phu_chi UNION SELECT DISTINCT project_id FROM phu_su_kien
                            UNION SELECT DISTINCT project_id FROM phu_ga4_ngay UNION SELECT 'mellowstep') t
     WHERE project_id <> 'adfond' ORDER BY 1`)) as unknown as { project_id: string }[];
  const duAnCo = coSo.map((r) => r.project_id);
  const duAn = ds(sp.p).filter((p) => duAnCo.includes(p));
  const y = {
    duAn: duAn.length ? duAn : duAnCo,
    tu: ds(sp.tu)[0] ?? ngayTruoc(13), den: ds(sp.den)[0] ?? ngayTruoc(0),
    gop: sp.gop === undefined ? ['ngay'] : ds(sp.gop),
    chiSo: ds(sp.cs).length ? ds(sp.cs) : CHI_SO_MAC_DINH,
    loc: Object.fromEntries(CHIEU.map((c) => [c.key, ds(sp['l_' + c.key])[0] ?? ''] as const).filter(([, v]) => v)),
  };
  const q = dungTruyVan(y);
  const tong = dungTruyVan({ ...y, gop: [] });
  let rows: Record<string, unknown>[] = [], dongTong: Record<string, unknown> | null = null, loi: string | null = null;
  if ('loi' in q) loi = q.loi;
  else {
    try {
      rows = (await pg.unsafe(q.sql, q.params)) as unknown as Record<string, unknown>[];
      if (!('loi' in tong)) dongTong = ((await pg.unsafe(tong.sql, tong.params)) as unknown as Record<string, unknown>[])[0] ?? null;
    } catch (e) { loi = (e as Error).message; }
  }
  return (
    <BaoCao2View
      duAnCo={duAnCo} y={y} rows={rows} dongTong={dongTong} loi={loi}
      chieu={CHIEU.map(({ key, nhan }) => ({ key, nhan }))}
      chiSo={CHI_SO.map(({ key, nhan, kieu }) => ({ key, nhan, kieu }))}
    />
  );
}
