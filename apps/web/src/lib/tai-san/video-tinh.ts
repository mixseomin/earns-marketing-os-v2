// Số VIDEO SHORT theo khung 7 NGÀY (anh chốt 11/10/2026: mọi số cùng một khung, so với 7 ngày trước).
// Máy (puzzle-books/scripts/so-short.mjs) ghi mỗi ngày số CỘNG DỒN từng video vào kenh_so_ngay.chi_tiet.videos.
// 7 ngày = cộng dồn mới nhất − bản ghi gần nhất có ngày ≤ hôm nay−7. Video đăng sau mốc đó tính từ 0.
// Không có mốc (máy mới đo, video cũ hơn 7 ngày) = null → hiện "–" (chưa đo ≠ 0). Module THUẦN, không import — tự kiểm: tsx video-tinh.test.mts
export const KENH_VIDEO = [
  { key: 'youtube', nhan: 'YouTube' }, { key: 'tiktok', nhan: 'TikTok' },
  { key: 'fb-reels', nhan: 'FB Reels' }, { key: 'ig-reels', nhan: 'IG Reels' },
] as const;
export type VideoSo = { slug: string; url?: string; tieuDe?: string; ngayDang?: string; xem: number; thich?: number; binhLuan?: number };
/** vaoShop = phiên vào pickjot /printables 7 ngày từ nền này (GA4, so-short.mjs) — đã là số 7 ngày, lấy ở bản ghi mới nhất */
export type DongSo = { kenh: string; sanPham: string; ngay: string; videos: VideoSo[]; vaoShop?: number | null };
export type ONen = { xem7: number | null; tong: number; url?: string; thich?: number; binhLuan?: number };
export type VideoDong = { slug: string; tieuDe: string; sanPham: string; ngayDang: string | null; nen: Record<string, ONen>; tong7: number | null };
export type NenTong = { kenh: string; nhan: string; xem7: number | null; truoc7: number | null; tong: number; soVideo: number; chuaDo: number; ngay: string | null; vaoShop7: number | null };

const lui = (ymd: string, n: number) => new Date(Date.parse(`${ymd}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);

/** Số cộng dồn của một video tại mốc `den` (bản ghi gần nhất ≤ den); video đăng sau mốc = 0; không có bản ghi = null. */
function tai(ds: DongSo[], slug: string, den: string, ngayDang?: string): number | null {
  const r = [...ds].filter((d) => d.ngay <= den).sort((a, b) => b.ngay.localeCompare(a.ngay))[0];
  const v = r?.videos.find((x) => x.slug === slug);
  if (v) return v.xem;
  return ngayDang && ngayDang > den ? 0 : null;
}

export function tinhVideo(dongs: DongSo[], hom: string): { nen: NenTong[]; video: VideoDong[] } {
  const d7 = lui(hom, 7), d14 = lui(hom, 14), video = new Map<string, VideoDong>();
  const nen = KENH_VIDEO.map(({ key, nhan }): NenTong => {
    const cua = dongs.filter((d) => d.kenh === key);
    const theoSp = new Map<string, DongSo[]>();
    for (const d of cua) theoSp.set(d.sanPham, [...(theoSp.get(d.sanPham) ?? []), d]);
    let xem7 = 0, truoc7 = 0, tong = 0, soVideo = 0, chuaDo = 0, coTruoc = false, ngay: string | null = null, vaoShop7: number | null = null;
    for (const [sp, ds] of theoSp) {
      const moi = [...ds].sort((a, b) => b.ngay.localeCompare(a.ngay))[0]; if (!moi) continue;
      if (!ngay || moi.ngay > ngay) ngay = moi.ngay;
      if (moi.vaoShop != null) vaoShop7 = (vaoShop7 ?? 0) + moi.vaoShop;
      for (const v of moi.videos) {
        const goc = tai(ds, v.slug, d7, v.ngayDang), goc2 = tai(ds, v.slug, d14, v.ngayDang);
        const x7 = goc == null ? null : Math.max(0, v.xem - goc);
        if (x7 == null) chuaDo++; else xem7 += x7;
        if (goc != null && goc2 != null) { truoc7 += goc - goc2; coTruoc = true; }
        tong += v.xem; soVideo++;
        const vd = video.get(v.slug) ?? { slug: v.slug, tieuDe: v.tieuDe ?? v.slug, sanPham: sp, ngayDang: v.ngayDang ?? null, nen: {}, tong7: null };
        vd.nen[key] = { xem7: x7, tong: v.xem, url: v.url, thich: v.thich, binhLuan: v.binhLuan };
        if (v.ngayDang && (!vd.ngayDang || v.ngayDang < vd.ngayDang)) vd.ngayDang = v.ngayDang;
        video.set(v.slug, vd);
      }
    }
    return { kenh: key, nhan, xem7: soVideo && chuaDo < soVideo ? xem7 : null, truoc7: coTruoc ? truoc7 : null, tong, soVideo, chuaDo, ngay, vaoShop7 };
  });
  for (const v of video.values()) { const xs = Object.values(v.nen).map((o) => o.xem7).filter((x): x is number => x != null); v.tong7 = xs.length ? xs.reduce((a, b) => a + b, 0) : null; }
  return { nen, video: [...video.values()].sort((a, b) => (b.tong7 ?? -1) - (a.tong7 ?? -1) || a.tieuDe.localeCompare(b.tieuDe)) };
}

/** % đổi so với 7 ngày trước; null khi chưa đủ 14 ngày đo hoặc kỳ trước = 0 */
export const doi = (n: NenTong) => (n.xem7 == null || n.truoc7 == null || n.truoc7 === 0 ? null : Math.round(((n.xem7 - n.truoc7) / n.truoc7) * 100));

/** Số cũ hơn 2 ngày = máy đọc số nền đó đã chết (Pinterest câm từ 07/10 tới 12/10/2026 vì lịch thiếu node trong PATH) → thẻ phải kêu. */
export const soCu = (ngay: string | null, hom: string) => !!ngay && ngay < lui(hom, 2);

/** Pinterest: số Pinterest tự tính trên cửa sổ 30 NGÀY (analytics overview), không phải cộng dồn → không trừ ra 7 ngày được, giữ nguyên khung 30 ngày. */
/** soGhimCoHien = số ghim trong bảng Top Pins (ghim CÓ lượt hiện 30 ngày) — KHÔNG phải số ghim đã đăng (15/10/2026: "4 ghim" bị đọc thành chỉ đăng 4) */
export type PinTong = { hien30: number; click30: number; tuongTac30: number; soGhimCoHien: number; ngay: string };
export function tinhPin(so: Record<string, { ngay: string; hien: number; tuongTac: number; click: number; soMuc: number }>): PinTong | null {
  const ds = Object.entries(so).filter(([k]) => k.startsWith('pinterest|')).map(([, v]) => v);
  if (!ds.length) return null;
  return { hien30: ds.reduce((t, v) => t + v.hien, 0), click30: ds.reduce((t, v) => t + v.click, 0), tuongTac30: ds.reduce((t, v) => t + v.tuongTac, 0),
    soGhimCoHien: ds.reduce((t, v) => t + v.soMuc, 0), ngay: ds.map((v) => v.ngay).sort().pop()! };
}
