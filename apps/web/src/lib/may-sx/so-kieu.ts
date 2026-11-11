// SỔ DẠNG BÀI của Máy SX đọc phía mos2 — ĐÚNG tệp apps/xuong-video/kieu-sx.json mà máy (sx-may.mjs) đọc. Audit 11/11/2026: nhãn + dạng mặc định
// từng gõ lại trong may-sx-view.tsx và gom.ts; phiên khác đổi Reel mặc định sang bản FREE trong máy thì trang vẫn ghi "Reel cắt cảnh 9s".
// Một nguồn: đổi sổ là máy lẫn trang cùng đổi. Đọc theo cách kenh-sp.ts đọc tệp xuong-video (cwd của web có thể là gốc repo hoặc apps/web).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type DangSx = { ten: string; nen: string; mac_dinh?: boolean; vnd?: number };
let nho: Record<string, DangSx> | null = null;

export function docSoKieu(): Record<string, DangSx> {
  if (nho) return nho;
  for (const goc of [process.cwd(), join(process.cwd(), '..'), join(process.cwd(), '../..')]) {
    try {
      const d = JSON.parse(readFileSync(join(goc, 'apps/xuong-video/kieu-sx.json'), 'utf8')) as Record<string, DangSx | string>;
      nho = Object.fromEntries(Object.entries(d).filter((e): e is [string, DangSx] => !e[0].startsWith('_') && typeof e[1] === 'object'));
      return nho;
    } catch { /* thử gốc khác */ }
  }
  throw new Error('không đọc được apps/xuong-video/kieu-sx.json');
}

/** Dạng THỰC SẼ DỰNG của một bài: dạng bài khai (dang.kieu_sx) → không có thì dạng mặc định của nền trong sổ. Cùng luật kieuMacDinh của sx-may.mjs. */
export function dangCua(kieu: string | null | undefined, nen: string | null | undefined, so = docSoKieu()): string | null {
  if (kieu && so[kieu]) return kieu;
  return Object.keys(so).find((k) => so[k]!.nen === nen && so[k]!.mac_dinh) ?? null;
}
export const tenDang = (k: string | null, so = docSoKieu()) => (k ? so[k]?.ten ?? k : 'chưa có dạng bài');
