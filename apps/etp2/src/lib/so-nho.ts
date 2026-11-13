'use client';
// SỐ CỦA WIDGET TỰ TẢI RIÊNG: HIỆN NGAY BẢN LẦN TRƯỚC, TẢI MỚI NGẦM (anh 13/11/2026 ảnh iPhone khoanh widget Người "đang tải số…":
// "Có data rồi mà vẫn phải đợi tiếp à… Thiết kế kiểu gì đây"). Widget Người / Tài khoản (taiTong2) và tab Insight (docInsight) gọi máy chủ riêng,
// không nằm trong khối số chính đã giữ trong máy → mạng iPhone 20 KB/giây là đứng "đang tải số…" dù trang đã có số.
// Dùng chung: useSoNho(khoá, hàm tải, nhịp) → bản giữ trong localStorage hiện ngay ở lượt vẽ đầu, bản mới về thì thay + ghi lại.
// localStorage bị chặn / đầy → chỉ mất phần hiện-ngay, vẫn tải như cũ.
import { useEffect, useState } from 'react';
import { nhip } from './nhip';

export const docNho = <T,>(k: string): T | null => { try { const s = localStorage.getItem(`etp2-nho:${k}`); return s ? (JSON.parse(s) as T) : null; } catch { return null; } };
export const ghiNho = (k: string, v: unknown) => { try { localStorage.setItem(`etp2-nho:${k}`, JSON.stringify(v)); } catch { /* đầy / bị chặn */ } };

/** tai trả `{ loi }` khi máy chủ báo lỗi — giữ bản cũ, báo `loi`; `ms` = nhịp tải lại (bỏ trống = chỉ một lần) */
export function useSoNho<T extends object>(khoa: string, tai: () => Promise<T | { loi: string }>, ms?: number): { so: T | null; loi: string | null } {
  const [so, setSo] = useState<T | null>(() => docNho<T>(khoa));
  const [loi, setLoi] = useState<string | null>(null);
  useEffect(() => {
    let huy = false;
    const f = () => tai().then((r) => { if (huy) return; if ('loi' in r) { setLoi(r.loi); return; } setLoi(null); setSo(r as T); ghiNho(khoa, r); })
      .catch((e: unknown) => { if (!huy) setLoi(e instanceof Error ? e.message : String(e)); });
    f(); const t = ms ? nhip(f, ms) : null;
    return () => { huy = true; t?.(); };
  }, [khoa]);   // eslint-disable-line react-hooks/exhaustive-deps
  return { so, loi };
}
