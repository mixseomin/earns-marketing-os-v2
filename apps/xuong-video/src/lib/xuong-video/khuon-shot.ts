// Thư viện KHUÔN SHOT dùng lại (xv_khuon_shot). Máy TỰ ghi — không có nút "lưu vào thư viện": shot nào có hình tả được thì có cơ sở
// dùng lại cho sản phẩm khác, miễn gỡ tên riêng ra. Hai nguồn: xương sống QC mẫu (ghiKhuonTuMau) và bộ cảnh Claude vừa tách
// (ghiKhuonTuCanh). Tên anchor → {nhân vật} / {sản phẩm} / {bối cảnh} / {đạo cụ}; trùng khoá (loại + hình chuẩn hoá) → chỉ tăng `dung`.
import 'server-only';
import { sql } from 'drizzle-orm';
import type { getDb } from '@mos2/db';
import { LOAI_SHOT_MAU, type LoaiShotMau, type NhanVat, type ShotMau } from './kieu';
import type { KyThuatShot } from './dien-anh';
import type { CanhSinh } from './claude';

type Db = NonNullable<ReturnType<typeof getDb>>;
export type KhuonShot = { id: number; loai: LoaiShotMau; ten: string; hinh: string; chu_man: string; giay: number; ky_thuat: KyThuatShot; nguon: string; phim_id: number | null; dung: number };

const NHAN_LOAI: Record<string, string> = { nhan_vat: '{nhân vật}', san_pham: '{sản phẩm}', boi_canh: '{bối cảnh}', dao_cu: '{đạo cụ}', phong_cach: '{phong cách}' };
const thoat = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Gỡ tên riêng: tên anchor (dài trước ngắn sau, không phân biệt hoa thường) và tên sản phẩm ở mục 0 → giữ chỗ theo loại. */
export function tongQuat(chu: string, nv: Pick<NhanVat, 'ten' | 'loai'>[], tenSp = ''): string {
  let s = chu;
  const ds = [...nv.map((v) => ({ ten: v.ten, the: NHAN_LOAI[v.loai] ?? '{đối tượng}' })), ...(tenSp.trim() ? [{ ten: tenSp.trim(), the: '{sản phẩm}' }] : [])]
    .filter((x) => x.ten.trim().length >= 2).sort((a, b) => b.ten.length - a.ten.length);
  for (const x of ds) s = s.replace(new RegExp(thoat(x.ten.trim()), 'gi'), x.the);
  return s.replace(/\s+/g, ' ').trim();
}
const khoaCua = (loai: string, hinh: string) => `${loai}|${hinh.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().slice(0, 90)}`;
const laLoai = (k: string): k is LoaiShotMau => LOAI_SHOT_MAU.some((l) => l.key === k);

type KhuonVao = { loai: LoaiShotMau; ten: string; hinh: string; chu_man: string; giay: number; ky_thuat?: KyThuatShot };
/** Ghi (hoặc tăng `dung`) từng khuôn; trả số khuôn MỚI. Hình trống = không có cơ sở dùng lại → bỏ. */
export async function ghiKhuon(db: Db, ds: KhuonVao[], nguon: string, phimId: number | null): Promise<number> {
  let moi = 0;
  for (const k of ds) {
    const hinh = k.hinh.trim(); if (hinh.length < 12) continue;
    const ten = (k.ten.trim() || k.chu_man.trim() || hinh).slice(0, 80);
    const r = (await db.execute(sql`INSERT INTO xv_khuon_shot (loai, ten, hinh, chu_man, giay, ky_thuat, khoa, nguon, phim_id)
      VALUES (${k.loai}, ${ten}, ${hinh.slice(0, 400)}, ${k.chu_man.trim().slice(0, 120)}, ${Math.max(0.5, Math.min(8, k.giay || 2))}, ${JSON.stringify(k.ky_thuat ?? {})}::jsonb, ${khoaCua(k.loai, hinh)}, ${nguon.slice(0, 160)}, ${phimId})
      ON CONFLICT (khoa) DO UPDATE SET dung = xv_khuon_shot.dung + 1, updated_at = now(),
        chu_man = CASE WHEN xv_khuon_shot.chu_man = '' THEN EXCLUDED.chu_man ELSE xv_khuon_shot.chu_man END,
        ky_thuat = CASE WHEN xv_khuon_shot.ky_thuat = '{}'::jsonb THEN EXCLUDED.ky_thuat ELSE xv_khuon_shot.ky_thuat END
      RETURNING (xmax = 0) AS moi`)) as unknown as { moi: unknown }[];
    if (r[0]?.moi === true) moi += 1;
  }
  return moi;
}
/** Từ xương sống QC mẫu: mỗi shot có hình = một khuôn (chữ màn giữ nguyên văn mẫu để người đọc hiểu ý, đã gỡ tên sản phẩm). */
export const ghiKhuonTuMau = (db: Db, shots: ShotMau[], nv: Pick<NhanVat, 'ten' | 'loai'>[], tenSp: string, nguon: string, phimId: number | null) =>
  ghiKhuon(db, shots.map((s) => ({ loai: laLoai(s.loai) ? s.loai : 'khac', ten: tongQuat(s.chu_man || s.hinh, nv, tenSp), hinh: tongQuat(s.hinh, nv, tenSp), chu_man: tongQuat(s.chu_man, nv, tenSp), giay: s.giay })), nguon, phimId);
