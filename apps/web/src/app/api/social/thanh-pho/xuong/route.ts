import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/social/thanh-pho/xuong → xưởng phim mới Ethopex cho city (anh 23/10/2026: "quá trình sản xuất phải nhìn được realtime trên city").
// City gọi mỗi 5 giây. Nhịp đang chạy = studio xv_khoa_ngoai['ethopex_xuong'] (scripts/ethopex/xuong.py ghi ở mỗi bước); số từng trạm = trạng thái
// từng phim ['ethopex_phim_moi_tt'] (phim-moi.py) trên danh sách ['ethopex_200_phim']. Chỉ đọc.
type Tt = { tt: string; luc: string; ghi?: string; ngay?: string };
export async function GET() {
  if (!(await getCurrentUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const db = getDb(); if (!db) return NextResponse.json({ error: 'thiếu DB' }, { status: 500 });
  const k = async <T,>(ten: string, rong: T): Promise<T> => (((await db.execute(sql`SELECT gia_tri FROM xv_khoa_ngoai WHERE ten = ${ten}`)) as unknown as { gia_tri: T | null }[])[0]?.gia_tri ?? rong);
  const [nhip, tt, ds, soat] = await Promise.all([k<Record<string, unknown> | null>('ethopex_xuong', null), k<Record<string, Tt>>('ethopex_phim_moi_tt', {}), k<{ id: number; ten: string }[]>('ethopex_200_phim', []), k<Record<string, { ok?: boolean }>>('ethopex_soat_18', {})]);
  const vn = new Date(Date.now() + 7 * 3600_000), hom = `${String(vn.getUTCDate()).padStart(2, '0')}/${String(vn.getUTCMonth() + 1).padStart(2, '0')}/${vn.getUTCFullYear()}`;
  const ten = new Map(ds.map((p) => [String(p.id), p.ten]));
  const theo = (f: (id: string, v: Tt) => boolean) => Object.entries(tt).filter(([id, v]) => f(id, v)).map(([id, v]) => ({ id, ten: ten.get(id) ?? id, ghi: v.ghi ?? '', luc: v.luc }));
  const daCat = theo((_, v) => v.tt === 'da_cat');
  const tram = {
    kho: { so: ds.filter((p) => !tt[String(p.id)]).length, nhan: 'chờ soát poster' },
    poster: { so: theo((_, v) => v.tt === 'poster_ok').length + theo((_, v) => v.tt === 'cat_loi').length, loai: theo((_, v) => v.tt === 'poster_loai').length, nhan: 'poster đạt, chờ cắt', ds: theo((_, v) => v.tt === 'poster_ok').slice(0, 40) },
    soat: { so: daCat.filter((p) => soat[p.id] == null).length, nhan: 'đã cắt, chờ soát 18+', ds: daCat.filter((p) => soat[p.id] == null) },
    len: { so: daCat.filter((p) => soat[p.id]?.ok).length, nhan: 'soát đạt, chờ lên camp', ds: daCat.filter((p) => soat[p.id]?.ok) },
    loai: { so: theo((_, v) => ['soat_loai', 'cong_loai', 'cat_loai'].includes(v.tt)).length, nhan: 'loại (18+ / cổng chữ / hết khung)', ds: theo((_, v) => ['soat_loai', 'cong_loai', 'cat_loai'].includes(v.tt)).slice(-30) },
    da_len: { so: theo((_, v) => v.tt === 'da_len').length, nhan: 'đã lên camp', ds: theo((_, v) => v.tt === 'da_len').slice(-30) },
  };
  const homNay = theo((_, v) => v.tt === 'da_len' && (v.ngay ?? v.luc.slice(-10)) === hom).length;
  return NextResponse.json({ luc: new Date().toISOString(), nhip, tram, chi_tieu: { ngay: hom, da: homNay, can: 30 }, tong: ds.length });
}
