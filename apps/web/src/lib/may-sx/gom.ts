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
import { docLuoiSocial, type StLuoiO } from '@/lib/social-traffic';
import type { KenhSp } from '@/lib/tai-san/kenh-sp-tinh';

import type { NguonSx, ViecSx } from './gom-kieu';
export { TEN_NGUON, type NguonSx, type ViecSx } from './gom-kieu';

const TT_DANG = new Set(['dang_lam', 'cho_anh', 'cho_duyet']);
let nho: { luc: number; ra: { viec: ViecSx[]; kenh: KenhSp[]; loi: string[] } } | null = null;

/** Ô LỊCH Social Traffic của từng bài (theo máy + slug) để mở CHÍNH ngăn bài của lịch (ChiTietBai). Bài chưa có ô trên lịch (ngoài cửa sổ lịch, chưa xếp ngày)
 *  thì dựng ô cùng khuôn từ sổ bài — vẫn là ngăn bài của lịch, chỉ thiếu số liệu đăng. */
export async function baiTheoSlug(ds: { may: string; slug: string }[]): Promise<Map<string, StLuoiO>> {
  const ra = new Map<string, StLuoiO>(); if (!ds.length) return ra;
  const { luoi } = await docLuoiSocial().catch(() => ({ luoi: { o: [] as StLuoiO[] } }));
  for (const o of luoi.o) if (o.slug && !ra.has(`${o.may}|${o.slug}`)) ra.set(`${o.may}|${o.slug}`, o);
  const thieu = ds.filter((x) => !ra.has(`${x.may}|${x.slug}`)); const d = getDb();
  if (thieu.length && d) {
    const r = (await d.execute(sql`SELECT m.ma, m.ten, v.slug, v.dang, coalesce(v.anh->>0, v.khung->>0, v.nen_url) AS anh, v.video_url AS video, v.da_dang,
        (SELECT ten FROM etp.thu_vien_phim WHERE content_id::text = v.dang->>'phim' LIMIT 1) AS phim_ten
      FROM xv_may_video v JOIN xv_may m ON m.id = v.may_id WHERE v.slug = ANY(${sql.raw(`ARRAY[${thieu.map((x) => `'${x.slug.replace(/'/g, "''")}'`).join(',')}]::text[]`)})`).catch(() => [])) as unknown as
      { ma: string; ten: string; slug: string; dang: Record<string, string | null> | null; anh: string | null; video: string | null; da_dang: Record<string, { ngay?: string; url?: string }> | null; phim_ten: string | null }[];
    // dang_tu chỉ có NGÀY (vd '2026-11-17') — giờ do máy đăng xếp lúc lên lịch; không có giờ thì ghi '—', KHÔNG bịa 00:00 (12/11/2026)
    for (const x of r) { const g = x.dang ?? {}, tu = String(g.dang_tu ?? ''), coGio = /T\d\d:\d\d/.test(tu);
      const dt = !tu ? null : coGio ? (/[zZ]|[+-]\d\d:?\d\d$/.test(tu.slice(10)) ? new Date(Date.parse(tu) + 7 * 3600e3).toISOString() : tu) : null;
      const da = Object.entries(x.da_dang ?? {})[0];
      ra.set(`${x.ma}|${x.slug}`, { ngay: da?.[1]?.ngay ?? (dt ?? tu).slice(0, 10) ?? '—', gio: dt ? dt.slice(11, 16) : '—', may: x.ma, mayTen: x.ten, nen: da?.[0] ?? String(g.dang_bai ?? ''),
        title: String(g.title ?? x.slug), url: da?.[1]?.url ?? null, loai: da ? 'da' : 'du_kien', slug: x.slug, anh: x.anh, video: x.video, moTa: g.description ?? null, huong: g.y ?? null, phimTen: x.phim_ten }); }
  }
  return ra;
}

