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
import { docDong, type DongPhim } from '@/lib/actions/etp-dong';
import type { Nhip } from '@/components/ui/chuoi-nhip';
import { TEN_BUOC as TEN_BUOC_ETP } from '@/lib/etp-sx';
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
let nhoLuoi: { luc: number; o: StLuoiO[] } | null = null;
export async function baiTheoSlug(ds: { may: string; slug: string }[]): Promise<Map<string, StLuoiO>> {
  const ra = new Map<string, StLuoiO>(); if (!ds.length) return ra;
  // lịch Social dựng ~5 giây (đo 12/11/2026) — nhớ 60 giây như phần gom, tab hỏi lại mỗi 30 giây
  if (!nhoLuoi || Date.now() - nhoLuoi.luc > 60_000) nhoLuoi = { luc: Date.now(), o: (await docLuoiSocial().catch(() => ({ luoi: { o: [] as StLuoiO[] } }))).luoi.o };
  const luoi = { o: nhoLuoi.o };
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
    // BÀI SOCIAL CỦA MÁY SX TỚI LÚC ĐĂNG (anh 12/11/2026 "SX thì làm sao chia thành các nhịp rõ ràng"): bài chờ dựng (view xv_bai_cho_dung — một định nghĩa
    // với máy) + bài Máy SX đã dựng trong 14 ngày mà chưa đăng → nhịp Lịch · Dựng · Chấm · Đăng. View chưa có = máy chưa chạy lượt nào → báo lỗi nguồn.
    doc('Social', async () => {
      const d = getDb(); if (!d) throw new Error('không có DB');
      const r = (await d.execute(sql`SELECT v.id, v.slug, m.ma AS may, m.ten AS may_ten, coalesce(v.dang->>'y', v.dang->>'title', v.chu_de) AS ten, nullif(v.dang->>'dang_tu', '') AS ngay,
          v.dang->>'dang_bai' AS nen, v.dang->>'kieu_sx' AS kieu, v.updated_at::text AS luc, (v.video_url IS NOT NULL OR jsonb_array_length(coalesce(v.anh, '[]'::jsonb)) > 0) AS co_tep,
          v.cham->>'ket' AS ket, (SELECT string_agg(c, ' · ') FROM jsonb_array_elements_text(coalesce(v.cham->'chan_cung', '[]'::jsonb)) c) AS chan, l.trang_thai AS l_tt, l.loi AS l_loi
        FROM xv_may_video v JOIN xv_may m ON m.id = v.may_id
        LEFT JOIN LATERAL (SELECT trang_thai, loi FROM may_sx_luot x WHERE x.slug = v.slug ORDER BY x.luc DESC LIMIT 1) l ON true
        WHERE m.chay AND v.da_dang = '{}'::jsonb AND NOT coalesce(v.luu_tru, false)
          AND (v.id IN (SELECT id FROM xv_bai_cho_dung) OR EXISTS (SELECT 1 FROM may_sx_luot x WHERE x.slug = v.slug AND x.luc > now() - interval '14 days'))
        ORDER BY nullif(v.dang->>'dang_tu', '') NULLS LAST, v.id DESC LIMIT 200`)) as unknown as
        { id: number; slug: string; may: string; may_ten: string; ten: string | null; ngay: string | null; nen: string | null; kieu: string | null; luc: string | null; co_tep: boolean; ket: string | null; chan: string | null; l_tt: string | null; l_loi: string | null }[];
      return r.map((x): ViecSx => {
        const dung = x.co_tep ? 'xong' : x.l_tt === 'hong' ? 'loi' : x.l_tt === 'dang' ? 'dang' : 'cho';
        const cham = !x.co_tep ? 'cho' : x.ket === 'DUYET' ? 'xong' : x.ket ? 'loi' : 'dang';
        const nhip: Nhip[] = [{ ten: 'Lịch', tt: x.ngay ? 'xong' : 'cho', chu: x.ngay ? `${x.ngay.slice(8, 10)}/${x.ngay.slice(5, 7)}` : null },
          { ten: 'Dựng', tt: dung, ghi: x.l_loi }, { ten: 'Chấm', tt: cham, chu: x.ket === 'SUA_LAI' ? 'sửa lại' : x.ket === 'KHONG_DUYET' ? 'không duyệt' : null, ghi: x.chan },
          { ten: 'Đăng', tt: cham === 'xong' ? 'dang' : 'cho', chu: cham === 'xong' ? 'chờ giờ' : null }];
        const hien = nhip.find((n) => n.tt !== 'xong');
        return { nguon: 'social', khoa: `s-${x.id}`, ten: x.ten || x.slug, cua: x.may_ten, buoc: !hien ? 'xong' : hien.ten === 'Đăng' ? 'chờ giờ đăng' : `${hien.ten}${hien.tt === 'loi' ? ' lỗi' : hien.tt === 'dang' ? ' đang làm' : ' chờ'}`, nhip,
          luc: x.luc, loi: dung === 'loi' ? x.l_loi : cham === 'loi' ? x.chan : null, ghi: [tenDang(dangCua(x.kieu, x.nen)), x.slug].join(' · '),
          mo: { bai: { ngay: '', gio: '', may: x.may, mayTen: x.may_ten, nen: '', title: x.slug, url: null, loai: 'du_kien', slug: x.slug } } };
      });
    }),
    doc('Kênh nội dung', async () => (dsKenh = await docKenhSp(hom)).flatMap((k) => k.ke.dangLam.filter((d) => !laDemo(d)).map((d): ViecSx => ({
      nguon: 'kenh', khoa: `k-${k.ma}-${d.id}`, ten: d.ten || d.id, cua: k.ma, buoc: d.buoc ?? 'đang làm', so: d.so ?? null, tong: d.tong ?? null,
      luc: d.buoc_luc ?? d.luc, loi: d.loi ?? null, ghi: d.chi_tiet ?? null, mo: { kenh: k.ma },
      // nhịp = các bước của lượt làm tập (so/tong do máy ghi); máy chỉ ghi TÊN bước đang chạy nên ô khác mang số bước
      nhip: Array.from({ length: d.tong ?? 0 }, (_, i): Nhip => { const so = d.so ?? 0, nay = i === so - 1;
        return { ten: nay && d.buoc ? d.buoc : `Bước ${i + 1}`, tt: i < so - 1 ? 'xong' : nay ? (d.loi ? 'loi' : 'dang') : 'cho', ghi: nay ? d.loi ?? d.chi_tiet ?? null : null }; }) })))),
    // ETHOPEX = CHÍNH các dòng phim của bảng Sản xuất (lib/actions/etp-dong › docDong, lọc đang làm + lỗi) — nhịp vẽ bằng ChuoiBuoc của bảng đó (anh 12/11/2026
    // chỉ vào bảng này: "SX thì làm sao chia thành các nhịp rõ ràng thế này"). Trước đọc hàng chờ rời (docEtp › dangSx) — có mục "chờ soát đoạn" đứng 92 ngày.
    doc('Ethopex', async () => {
      // docDong dựng cả danh sách mỗi lần gọi → gọi MỘT lần mỗi bộ lọc với cỡ trang lớn: 'dang' đọc hết, 'loi' chỉ 50 dòng gấp nhất (2.123 dòng lỗi / dừng
      // đo 12/11/2026 phần lớn là lịch sử "lên camp dừng"). Phần không hiện thì BÁO số, không cắt im lặng.
      const ds = new Map<number, DongPhim>(), TOI_DA = 1000;
      const rd = await docDong('dang', '', 0, '', '', TOI_DA); if ('loi' in rd) throw new Error(String(rd.loi)); for (const x of rd.dong) ds.set(x.id, x);
      if (rd.tong > rd.dong.length) loi.push(`Ethopex: ${rd.tong} dòng đang làm, tab hiện ${rd.dong.length} — đủ ở tab Ethopex › Sản xuất`);
      const rl = await docDong('loi', '', 0, '', '', 50); if ('loi' in rl) throw new Error(String(rl.loi)); for (const x of rl.dong) ds.set(x.id, x);
      if (rl.tong > rl.dong.length) loi.push(`Ethopex: ${rl.tong} dòng lỗi / dừng, tab hiện ${rl.dong.length} dòng gấp nhất — đủ ở tab Ethopex › Sản xuất (lọc Lỗi / dừng)`);
      return [...ds.values()].map((x): ViecSx => {
        const hien = x.buoc.find((b) => ['loi', 'dung'].includes(b.trang_thai)) ?? x.buoc.find((b) => b.trang_thai === 'dang') ?? x.buoc.find((b) => b.trang_thai === 'cho');
        const hong = ['loi', 'dung'].includes(x.trang_thai) || ['loi', 'dung'].includes(hien?.trang_thai ?? '');
        return { nguon: 'etp', khoa: `e-${x.id}`, ten: x.ten ?? `phim ${x.content_id}`, cua: [x.loai, x.the_loai, x.ngoai].filter(Boolean).join(' · ') || null,
          buoc: hien ? `${TEN_BUOC_ETP[hien.buoc] ?? hien.buoc}${hien.trang_thai === 'dang' ? ' đang làm' : hien.trang_thai === 'cho' ? ' chờ' : hien.trang_thai === 'dung' ? ' dừng' : ' lỗi'}` : 'xong',
          luc: hien?.bat_dau ?? x.tao_luc, loi: hong ? (x.ly_do ?? hien?.ghi ?? 'lỗi') : null, ghi: hong ? null : hien?.ghi ?? null,
          etp: { loai: x.loai, buoc: x.buoc.map((b) => ({ buoc: b.buoc, trang_thai: b.trang_thai, ghi: b.ghi, ket_qua: b.ket_qua })) },
          mo: { ed: 'etp-sx', id: String(x.content_id) } };
      });
    }),
    doc('Puzzle / Tài sản', async () => {
      const t = await docTaiSanBan();
      if (t.loi.length) loi.push(...t.loi.map((l) => `Tài sản: ${l}`));
      return t.shops.flatMap((s) => s.sp.filter((p) => TT_DANG.has(p.trangThai)).map((p): ViecSx => {
        const m = p.tienDo?.match(/^(\d+)\/(\d+)$/);
        return { nguon: 'puzzle', khoa: `p-${p.khoa}`, ten: p.ten, cua: s.ten, buoc: TT_SP.find((x) => x.key === p.trangThai)?.chu ?? p.trangThai,
          so: m ? Number(m[1]) : null, tong: m ? Number(m[2]) : null, ghi: p.ke ? `bước kế: ${p.ke}` : null, mo: { sp: { s: { ...s, sp: [] }, x: p } },
          // vòng đời sản phẩm (lib/tai-san/kieu.ts): làm → anh duyệt bản xem → nộp sàn → sàn duyệt → bán
          nhip: ((): Nhip[] => { const vi = { dang_lam: 0, cho_anh: 1, san_sang: 2, cho_duyet: 3, dang_ban: 4 }[p.trangThai as string] ?? 0;
            return ['Làm', 'Anh duyệt', 'Nộp sàn', 'Sàn duyệt', 'Bán'].map((ten, i) => ({ ten, tt: i < vi ? 'xong' : i === vi ? 'dang' : 'cho', chu: i === 0 && vi === 0 ? p.tienDo ?? null : null, ghi: i === vi && p.ke ? `kế: ${p.ke}` : null })); })() };
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
