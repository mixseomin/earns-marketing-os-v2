// Đọc sổ cho mặt tiền: cửa hàng theo TÊN MIỀN (một bản dựng phục vụ mọi shop), sản phẩm, đánh giá thật, số đã bán thật.
import { headers } from 'next/headers';
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { matTien, type MatTien } from '@mos2/shop/mat-tien';
import type { ShopTT } from '@mos2/shop/thanh-toan';
import { dsVideo } from '@mos2/shop/video';

type Row = Record<string, unknown>;
const q = async <T = Row>(s: ReturnType<typeof sql>) => { const d = getDb(); if (!d) throw new Error('chưa nối DB'); return (await d.execute(s)) as unknown as T[]; };

export type Shop = ShopTT & { mt: ReturnType<typeof matTien> };

const nho = new Map<string, { ts: number; shop: Shop | null }>();
/** Host → cửa hàng (nhớ 30 giây). Máy dev/local: STORE_SHOP=<khoá> ép một shop. */
export async function shopTheoHost(host: string): Promise<Shop | null> {
  const h = host.toLowerCase().split(':')[0]!;
  const c = nho.get(h);
  if (c && Date.now() - c.ts < 30_000) return c.shop;
  const ep = process.env.STORE_SHOP;
  const [r] = await q<Shop>(sql`
    SELECT id, khoa, project_id, ten, domain, nen_tang, mat_tien FROM shop_cua_hang
     WHERE trang_thai = 'bat' AND (${h} = ANY(ten_mien) OR (${ep ?? ''} <> '' AND khoa = ${ep ?? ''})) LIMIT 1`);
  const shop = r ? { ...r, mt: matTien(r.mat_tien) } : null;
  nho.set(h, { ts: Date.now(), shop });
  return shop;
}

export async function shopHienTai(): Promise<Shop | null> {
  const h = await headers();
  return shopTheoHost(h.get('x-forwarded-host') ?? h.get('host') ?? '');
}

export type BienThe = { id: number; ten: string; tuy_chon: Record<string, string>; anh: string | null; gia: number; gia_goc: number | null; het_hang: boolean };
export type SanPham = { id: number; slug: string; ten: string; tieu_de: string; mo_ta: string; anh_ds: string[]; tuy_chon: { ten: string; gia_tri: string[] }[];
  gia: number; gia_goc: number | null; bien_the: BienThe[]; video: string[] };

const sp = (r: Row, bt: BienThe[]): SanPham => {
  const gia = bt.length ? Math.min(...bt.map((b) => b.gia)) : 0;
  return { id: Number(r.id), slug: String(r.slug), ten: String(r.ten), tieu_de: String(r.tieu_de || r.ten), mo_ta: String(r.mo_ta ?? ''),
    anh_ds: (r.anh_ds as string[])?.length ? (r.anh_ds as string[]) : r.anh ? [String(r.anh)] : [], tuy_chon: (r.tuy_chon as SanPham['tuy_chon']) ?? [],
    gia, gia_goc: bt.find((b) => b.gia === gia)?.gia_goc ?? null, bien_the: bt, video: dsVideo(r.video) };
};

async function bienTheCua(ids: number[]): Promise<Map<number, BienThe[]>> {
  const m = new Map<number, BienThe[]>();
  if (!ids.length) return m;
  const rows = await q<Row>(sql`
    SELECT b.id, b.san_pham_id, b.ten, b.tuy_chon, b.anh, b.gia_ban::text, COALESCE(b.gia_goc, p.gia_goc)::text AS gia_goc, b.het_hang
      FROM shop_bien_the b JOIN shop_san_pham p ON p.id = b.san_pham_id
     WHERE b.san_pham_id IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)}) AND b.gia_ban IS NOT NULL ORDER BY b.id`);
  for (const r of rows) {
    const k = Number(r.san_pham_id);
    const g = Number(r.gia_ban), goc = r.gia_goc ? Number(r.gia_goc) : null;
    m.set(k, [...(m.get(k) ?? []), { id: Number(r.id), ten: String(r.ten), tuy_chon: (r.tuy_chon as Record<string, string>) ?? {}, anh: (r.anh as string) ?? null,
      gia: g, gia_goc: goc && goc > g ? goc : null, het_hang: !!r.het_hang }]);
  }
  return m;
}

export async function dsSanPham(shop: Shop): Promise<SanPham[]> {
  const rows = await q<Row>(sql`SELECT * FROM shop_san_pham WHERE cua_hang_id = ${shop.id} AND hien AND slug IS NOT NULL ORDER BY thu_tu, id`);
  const bt = await bienTheCua(rows.map((r) => Number(r.id)));
  return rows.map((r) => sp(r, bt.get(Number(r.id)) ?? [])).filter((p) => p.bien_the.length);
}

export async function sanPhamTheoSlug(shop: Shop, slug: string): Promise<SanPham | null> {
  const [r] = await q<Row>(sql`SELECT * FROM shop_san_pham WHERE cua_hang_id = ${shop.id} AND hien AND slug = ${slug} LIMIT 1`);
  if (!r) return null;
  const bt = await bienTheCua([Number(r.id)]);
  const p = sp(r, bt.get(Number(r.id)) ?? []);
  return p.bien_the.length ? p : null;
}

export type DanhGia = { id: number; ten: string; sao: number; tieu_de: string | null; noi_dung: string; anh: string[]; da_mua: boolean; tao_luc: string };
/** Đánh giá THẬT đã duyệt + điểm trung bình + số đã bán thật (đơn đã trả, không huỷ/hoàn). */
export async function danhGiaVaBan(spId: number) {
  const [ds, [tk], [ban]] = await Promise.all([
    q<DanhGia>(sql`SELECT id, ten, sao, tieu_de, noi_dung, anh, don_id IS NOT NULL AS da_mua, tao_luc::text FROM shop_danh_gia
                    WHERE san_pham_id = ${spId} AND trang_thai = 'hien' ORDER BY (anh <> '[]'::jsonb) DESC, tao_luc DESC LIMIT 60`),
    q<{ tb: string | null; so: string }>(sql`SELECT avg(sao)::numeric(3,1)::text AS tb, count(*)::text AS so FROM shop_danh_gia WHERE san_pham_id = ${spId} AND trang_thai = 'hien'`),
    q<{ so: string }>(sql`SELECT COALESCE(SUM(m.sl), 0)::text AS so FROM shop_don_mon m JOIN shop_don d ON d.id = m.don_id JOIN shop_bien_the b ON b.id = m.bien_the_id
                           WHERE b.san_pham_id = ${spId} AND d.tra_luc IS NOT NULL AND d.trang_thai_shop NOT IN ('cancelled', 'refunded', 'failed')`),
  ]);
  return { ds, tb: tk?.tb ? Number(tk.tb) : null, so: Number(tk?.so ?? 0), daBan: Number(ban?.so ?? 0) };
}