export async function docViecSx(): Promise<{ viec: ViecSx[]; kenh: KenhSp[]; loi: string[] }> {
  if (nho && Date.now() - nho.luc < 60_000) return nho.ra;
  const loi: string[] = []; let dsKenh: KenhSp[] = [];
  const hom = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const doc = async <T>(ten: string, f: () => Promise<T[]>): Promise<T[]> => { try { return await f(); } catch (e) { loi.push(`${ten}: ${(e as Error).message.slice(0, 140)}`); return []; } };

  const [social, kenh, etp, puzzle] = await Promise.all([
    // BÀI CHỜ DỰNG = view xv_bai_cho_dung do CHÍNH MÁY SX tạo (sx-may.mjs › VIEW_CHO_DUNG) — một định nghĩa cho máy lẫn trang (audit 11/11/2026: từng chép 3 nơi).
    // View chưa có = máy chưa chạy lượt nào → báo lỗi nguồn, không tự đoán điều kiện.
    doc('Social', async () => {
      const d = getDb(); if (!d) throw new Error('không có DB');
      const r = (await d.execute(sql`SELECT c.id, c.slug, c.may_id, c.may, c.may_ten, c.ten, c.dang_tu AS ngay, c.nen, c.kieu_sx AS kieu, c.updated_at::text AS luc,
          (SELECT l.loi FROM may_sx_luot l WHERE l.slug = c.slug ORDER BY l.luc DESC LIMIT 1) AS loi_moi
        FROM xv_bai_cho_dung c WHERE c.chay ORDER BY c.dang_tu IS NULL, c.dang_tu, c.id DESC LIMIT 200`)) as unknown as
        { id: number; slug: string; may_id: number; may: string; may_ten: string; ten: string | null; ngay: string | null; nen: string | null; kieu: string | null; luc: string | null; loi_moi: string | null }[];
      return r.map((x): ViecSx => ({ nguon: 'social', khoa: `s-${x.id}`, ten: x.ten || x.slug, cua: x.may_ten,
        buoc: x.ngay ? `chờ dựng · đăng ${x.ngay.slice(8, 10)}/${x.ngay.slice(5, 7)}` : 'chờ dựng (chưa xếp ngày)', luc: x.luc, loi: x.loi_moi,
        ghi: [tenDang(dangCua(x.kieu, x.nen)), x.slug].join(' · '),
        mo: { bai: { ngay: '', gio: '', may: x.may, mayTen: x.may_ten, nen: '', title: x.slug, url: null, loai: 'du_kien', slug: x.slug } } }));
    }),
    doc('Kênh nội dung', async () => (dsKenh = await docKenhSp(hom)).flatMap((k) => k.ke.dangLam.filter((d) => !laDemo(d)).map((d): ViecSx => ({
      nguon: 'kenh', khoa: `k-${k.ma}-${d.id}`, ten: d.ten || d.id, cua: k.ma, buoc: d.buoc ?? 'đang làm', so: d.so ?? null, tong: d.tong ?? null,
      luc: d.buoc_luc ?? d.luc, loi: d.loi ?? null, ghi: d.chi_tiet ?? null, mo: { kenh: k.ma } })))),
    // Kho góc sạch chưa dùng (1.754 dòng đo 11/11/2026) là HÀNG ĐÃ LÀM XONG nằm kho, không phải việc đang sản xuất — gom vào thì bảng
    // 1.782 dòng, 28 việc thật chìm mất. Lọc theo MÃ dòng (`camp-<creative>` — etp-doc.ts › choCamp), không theo chữ nhãn: đổi chữ "Kho góc…"
    // thì lọc theo chữ im lặng hỏng (audit 11/11/2026). Dòng chờ cắt lại mà ghi chú mang lỗi lần trước (TimeoutExpired…) hiện là LỖI.
    doc('Ethopex', async () => (await docEtp(undefined, false)).dangSx.filter((x) => !x.khoa.startsWith('camp-')).map((x): ViecSx => {
      const loiCu = !x.loi && /Error|Timeout|Traceback|Exception/.test(x.ghi ?? '');
      return {
      nguon: 'etp', khoa: `e-${x.khoa}`, ten: x.phim ?? (x.content_id ? `phim ${x.content_id}` : x.khoa), cua: x.lo ?? null, buoc: loiCu ? `${x.buoc} (lần trước hỏng)` : x.buoc,
      luc: x.luc, loi: x.loi || loiCu ? (x.ghi ?? 'lỗi') : null, ghi: x.loi || loiCu ? null : x.ghi,
      mo: { ed: 'etp-sx', id: String(x.content_id ?? '') } }; })),
    doc('Puzzle / Tài sản', async () => {
      const t = await docTaiSanBan();
      if (t.loi.length) loi.push(...t.loi.map((l) => `Tài sản: ${l}`));
      return t.shops.flatMap((s) => s.sp.filter((p) => TT_DANG.has(p.trangThai)).map((p): ViecSx => {
        const m = p.tienDo?.match(/^(\d+)\/(\d+)$/);
        return { nguon: 'puzzle', khoa: `p-${p.khoa}`, ten: p.ten, cua: s.ten, buoc: TT_SP.find((x) => x.key === p.trangThai)?.chu ?? p.trangThai,
          so: m ? Number(m[1]) : null, tong: m ? Number(m[2]) : null, ghi: p.ke ? `bước kế: ${p.ke}` : null, mo: { sp: { s: { ...s, sp: [] }, x: p } } };
      }));
    }),
  ]);
  // bài social: thay ô tạm bằng Ô LỊCH thật của bài (ngăn bài lịch Social Traffic)
  const o = await baiTheoSlug(social.map((v) => ('bai' in v.mo ? { may: v.mo.bai.may, slug: v.mo.bai.slug ?? '' } : null)).filter((x): x is { may: string; slug: string } => !!x?.slug));
  for (const v of social) if ('bai' in v.mo) { const t = o.get(`${v.mo.bai.may}|${v.mo.bai.slug}`); if (t) v.mo = { bai: t }; }
  // hồ sơ kênh chỉ gửi kênh có việc đang làm — ngăn KenhNgan đọc từ đây
  const kenhCo = new Set(kenh.map((v) => ('kenh' in v.mo ? v.mo.kenh : ''))), ra = { viec: [...etp, ...kenh, ...social, ...puzzle], kenh: dsKenh.filter((k) => kenhCo.has(k.ma)), loi };
  nho = { luc: Date.now(), ra };
  return ra;
}
