// /report2 — bảng xoay chi × phiên × đơn × lãi cho các dự án KHÔNG thuộc adfond (mellowstep + mảng adult),
// anh chốt 01/10/2026: một trang chung, đủ như report2 của be.adfond (thanh lọc, KPI, biểu đồ, gộp/cột, bảng cụm).
// Trạng thái nằm trọn trong URL:
//   ?tu=YYYY-MM-DD &den=YYYY-MM-DD &gop=ngay,camp &cot=chi,lai,roas &f.du_an=mellowstep &f.nguon=exoclick&f.nguon=…
// Engine: lib/bao-cao2.ts (đọc phu_chi · phu_su_kien · phu_ga4_ngay).
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { BaoCao2View } from '@/components/bao-cao2-view';
import { CHIEU, CHI_SO, CHI_SO_MAC_DINH, CUM, DUONG_BIEU_DO, KPI, LOC, dungTruyVan, truyVanChonCho, type TruyVan } from '@/lib/bao-cao2';

export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;
const ds = (v: string | string[] | undefined) => (Array.isArray(v) ? v : [v ?? '']).flatMap((x) => String(x).split(',')).map((x) => x.trim()).filter(Boolean);
const ngayTruoc = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
type Pg = { unsafe: (q: string, p: unknown[]) => Promise<unknown> };

export default async function Report2Page({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const db = getDb();
  // postgres-js gốc (getDb() vừa khởi tạo) — SQL của engine dùng tham số $n, drizzle `sql` không nhận chuỗi động.
  const pg = (globalThis as unknown as { __mos2_pg?: Pg }).__mos2_pg;
  if (!db || !pg) return <div style={{ padding: 24 }}>Chưa nối DB.</div>;
  const chay = async (q: TruyVan) => (await pg.unsafe(q.sql, q.params)) as Record<string, unknown>[];

  const coSo = (await db.execute(sql`
    SELECT project_id FROM (SELECT DISTINCT project_id FROM phu_chi UNION SELECT DISTINCT project_id FROM phu_su_kien
                            UNION SELECT DISTINCT project_id FROM phu_ga4_ngay UNION SELECT 'mellowstep') t
     WHERE project_id <> 'adfond' ORDER BY 1`)) as unknown as { project_id: string }[];
  const duAnCo = coSo.map((r) => r.project_id);
  // giá trị lọc KHÔNG tách theo dấu phẩy (tên camp/offer có thể chứa phẩy) — mỗi giá trị một tham số f.<chiều>
  const mang = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []).filter(Boolean);
  const loc = Object.fromEntries(LOC.map((k) => [k, mang(sp['f.' + k])] as const).filter(([, v]) => v.length));
  const y = {
    duAn: duAnCo, tu: ds(sp.tu)[0] ?? ngayTruoc(13), den: ds(sp.den)[0] ?? ngayTruoc(0),
    gop: sp.gop === undefined ? ['ngay'] : ds(sp.gop),
    chiSo: ds(sp.cot).length ? ds(sp.cot) : CHI_SO_MAC_DINH, loc,
  };
  const q = dungTruyVan(y);
  let rows: Record<string, unknown>[] = [], ngayRows: Record<string, unknown>[] = [], dongTong: Record<string, unknown> | null = null;
  let chonCho: Record<string, string[]> = {}, loi: string | null = null;
  if ('loi' in q) loi = q.loi;
  else {
    try {
      const canNgay = [...new Set([...KPI, ...DUONG_BIEU_DO.map((d) => d.key), ...y.chiSo])];
      const [a, b, c, d] = await Promise.all([
        chay(q),
        chay(dungTruyVan({ ...y, gop: [], chiSo: canNgay }) as TruyVan),
        chay(dungTruyVan({ ...y, gop: ['ngay'], chiSo: canNgay }) as TruyVan),
        chay(truyVanChonCho(y)),
      ]);
      rows = a; dongTong = b[0] ?? null; ngayRows = c;
      chonCho = Object.fromEntries(LOC.map((k) => [k, [...new Set(d.map((r) => String(r[k] ?? '')).filter(Boolean))].sort()]));
    } catch (e) { loi = (e as Error).message; }
  }
  return (
    <BaoCao2View
      y={y} rows={rows} ngayRows={ngayRows} dongTong={dongTong} chonCho={chonCho} loi={loi}
      chieu={CHIEU.map(({ key, nhan }) => ({ key, nhan }))}
      chiSo={CHI_SO.map(({ key, nhan, kieu, cum, chuThich }) => ({ key, nhan, kieu, cum, chuThich }))}
      cum={CUM.map((c) => ({ ...c }))}
    />
  );
}
