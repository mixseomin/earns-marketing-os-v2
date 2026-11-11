// GOM SẢN XUẤT MỌI NGUỒN về tab Máy SX (anh 11/11/2026: "Máy sx hãy gom các bước sản xuất ở page khác về cùng").
// Mỗi việc đang sản xuất của mọi nguồn = MỘT dòng cùng khuôn ViecSx; bấm dòng mở chi tiết CŨ (trang cũ giữ nguyên, không xoá):
//   social  = bài đã khai mà chưa có tệp (xv_may_video — Máy SX dựng / xưởng studio)          → studio.on.tc
//   kenh    = tập đang làm của kênh nội dung (docKenhSp › ke.dangLam, bỏ tập demo)            → tab Kênh nội dung, mở cây kênh
//   etp     = creative Ethopex đang cắt / chờ soát / chờ dựng lại (docEtp › dangSx)          → ngăn Sản xuất phim (?ed=etp-sx~<mã phim>)
//   puzzle  = sản phẩm đang làm / chờ ảnh / chờ duyệt (docTaiSanBan, sổ cái Directus)         → tab Tài sản
// Đọc DỮ LIỆU THẬT bằng chính hàm của trang gốc, không viết lại truy vấn → hai nơi luôn cùng số. Nguồn nào hỏng thì ghi `loi`, nguồn khác vẫn hiện.
// docEtp nặng (cả sổ camp) nên kết quả gom nhớ 60 giây — tab hỏi lại mỗi 30 giây.
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { docKenhSp } from '@/lib/tai-san/kenh-sp';
import { laDemo } from '@/lib/tai-san/kenh-sp-tinh';
import { docEtp } from '@/lib/etp-doc';
import { docTaiSanBan, TT_SP } from '@/lib/tai-san/doc';
import { dangCua, tenDang } from './so-kieu';

export type NguonSx = 'social' | 'kenh' | 'etp' | 'puzzle';
export const TEN_NGUON: Record<NguonSx, string> = { social: 'Social / Page', kenh: 'Kênh nội dung', etp: 'Ethopex', puzzle: 'Puzzle / Tài sản' };
export type ViecSx = {
  nguon: NguonSx; khoa: string; ten: string; /** dự án / kênh / máy */ cua: string | null;
  buoc: string; so?: number | null; tong?: number | null; /** bắt đầu / cập nhật gần nhất (ISO) */ luc?: string | null;
  loi?: string | null; ghi?: string | null;
  mo: { url: string } | { ed: string; id: string };
};

const STUDIO = 'https://studio.on.tc';
const TT_DANG = new Set(['dang_lam', 'cho_anh', 'cho_duyet']);
let nho: { luc: number; ra: { viec: ViecSx[]; loi: string[] } } | null = null;