/** Từ bộ cảnh Claude tách: hình = hành động + góc máy (đã gỡ tên anchor), loại suy từ beat/phân cảnh; shot nhánh hook phụ vẫn tính. */
export const ghiKhuonTuCanh = (db: Db, canh: Pick<CanhSinh, 'canh' | 'goc_may' | 'hanh_dong' | 'chu_man' | 'phat_s' | 'ky_thuat' | 'phan_doan'>[], nv: Pick<NhanVat, 'ten' | 'loai'>[], tenSp: string, nguon: string, phimId: number | null) =>
  ghiKhuon(db, canh.map((c) => ({ loai: loaiTuPhanDoan(c.phan_doan, c.chu_man ?? ''), ten: tongQuat(c.canh, nv, tenSp), hinh: tongQuat([c.goc_may, c.hanh_dong].filter(Boolean).join(' — '), nv, tenSp), chu_man: tongQuat(c.chu_man ?? '', nv, tenSp), giay: c.phat_s ?? 2, ky_thuat: c.ky_thuat as KyThuatShot })), nguon, phimId);
function loaiTuPhanDoan(pd: string, chu: string): LoaiShotMau {
  const s = `${pd} ${chu}`.toLowerCase();
  if (/hook|mở|giây đầu/.test(s)) return 'hook';
  if (/cta|mua ngay|shop|bấm|đặt hàng/.test(s)) return 'cta';
  if (/end ?card|màn cuối/.test(s)) return 'end_card';
  if (/ưu đãi|giảm|\$|%|tặng|sale/.test(s)) return 'uu_dai';
  if (/bằng chứng|đánh giá|bình luận|khách|người thật|review/.test(s)) return 'bang_chung';
  if (/so sánh|trước|sau|hơn|thường/.test(s)) return 'so_sanh';
  if (/demo|thử|dùng thử|nhúng|vò/.test(s)) return 'demo';
  if (/nỗi đau|đau|khó chịu|hằn|cấn|mỏi/.test(s)) return 'noi_dau';
  if (/trấn an|đổi trả|bảo hành|size|ship/.test(s)) return 'tran_an';
  if (/giải pháp|xuất hiện/.test(s)) return 'giai_phap';
  return 'tinh_nang';
}
/** Danh sách cho Claude + drawer: hay gặp trước; `loai` lọc tuỳ chọn. */
export async function dsKhuon(db: Db, o: { loai?: string; toiDa?: number } = {}): Promise<KhuonShot[]> {
  const r = (await db.execute(sql`SELECT id, loai, ten, hinh, chu_man, giay, ky_thuat, nguon, phim_id, dung FROM xv_khuon_shot
    WHERE ${o.loai ? sql`loai = ${o.loai}` : sql`true`} ORDER BY dung DESC, id DESC LIMIT ${o.toiDa ?? 300}`)) as unknown as Record<string, unknown>[];
  return r.map((x) => ({ id: Number(x.id), loai: String(x.loai) as LoaiShotMau, ten: String(x.ten), hinh: String(x.hinh), chu_man: String(x.chu_man ?? ''), giay: Number(x.giay), ky_thuat: (x.ky_thuat ?? {}) as KyThuatShot, nguon: String(x.nguon ?? ''), phim_id: x.phim_id == null ? null : Number(x.phim_id), dung: Number(x.dung) }));
}
/** Đoạn prompt: tối đa `toiDa` khuôn hay gặp nhất, gom theo loại — Claude dùng lại hình đã chứng minh thay vì nghĩ mới. */
export function taKhuon(ds: KhuonShot[], toiDa = 60): string {
  const chon = ds.slice(0, toiDa);
  if (!chon.length) return '';
  const ten = (k: string) => LOAI_SHOT_MAU.find((x) => x.key === k)?.ten ?? k;
  const nhom = new Map<string, KhuonShot[]>();
  for (const k of chon) nhom.set(k.loai, [...(nhom.get(k.loai) ?? []), k]);
  return `THƯ VIỆN KHUÔN SHOT (hình đã dùng ở các QC trước, {sản phẩm}/{nhân vật} = thay bằng anchor của phim này; ưu tiên dùng lại khi hợp ý shot):\n${[...nhom.entries()].map(([l, ks]) => `[${ten(l)}]\n${ks.map((k) => `  - ${k.ten}${k.chu_man && k.chu_man !== k.ten ? ` · chữ: "${k.chu_man}"` : ''} · ${k.giay}s · ${k.hinh}${k.dung > 1 ? ` (×${k.dung})` : ''}`).join('\n')}`).join('\n')}`;
}
