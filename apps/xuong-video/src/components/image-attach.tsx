'use client';

// Khung đính ảnh của studio = bản dùng chung @mos2/gop-y/client (kéo thả · Ctrl+V · Paste · chọn file · URL · thu nhỏ trước khi tải).
// Mặc định tải qua hòm góp ý studio (R2 gop-y-studio), xem ảnh to bằng ngăn chung. `upload` thay đường tải (vd ảnh tham chiếu).
import { ImageAttach as KhungAnh } from '@mos2/gop-y/client';
import { taiAnhGopY, xoaAnhGopY } from '@/lib/gop-y';
import { moNgan } from './ngan-chung';

/** Bỏ ảnh chưa gửi khỏi form — không xoá file R2 (xoaAnhGopY chỉ trả ok). */
export function discardAttachments(urls: string[]) { for (const u of urls) void xoaAnhGopY(u); }

export function ImageAttach({ upload, folder: _thuMuc, ...p }: {
  value: string[]; onChange: (urls: string[]) => void; folder?: string; max?: number;
  upload?: (dataUrl: string) => Promise<{ ok: boolean; url?: string; error?: string }>; nhanBo?: string;
}) {
  return <KhungAnh {...p} upload={upload ?? taiAnhGopY} xoaAnh={xoaAnhGopY} xemAnh={(url) => moNgan({ loai: 'xem', url })} />;
}