export async function docViecSx(): Promise<{ viec: ViecSx[]; loi: string[] }> {
  if (nho && Date.now() - nho.luc < 60_000) return nho.ra;
  const loi: string[] = [];
  const hom = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const doc = async <T>(ten: string, f: () => Promise<T[]>): Promise<T[]> => { try { return await f(); } catch (e) { loi.push(`${ten}: ${(e as Error).message.slice(0, 140)}`); return []; } };

  const [social, kenh, etp, puzzle] = await Promise.all([
    // BÀI CHỜ DỰNG = view xv_bai_cho_dung do CHÍNH MÁY SX tạo (sx-may.mjs › VIEW_CHO_DUNG) — một định nghĩa cho máy lẫn trang (audit 11/11/2026: từng chép 3 nơi).
    // View chưa có = máy chưa chạy lượt nào → báo lỗi nguồn, không tự đoán điều kiện.
    doc('Social', async () => {
      const d = getDb(); if (!d) throw new Error('không có DB');
      const r = (await d.execute(sql`SELECT c.id, c.slug, c.may_id, c.may_ten, c.ten, c.dang_tu AS ngay, c.nen, c.kieu_sx AS kieu, c.updated_at::text AS luc,
          (SELECT l.loi FROM may_sx_luot l WHERE l.slug = c.slug ORDER BY l.luc DESC LIMIT 1) AS loi_moi
        FROM xv_bai_cho_dung c WHERE c.chay ORDER BY c.dang_tu IS NULL, c.dang_tu, c.id DESC LIMIT 200`)) as unknown as
        { id: number; slug: string; may_id: number; may_ten: string; ten: string | null; ngay: string | null; nen: string | null; kieu: string | null; luc: string | null; loi_moi: string | null }[];
      return r.map((x): ViecSx => ({ nguon: 'social', khoa: `s-${x.id}`, ten: x.ten || x.slug, cua: x.may_ten,
        buoc: x.ngay ? `chờ dựng · đăng ${x.ngay.slice(8, 10)}/${x.ngay.slice(5, 7)}` : 'chờ dựng (chưa xếp ngày)', luc: x.luc, loi: x.loi_moi,
        ghi: [tenDang(dangCua(x.kieu, x.nen)), x.slug].join(' · '),
        mo: { url: `${STUDIO}/?kho=tu_dong&may=${x.may_id}&video=${x.id}` } }));
    }),
    doc('Kênh nội dung', async () => (await docKenhSp(hom)).flatMap((k) => k.ke.dangLam.filter((d) => !laDemo(d)).map((d): ViecSx => ({
      nguon: 'kenh', khoa: `k-${k.ma}-${d.id}`, ten: d.ten || d.id, cua: k.ma, buoc: d.buoc ?? 'đang làm', so: d.so ?? null, tong: d.tong ?? null,
      luc: d.buoc_luc ?? d.luc, loi: d.loi ?? null, ghi: d.chi_tiet ?? null, mo: { url: `/?tab=kenh&kenh_mo=${encodeURIComponent(k.ma)}` } })))),
    // Kho góc sạch chưa dùng (1.754 dòng đo 11/11/2026) là HÀNG ĐÃ LÀM XONG nằm kho, không phải việc đang sản xuất — gom vào thì bảng
    // 1.782 dòng, 28 việc thật chìm mất. Lọc theo MÃ dòng (`camp-<creative>` — etp-doc.ts › choCamp), không theo chữ nhãn: đổi chữ "Kho góc…"
    // thì lọc theo chữ im lặng hỏng (audit 11/11/2026). Dòng chờ cắt lại mà ghi chú mang lỗi lần trước (TimeoutExpired…) hiện là LỖI.
    doc('Ethopex', async () => (await docEtp(undefined, false)).dangSx.filter((x) => !x.khoa.startsWith('camp-')).map((x): ViecSx => {
      const loiCu = !x.loi && /Error|Timeout|Traceback|Exception/.test(x.ghi ?? '');
      return {
      nguon: 'etp', khoa: `e-${x.khoa}`, ten: x.phim ?? (x.content_id ? `phim ${x.content_id}` : x.khoa), cua: x.lo ?? null, buoc: loiCu ? `${x.buoc} (lần trước hỏng)` : x.buoc,
      luc: x.luc, loi: x.loi || loiCu ? (x.ghi ?? 'lỗi') : null, ghi: x.loi || loiCu ? null : x.ghi,
      mo: x.content_id ? { ed: 'etp-sx', id: String(x.content_id) } : { url: '/?tab=ethopex' } }; })),
    doc('Puzzle / Tài sản', async () => {
      const t = await docTaiSanBan();
      if (t.loi.length) loi.push(...t.loi.map((l) => `Tài sản: ${l}`));
      return t.shops.flatMap((s) => s.sp.filter((p) => TT_DANG.has(p.trangThai)).map((p): ViecSx => {
        const m = p.tienDo?.match(/^(\d+)\/(\d+)$/);
        return { nguon: 'puzzle', khoa: `p-${p.khoa}`, ten: p.ten, cua: s.ten, buoc: TT_SP.find((x) => x.key === p.trangThai)?.chu ?? p.trangThai,
          so: m ? Number(m[1]) : null, tong: m ? Number(m[2]) : null, ghi: p.ke ? `bước kế: ${p.ke}` : null, mo: { url: '/?tab=taisan' } };
      }));
    }),
  ]);
  const ra = { viec: [...etp, ...kenh, ...social, ...puzzle], loi };
  nho = { luc: Date.now(), ra };
  return ra;
}
