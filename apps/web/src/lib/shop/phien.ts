// SHOP — đọc sổ phiên khách (apps/store /api/phien ghi) cho /shop › Khách trực tiếp. Phễu + nhãn: @mos2/shop/phien.
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { ONLINE_GIAY, type CuaSo } from '@mos2/shop/phien';
export type { CuaSo };
import { APP_TZ } from '@/lib/local-day';

type Row = Record<string, unknown>;
const q = async (s: ReturnType<typeof sql>) => { const d = getDb(); if (!d) return [] as Row[]; return (await d.execute(s)) as unknown as Row[]; };


export type PhienDong = {
  id: string; cuaHang: string; domain: string; batDau: string; cuoi: string; online: boolean; quayLai: boolean;
  trangDau: string | null; trangHien: string | null; cuon: number; nguon: string | null; thietBi: string | null; nuoc: string | null; thanhPho: string | null;
  chang: number; soTrang: number; soClick: number; gioGia: number; soDon: string | null;
};

export async function docPhien(cuaSo: CuaSo): Promise<PhienDong[]> {
  const tu = cuaSo === 'online' ? sql`now() - make_interval(secs => ${ONLINE_GIAY})`
    : cuaSo === '30p' ? sql`now() - interval '30 minutes'`
    : cuaSo === 'hom_nay' ? sql`date_trunc('day', now() AT TIME ZONE ${APP_TZ}) AT TIME ZONE ${APP_TZ}`
    : sql`now() - interval '7 days'`;
  const r = await q(sql`
    SELECT p.id, c.khoa, c.domain, p.bat_dau::text AS bat_dau, p.cuoi::text AS cuoi, p.cuoi > now() - make_interval(secs => ${ONLINE_GIAY}) AS online,
           EXISTS (SELECT 1 FROM shop_phien x WHERE x.khach_id = p.khach_id AND x.bat_dau < p.bat_dau - interval '30 minutes') AS quay_lai,
           p.trang_dau, p.trang_hien, p.cuon, p.nguon, p.thiet_bi, p.nuoc, p.thanh_pho, p.chang, p.so_trang, p.so_click, p.gio_gia, p.so_don
      FROM shop_phien p JOIN shop_cua_hang c ON c.id = p.cua_hang_id
     WHERE p.cuoi >= ${tu}
     ORDER BY p.cuoi DESC LIMIT 1000`);
  return r.map((x) => ({
    id: String(x.id), cuaHang: String(x.khoa), domain: String(x.domain), batDau: String(x.bat_dau), cuoi: String(x.cuoi), online: !!x.online, quayLai: !!x.quay_lai,
    trangDau: (x.trang_dau as string) ?? null, trangHien: (x.trang_hien as string) ?? null, cuon: Number(x.cuon), nguon: (x.nguon as string) ?? null,
    thietBi: (x.thiet_bi as string) ?? null, nuoc: (x.nuoc as string) ?? null, thanhPho: (x.thanh_pho as string) ?? null, chang: Number(x.chang),
    soTrang: Number(x.so_trang), soClick: Number(x.so_click), gioGia: Number(x.gio_gia), soDon: (x.so_don as string) ?? null,
  }));
}

export type SuKienPhien = { ts: string; loai: string; trang: string | null; chiTiet: Record<string, unknown> | null };
export async function docSuKienPhien(id: string): Promise<SuKienPhien[]> {
  const r = await q(sql`SELECT ts::text AS ts, loai, trang, chi_tiet FROM shop_phien_su_kien WHERE phien_id = ${id} ORDER BY ts DESC, id DESC LIMIT 500`);
  return r.map((x) => ({ ts: String(x.ts), loai: String(x.loai), trang: (x.trang as string) ?? null, chiTiet: (x.chi_tiet as Record<string, unknown>) ?? null }));
}
