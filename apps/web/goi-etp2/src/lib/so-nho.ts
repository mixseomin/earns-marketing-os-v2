'use client';
// SỐ GIỮ TRONG MÁY — MỘT CHỖ DUY NHẤT cho mọi thứ etp2 "hiện ngay bản lần trước, tải mới ngầm" (anh 13/11/2026: mạng iPhone 20–200 KB/giây;
// "Có data rồi mà vẫn phải đợi tiếp à… Thiết kế kiểu gì đây"). Hai lớp dùng:
//   · khối số chính của trang (components/etp-view-khach: phần chính + phần phụ, ~10 MB chữ — quá trần ~5 MB của kho chữ trình duyệt nên dùng Cache API)
//   · widget tự tải riêng: Người / Tài khoản (taiTong2), Insight (docInsight), bố cục Tổng quan (docBoCuc) — qua useSoNho.
// Trước 13/11 23:xx hai lớp đi hai kho (Cache API + kho chữ) với hai bộ hàm đọc / ghi — /audit gom về đây, chỉ Cache API.
// Trình duyệt chặn / hết chỗ → chỉ mất phần hiện-ngay, vẫn tải như thường; lỗi ghi ra console (không nuốt im).
import { useEffect, useState } from 'react';
import { nhip } from './nhip';

const KHO = 'etp2-nho-v2';
// kho cũ trước khi gom (bản số ~10 MB của etp-view-khach 13/11) — xoá một lần để không nằm chết trong máy
if (typeof caches !== 'undefined') void caches.delete('etp2-du-v1').catch(() => {});
const url = (k: string) => `/etp2-nho/${encodeURIComponent(k)}`;
export type BanNho = { than: string; ma: string; luc: number };

/** đọc bản đã giữ: chữ JSON + mã phiên bản (nếu có) + lúc giữ (ms) */
export async function docNho(k: string): Promise<BanNho | null> {
  try {
    if (typeof caches === 'undefined') return null;
    const r = await (await caches.open(KHO)).match(url(k));
    return r ? { than: await r.text(), ma: r.headers.get('x-ma') ?? '', luc: Number(r.headers.get('x-luc')) || 0 } : null;
  } catch (e) { console.warn('[etp2 số giữ trong máy] đọc', k, e); return null; }
}
/** giữ một bản (chữ JSON sẵn có thì đưa thẳng, khỏi stringify lại) */
export async function ghiNho(k: string, v: unknown, ma = ''): Promise<void> {
  try {
    if (typeof caches === 'undefined') return;
    await (await caches.open(KHO)).put(url(k), new Response(typeof v === 'string' ? v : JSON.stringify(v), { headers: { 'content-type': 'application/json', 'x-ma': ma, 'x-luc': String(Date.now()) } }));
  } catch (e) { console.warn('[etp2 số giữ trong máy] ghi', k, e); }
}

/** widget tự tải: bản giữ hiện ngay (khi bản mới chưa về), bản mới về thì thay + giữ lại. tai trả `{ loi }` khi máy chủ báo lỗi; `ms` = nhịp tải lại.
 *  `hop` = bài kiểm KHUÔN của bản giữ (19/11/2026: tab Mẫu creative đổi khuôn → bản giữ của bản dựng trước thiếu trường mới → trang đổ "reading 'length'"
 *  trước khi bản mới về). Bản giữ không qua `hop` thì bỏ, chờ bản mới — đổi khuôn dữ liệu của widget thì sửa `hop`, không cần đổi khoá. */
// MỘT BẢN CHUNG MỖI KHOÁ trong trang (góp ý #1728, anh 20/11/2026 "Phim đã sinh xong mà ko thấy update ngay"): trước đây mỗi chỗ gọi useSoNho('mau-cr')
// giữ bản riêng — ngăn chi tiết dựng tự tải thấy Xong mà dòng phim của tab vẫn "chờ máy" tới nhịp sau của chính nó. Giờ bản mới của BẤT KỲ chỗ nào
// về là mọi chỗ cùng khoá đổi theo; lamMoiSo(khoa) = kéo bản mới ngay (chỗ nào biết số vừa đổi thì gọi, khỏi chờ nhịp).
type ChungSo = { so: unknown; loi: string | null; nghe: Set<() => void>; tai: Set<() => void> };
const CHUNG = new Map<string, ChungSo>();
const DANG_TAI = new Set<string>(), CHO_LAI = new Set<string>();
const chung = (k: string): ChungSo => CHUNG.get(k) ?? (CHUNG.set(k, { so: null, loi: null, nghe: new Set(), tai: new Set() }), CHUNG.get(k)!);
/** kéo bản mới cho khoá NGAY (một lượt, chung cho mọi chỗ đang hiện khoá đó) */
export function lamMoiSo(khoa: string): void { const f = chung(khoa).tai.values().next().value; if (f) f(); }

export function useSoNho<T extends object>(khoa: string, tai: () => Promise<T | { loi: string }>, ms?: number, hop?: (v: unknown) => boolean): { so: T | null; loi: string | null } {
  const [so, setSo] = useState<T | null>(() => (chung(khoa).so as T | null) ?? null);
  const [loi, setLoi] = useState<string | null>(null);
  useEffect(() => {
    let huy = false, moi = false;
    const c = chung(khoa);
    const nghe = () => { if (huy) return; if (c.so) { moi = true; setSo(c.so as T); } setLoi(c.loi); };
    c.nghe.add(nghe); if (c.so) { moi = true; setSo(c.so as T); }
    const bao = () => c.nghe.forEach((x) => x());
    void docNho(khoa).then((b) => { if (b && !huy && !moi) try { const v = JSON.parse(b.than); if (!hop || hop(v)) setSo(v as T); else console.warn('[etp2 số giữ trong máy] bỏ bản giữ khuôn cũ', khoa); } catch { /* bản hỏng — chờ bản mới */ } });
    // một lượt tải ghi vào bản chung rồi báo MỌI chỗ cùng khoá; đang có lượt bay thì không gọi chồng
    // bị gọi khi lượt kia đang bay → lượt đó có thể bắt đầu TRƯỚC lúc số đổi, nên tải thêm đúng một lượt ngay sau nó
    const f = (): void => { if (DANG_TAI.has(khoa)) { CHO_LAI.add(khoa); return; } DANG_TAI.add(khoa);
      tai().then((r) => { if ('loi' in r) { c.loi = r.loi; } else { c.so = r; c.loi = null; void ghiNho(khoa, r); } bao(); })
        .catch((e: unknown) => { c.loi = e instanceof Error ? e.message : String(e); bao(); })
        .finally(() => { DANG_TAI.delete(khoa); if (CHO_LAI.delete(khoa)) lamMoiSo(khoa); }); };
    c.tai.add(f); f(); const t = ms ? nhip(f, ms) : null;
    return () => { huy = true; t?.(); c.nghe.delete(nghe); c.tai.delete(f); };
  }, [khoa]);   // eslint-disable-line react-hooks/exhaustive-deps
  return { so, loi };
}
