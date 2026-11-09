// SOCIAL TRỎ VỀ — phần TÍNH (thuần, client import được; tự kiểm: tsx social-tro-ve-tinh.test.mts). Đọc DB ở social-tro-ve.ts.
// Anh 02/11/2026: "Kênh nội dung, Website, Sản phẩm: thêm một khối hiện số lượng social đang trỏ về, metrics theo khung thời gian".
// ĐÍCH của một bài = link trong bài (xv_may_video.dang.link — trang / sản phẩm cụ thể), thiếu thì site_dich của máy đăng. Khoá đích = host không www + đường dẫn,
// bỏ "/" cuối và query. Site khớp mọi khoá cùng tên miền gốc; sản phẩm / kênh khớp đúng đường dẫn (hoặc đường dẫn con).

export const KY_SOCIAL = [7, 30, 90] as const;
export type TroVe = { ky: number; /** số TÀI KHOẢN social (nền + tài khoản) có bài trỏ về, mọi lúc */ taiKhoan: number; nen: string[]; bai: number; xem: number | null; khach: number | null };
export type BaiDich = { dich: string; nen: string; tk: string; ngay: string | null; xem: number | null };

export const khoaDich = (u: string | null | undefined): string | null => {
  if (!u) return null;
  const s = String(u).trim().replace(/^https?:\/\//i, '').replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase().replace(/^www\./, '');
  return s || null;
};
export const mienGoc = (khoa: string) => (khoa.split('/')[0] ?? '').split('.').slice(-2).join('.');
const lui = (ymd: string, n: number) => new Date(Date.parse(`${ymd}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);

/** Gộp bài theo đích: taiKhoan = số tài khoản (nền + tài khoản) có bài trỏ về đích (mọi lúc); bai = bài đăng trong ky ngày tới hom; xem = lượt xem cộng dồn TỚI NAY của các bài đó.
 *  khach (site) = phiên từ bài đăng trong kỳ theo tên miền (sổ phiên adfond, khoá miền gốc); null = đích không có mã đo (sản phẩm trên chợ). */
export function gopTroVe(ds: BaiDich[], khachMien: Map<string, number> | null, ky: number, hom: string, khop: (khoa: string) => boolean, laSite: boolean): TroVe | null {
  const cua = ds.filter((b) => khop(b.dich)); if (!cua.length) return null;
  const tu = lui(hom, ky), trong = cua.filter((b) => b.ngay && b.ngay > tu);
  const xems = trong.map((b) => b.xem).filter((x): x is number => x != null);
  const mien = laSite ? [...new Set(cua.map((b) => mienGoc(b.dich)))] : [];
  return {
    ky, taiKhoan: new Set(cua.map((b) => `${b.nen}|${b.tk}`)).size, nen: [...new Set(cua.map((b) => b.nen))].sort(), bai: trong.length,
    xem: xems.length ? xems.reduce((t, x) => t + x, 0) : null,
    khach: laSite && khachMien ? mien.reduce((t, m) => t + (khachMien.get(m) ?? 0), 0) : null,
  };
}
export const khopSite = (domain: string) => { const g = mienGoc(khoaDich(domain) ?? ''); return (k: string) => mienGoc(k) === g; };
export const khopDuong = (url: string | null | undefined) => { const c = khoaDich(url); return (k: string) => !!c && (k === c || k.startsWith(`${c}/`)); };

/** LỊCH SOCIAL TRỎ VỀ (anh 02/11/2026: lịch nhỏ như Kênh nội dung, trong menu ⋯ của site có kênh social trỏ về): mỗi việc một sự kiện { dich, loai, ngay, chu }
 *  — lam = video làm xong chờ đăng, hen = lịch đăng dự kiến của máy, dang = bài đã đăng (mỗi nền một bài). Gộp theo ngày × loại cho ui/lich-nho (OLichNho). */
export type SuKienLich = { dich: string; loai: 'lam' | 'hen' | 'dang'; ngay: string; chu: string; url?: string | null };
/** Một nền của bài (xv_may_video.da_dang[nen]): máy đăng hẹn giờ trên nền (FB Graph scheduled) ghi { hen: true, luc } NGAY lúc hẹn — chưa tới luc là HẸN ĐĂNG,
 *  không phải đã đăng (anh 02/11/2026 #1511: ô ngày mai hiện xanh "đã đăng"). */
export const daLenThat = (v: { hen?: boolean | null; luc?: string | null }, nayIso: string) => !(v.hen && v.luc && v.luc > nayIso);
/** Link mở được của bài trên nền: url thật giữ nguyên; hẹn giờ FB chỉ có mã — fb-hen-api:<video> → trang reel, fb-hen:<id> → facebook.com/<id>; còn lại null. */
export const linkBai = (url: string | null | undefined): string | null => {
  if (!url) return null; if (/^https?:\/\//i.test(url)) return url;
  const m = url.match(/^fb-hen(-api)?:(\d+)/); return m ? (m[1] ? `https://www.facebook.com/reel/${m[2]}/` : `https://www.facebook.com/${m[2]}`) : null;
};
export const LOAI_LICH_SOCIAL = {
  lam: { ic: '🎬', mau: '#8b5cf6', ten: 'làm xong' }, hen: { ic: '🗓', mau: '#3c9bff', ten: 'hẹn đăng' }, dang: { ic: '✅', mau: '#22c55e', ten: 'đã đăng' },
} as const;
export function lichTroVe(ds: SuKienLich[], khop: (khoa: string) => boolean): { ngay: string; loai: string; so: number; chiTiet: string[]; muc: { chu: string; url: string | null }[] }[] {
  const g = new Map<string, { ngay: string; loai: string; so: number; chiTiet: string[]; muc: { chu: string; url: string | null }[] }>();
  for (const e of ds) { if (!khop(e.dich)) continue; const k = `${e.ngay}|${e.loai}`, x = g.get(k) ?? { ngay: e.ngay, loai: e.loai, so: 0, chiTiet: [], muc: [] };
    x.so += 1; if (x.chiTiet.length < 8) { x.chiTiet.push(e.chu); x.muc.push({ chu: e.chu, url: e.url ?? null }); } g.set(k, x); }
  return [...g.values()].sort((a, b) => a.ngay.localeCompare(b.ngay) || a.loai.localeCompare(b.loai));
}
