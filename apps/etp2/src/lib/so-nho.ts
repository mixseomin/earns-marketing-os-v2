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

/** widget tự tải: bản giữ hiện ngay (khi bản mới chưa về), bản mới về thì thay + giữ lại. tai trả `{ loi }` khi máy chủ báo lỗi; `ms` = nhịp tải lại */
export function useSoNho<T extends object>(khoa: string, tai: () => Promise<T | { loi: string }>, ms?: number): { so: T | null; loi: string | null } {
  const [so, setSo] = useState<T | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  useEffect(() => {
    let huy = false, moi = false;
    void docNho(khoa).then((b) => { if (b && !huy && !moi) try { setSo(JSON.parse(b.than) as T); } catch { /* bản hỏng — chờ bản mới */ } });
    const f = () => tai().then((r) => { if (huy) return; if ('loi' in r) { setLoi(r.loi); return; } moi = true; setLoi(null); setSo(r as T); void ghiNho(khoa, r); })
      .catch((e: unknown) => { if (!huy) setLoi(e instanceof Error ? e.message : String(e)); });
    f(); const t = ms ? nhip(f, ms) : null;
    return () => { huy = true; t?.(); };
  }, [khoa]);   // eslint-disable-line react-hooks/exhaustive-deps
  return { so, loi };
}
