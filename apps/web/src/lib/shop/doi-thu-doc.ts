// SHOP — đọc sổ ĐỐI THỦ (migration 0206) cho /shop › Đối thủ: đối thủ → sản phẩm của họ (nối sản phẩm mình) → quảng cáo.
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';

type Row = Record<string, unknown>;
const q = async (s: ReturnType<typeof sql>) => { const d = getDb(); if (!d) return [] as Row[]; return (await d.execute(s)) as unknown as Row[]; };
const so = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const chu = (v: unknown) => (v === null || v === undefined ? null : String(v));

export type QcDoiThu = { id: number; spId: number | null; nenTang: string; link: string; hook: string | null; landing: string | null; batDau: string | null;
  dangChay: boolean | null; ghiChu: string | null; luc: string | null };
export type SpDoiThu = { id: number; sanPhamId: number | null; ten: string | null; url: string; gia: number | null; giaGoc: number | null; khop: string; ghiChu: string | null; luc: string | null };
export type DoiThuDong = { id: number; ten: string; website: string | null; kenhBan: string; fbPageUrl: string | null; fbPageId: string | null; tiktok: string | null;
  nguonTim: string | null; ghiChu: string | null; theoDoi: boolean; capNhat: string; sp: SpDoiThu[]; qc: QcDoiThu[] };

export async function docDoiThu(): Promise<DoiThuDong[]> {
  const [dt, sp, qc] = await Promise.all([
    q(sql`SELECT id, ten, website, kenh_ban, fb_page_url, fb_page_id, tiktok, nguon_tim, ghi_chu, theo_doi, cap_nhat::text AS cap_nhat FROM shop_doi_thu ORDER BY theo_doi DESC, ten`),
    q(sql`SELECT id, doi_thu_id, san_pham_id, ten, url, gia, gia_goc, khop, ghi_chu, luc::text AS luc FROM shop_doi_thu_sp ORDER BY doi_thu_id, id`),
    q(sql`SELECT id, doi_thu_id, doi_thu_sp_id, nen_tang, link, hook, landing, bat_dau::text AS bat_dau, dang_chay, ghi_chu, luc::text AS luc FROM shop_doi_thu_qc ORDER BY doi_thu_id, dang_chay DESC NULLS LAST, bat_dau DESC NULLS LAST, id`),
  ]);
  return dt.map((d) => ({ id: Number(d.id), ten: String(d.ten), website: chu(d.website), kenhBan: String(d.kenh_ban), fbPageUrl: chu(d.fb_page_url), fbPageId: chu(d.fb_page_id),
    tiktok: chu(d.tiktok), nguonTim: chu(d.nguon_tim), ghiChu: chu(d.ghi_chu), theoDoi: !!d.theo_doi, capNhat: String(d.cap_nhat),
    sp: sp.filter((x) => Number(x.doi_thu_id) === Number(d.id)).map((x) => ({ id: Number(x.id), sanPhamId: so(x.san_pham_id), ten: chu(x.ten), url: String(x.url), gia: so(x.gia),
      giaGoc: so(x.gia_goc), khop: String(x.khop), ghiChu: chu(x.ghi_chu), luc: chu(x.luc) })),
    qc: qc.filter((x) => Number(x.doi_thu_id) === Number(d.id)).map((x) => ({ id: Number(x.id), spId: so(x.doi_thu_sp_id), nenTang: String(x.nen_tang), link: String(x.link),
      hook: chu(x.hook), landing: chu(x.landing), batDau: chu(x.bat_dau), dangChay: x.dang_chay == null ? null : !!x.dang_chay, ghiChu: chu(x.ghi_chu), luc: chu(x.luc) })) }));
}
