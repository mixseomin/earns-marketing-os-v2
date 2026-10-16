'use client';
// Danh mục model ảnh/video nạp một lần cho cả trang (context) + cách hiện giá/lựa chọn model trên ô chọn.
import { createContext } from 'react';
import { type MoHinhChon } from '@/lib/actions';
import { giaAnhCents, giaVideoCents, tien, hopQc } from '@/lib/xuong-video/kieu';
import { type LuaChon } from './chon';

/** Danh mục model (Google/OpenAI + ~100 model fal) nạp một lần cho cả trang. */
export const MoHinhCtx = createContext<{ anh: MoHinhChon[]; video: MoHinhChon[] }>({ anh: [], video: [] });

// Giá video: fal đọc từ bảng giá (khoảng theo độ phân giải phim, có tiếng); Google theo bảng tĩnh. Chi tiết tiếng Việt ở ô rê chuột (#1193).
export const giaVideoUi = (ds: MoHinhChon[], key: string, giay: number, dpg: '720p' | '1080p') => {
  const m = ds.find((x) => x.key === key);
  if (m?.gia) { const g = m.gia.chinh[dpg]; if (g != null) return g * giay; const c = m.gia.clip[dpg]; if (c) return c[1]; }
  if (m?.giaCents != null && m.donVi === 'clip') return m.giaCents;   // cổng bán theo clip (cong-ai.ts), tiền thật
  return m?.giaCents != null && m.donVi === 'giay' ? m.giaCents * giay : giaVideoCents(key, dpg, giay);
};

export const giaAnhUi = (ds: MoHinhChon[], key: string) => ds.find((x) => x.key === key)?.giaCents ?? giaAnhCents(key);

export const khoangTien = (k: [number, number], nhan = 1) => (Math.abs(k[0] - k[1]) < 0.05 ? tien(k[0] * nhan) : `${tien(k[0] * nhan)}–${tien(k[1] * nhan)}`);

/** Tên gọn trên ô chọn model (#1383): phần trước " · " — "Nano Banana 2.1 · tự chọn rẻ nhất (ckey → ShopAIKey → Google)" → "Nano Banana 2.1". */
const tenGon = (label: string): string => label.split(' · ')[0]!.trim();
export function luaChonAnh(ds: MoHinhChon[]): LuaChon[] {
  return ds.map((m) => {
    const k = m.gia?.anh;
    const phu = k ? `${khoangTien(k)}/ảnh` : m.giaCents != null ? `${tien(m.giaCents)}/ảnh` : 'chưa có giá';
    return { value: m.key, label: m.label, ngan: tenGon(m.label), nhom: m.nhom, phu, title: m.gia?.moTa ?? (m.giaCents != null ? `${tien(m.giaCents)} mỗi ảnh` : '') };
  });
}

export function luaChonVideo(ds: MoHinhChon[], giay: number, dpg: '720p' | '1080p', laQc: boolean): LuaChon[] {
  // Mục "tự chọn rẻ nhất" có bậc không hợp QC (Grok in phụ đề) → ẩn khỏi phim QC; mục Google (trực tiếp) cùng model vẫn còn.
  return ds.filter((m) => hopQc(m.key, laQc) && (m.chuoi ?? []).every((k) => hopQc(k, laQc))).map((m) => {
    if (m.gia) {
      const kg = m.gia.giay[dpg]; const kc = m.gia.clip[dpg];
      const phu = kg ? `${khoangTien(kg, giay)} · ${giay}s` : kc ? `${khoangTien(kc)}/clip` : 'chưa có giá';
      const uoc = kg ? `\nƯớc tính clip ${giay} giây ở ${dpg}: ${khoangTien(kg, giay)} (thấp = không tiếng, cao = có tiếng; studio bật tiếng nên tính mức cao).` : '';
      return { value: m.key, label: m.label, ngan: tenGon(m.label), nhom: m.nhom, phu, title: m.gia.moTa + uoc };
    }
    if (m.donVi === 'clip' && m.giaCents != null) return { value: m.key, label: m.label, ngan: tenGon(m.label), nhom: m.nhom, phu: `${tien(m.giaCents)}/clip`, title: `${tien(m.giaCents)} mỗi clip — tiền thật đã quy đổi (cổng bán theo lượt)` };
    const g = m.donVi === 'giay' && m.giaCents != null ? m.giaCents : giaVideoCents(m.key, dpg, 1);
    return { value: m.key, label: m.label, ngan: tenGon(m.label), nhom: m.nhom, phu: `${tien(g * giay)} · ${giay}s`, title: `${tien(g)} mỗi giây ở ${dpg} (bảng giá Google)` };
  });
}

// ── Trang ───────────────────────────────────────────────────────────────────────────────────────────────────────
