'use server';
// THÀNH PHỐ PHIM — số theo NGƯỜI ĐANG XEM (anh 15/11/2026 "https://etp2.on.tc/?t=tong&k=1&tpl=m:thanh_pho&ng=120 — Thành phố phải hiện theo số liệu của người được chọn tương ứng"):
// ?ng=<id> người khác · ?ng=team cả team · không có = nhà — cùng luật chọn người với lib/etp-doc.ts. Vai người chỉ xem được chính mình (cắt ở đây, không chỉ ẩn).
// Mỗi phim: camp đang chạy (cửa sổ / cây) + camp đã tắt còn chi trong 30 ngày (cây héo).
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { quyenEtp } from '@/lib/etp-quyen';
import { campToaSql, docCampToa, type CampToa, type NguonToa } from '@/lib/etp-toa-sql';

export type PhimThanhPho = { p: number; ten: string; camp: CampToa[]; tat: CampToa[]; sx: number };

export async function docThanhPho(ng?: string | null): Promise<{ ds: PhimThanhPho[]; nguoi: string; laNha: boolean } | { loi: string }> {
  const q = await quyenEtp(await getCurrentUser());
  if (!q) return { loi: 'không có quyền' };
  const run = async <T,>(x: ReturnType<typeof sql>) => (await getDb()!.execute(x)) as unknown as T[];
  const ds = await run<{ id: number; ten: string; nha: boolean }>(sql`select nguoi_id::int id, max(nguoi) ten, bool_or(nha) nha from etp.tai_khoan where nguoi_id is not null group by nguoi_id`);
  const nhaId = ds.find((x) => x.nha)?.id ?? null;
  let nguon: NguonToa, ten: string;
  if (q.vai === 'nguoi') {   // người chỉ xem chính mình
    if (q.nguoiId == null) return { loi: 'tài khoản chưa gắn người' };
    nguon = q.nguoiId === nhaId ? { kieu: 'nha' } : { kieu: 'nguoi', id: q.nguoiId }; ten = ds.find((x) => x.id === q.nguoiId)?.ten ?? `#${q.nguoiId}`;
  } else if (ng === 'team' && ds.length > 1) { nguon = { kieu: 'team' }; ten = 'Team'; }
  else if (Number(ng) > 0 && Number(ng) !== nhaId && ds.some((x) => x.id === Number(ng))) { nguon = { kieu: 'nguoi', id: Number(ng) }; ten = ds.find((x) => x.id === Number(ng))!.ten; }
  else { nguon = { kieu: 'nha' }; ten = `${ds.find((x) => x.nha)?.ten ?? 'Nhà'} (nhà)`; }
  const rows = await run<Record<string, unknown> & { p: number; ten: string | null }>(campToaSql(sql`true`, nguon));
  const m = new Map<number, PhimThanhPho>();
  for (const r of rows) { const x = m.get(r.p) ?? { p: r.p, ten: r.ten ?? `#${r.p}`, camp: [], tat: [], sx: 0 }; const c = docCampToa(r); (c.tat ? x.tat : x.camp).push(c); m.set(r.p, x); }
  // DÒNG SX ĐANG CHẠY (etp.dong_phim, chỉ nhà) → giàn giáo vàng ở móng / cọc vàng trên thửa (anh 15/11/2026 "bấm vào sx thì update ngay trên toà nhà tương ứng")
  if (nguon.kieu === 'nha') for (const r of await run<{ p: number; n: number }>(sql`select content_id::int p, sum(coalesce(so_camp, 1))::int n from etp.dong_phim where trang_thai = 'chay' group by 1`)) { const x = m.get(r.p); if (x) x.sx = r.n; }
  // phim chỉ còn camp đã tắt (không camp nào chạy) không dựng thành nhà
  return { ds: [...m.values()].filter((x) => x.camp.length), nguoi: ten, laNha: nguon.kieu === 'nha' };
}
